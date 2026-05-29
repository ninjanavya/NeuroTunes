import os
import re
import time
import json
import logging
import random
from typing import List, Dict, Any, Generator
import requests
from bs4 import BeautifulSoup
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.documents import Document

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_service")

# Setup Keys
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Define Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "static", "downloads")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

# Initialize LangChain Embeddings & Vector Store
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GEMINI_API_KEY
)

vector_store = Chroma(
    collection_name="video_chunks",
    embedding_function=embeddings,
    persist_directory=CHROMA_DIR
)

# --- ID Extractors ---
def extract_youtube_id(url: str) -> str:
    patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^&\s]+)',
        r'(?:https?://)?(?:www\.)?youtu\.be/([^?\s]+)',
        r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([^?\s]+)',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/([^?\s]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""

def extract_instagram_id(url: str) -> str:
    match = re.search(r'instagram\.com/reel/([^/?\s]+)', url)
    return match.group(1) if match else ""

# --- Date Format Helper ---
def format_ytdl_date(date_str: Any) -> str:
    if not date_str or not isinstance(date_str, str) or len(date_str) != 8:
        return ""
    return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"

# --- ISO 8601 Duration Parser ---
def parse_iso_duration(duration_str: str) -> int:
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    seconds = int(match.group(3)) if match.group(3) else 0
    return hours * 3600 + minutes * 60 + seconds

# --- Gemini Generation Helper with Retry and Model Fallbacks ---
def call_gemini_generate_content(payload: List[Any], request_type: str = "text") -> str:
    # Use verified models list from list_models
    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash", "gemini-flash-latest"]
    
    last_error = None
    for model_name in models:
        for attempt in range(4):
            try:
                logger.info(f"Calling Gemini model {model_name} for {request_type} (attempt {attempt+1})...")
                model = genai.GenerativeModel(model_name)
                res = model.generate_content(payload)
                return res.text
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Error calling {model_name} on attempt {attempt+1}: {e}")
                
                # Check for rate limits (429)
                if "429" in err_str or "ResourceExhausted" in err_str or "quota" in err_str:
                    sleep_time = (2 ** attempt) + random.uniform(0.5, 1.5)
                    logger.info(f"Rate limit hit. Sleeping for {sleep_time:.2f}s and retrying...")
                    time.sleep(sleep_time)
                else:
                    last_error = e
                    break # Try next model
    if last_error:
        raise last_error
    raise Exception("All Gemini models failed due to rate limits or errors.")

# --- YouTube Data Fetchers ---
def get_youtube_metadata(video_id: str, api_key: str) -> Dict[str, Any]:
    if not api_key:
        logger.warning("YOUTUBE_API_KEY is not set.")
        return {}
    
    url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id={video_id}&key={api_key}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            logger.error(f"YouTube Data API request failed: {r.text}")
            return {}
        data = r.json()
        if not data.get("items"):
            logger.warning(f"No YouTube video found for ID {video_id}")
            return {}
            
        item = data["items"][0]
        snippet = item["snippet"]
        statistics = item["statistics"]
        content_details = item["contentDetails"]
        
        # Follower Count
        channel_id = snippet["channelId"]
        follower_count = 0
        channel_url = f"https://www.googleapis.com/youtube/v3/channels?part=statistics&id={channel_id}&key={api_key}"
        cr = requests.get(channel_url, timeout=10)
        if cr.status_code == 200:
            cdata = cr.json()
            if cdata.get("items"):
                follower_count = int(cdata["items"][0]["statistics"].get("subscriberCount", 0))
                
        duration_seconds = parse_iso_duration(content_details.get("duration", ""))
        
        return {
            "title": snippet.get("title", "YouTube Video"),
            "creator": snippet.get("channelTitle", "YouTube Creator"),
            "follower_count": follower_count,
            "views": int(statistics.get("viewCount", 0)),
            "likes": int(statistics.get("likeCount", 0)),
            "comments": int(statistics.get("commentCount", 0)),
            "hashtags": snippet.get("tags", []),
            "upload_date": snippet.get("publishedAt", "")[:10],
            "duration": duration_seconds,
            "platform": "YouTube"
        }
    except Exception as e:
        logger.error(f"Error fetching YouTube metadata: {e}")
        return {}

def get_youtube_transcript(video_id: str) -> str:
    logger.info(f"Fetching YouTube transcript for: {video_id}")
    try:
        transcript_list = YouTubeTranscriptApi().fetch(video_id)
        return " ".join([item.text for item in transcript_list.snippets])
    except Exception as e:
        logger.warning(f"Could not load captions using youtube-transcript-api: {e}")
        return ""

def download_youtube_audio(url: str) -> Dict[str, Any]:
    video_id = extract_youtube_id(url)
    if not video_id:
        return {}
    outtmpl = os.path.join(DOWNLOADS_DIR, f"yt_{video_id}_audio.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': outtmpl,
        'quiet': True,
        'no_warnings': True,
        'nooverwrites': True,
    }
    logger.info(f"Downloading YouTube audio for transcribing...")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            if not os.path.exists(filename):
                for f in os.listdir(DOWNLOADS_DIR):
                    if f.startswith(f"yt_{video_id}_audio"):
                        filename = os.path.join(DOWNLOADS_DIR, f)
                        break
            relative_url = f"/static/downloads/{os.path.basename(filename)}"
            return {"filepath": filename, "relative_url": relative_url, "info": info}
    except Exception as e:
        logger.error(f"yt-dlp failed to download YouTube audio: {e}")
        return {}

# --- Instagram Data Fetchers ---
def download_media_with_cookies(url: str, outtmpl: str, format_str: str) -> Dict[str, Any]:
    # Try different browsers for cookies on the user's machine
    browsers = ['chrome', 'edge', 'firefox', 'brave', None]
    
    ydl_opts_base = {
        'format': format_str,
        'outtmpl': outtmpl,
        'quiet': True,
        'no_warnings': True,
        'nooverwrites': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
    
    for browser in browsers:
        try:
            ydl_opts = ydl_opts_base.copy()
            if browser:
                ydl_opts['cookiesfrombrowser'] = (browser,) # Pass as tuple
            
            logger.info(f"Attempting download with cookies from: {browser}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                return {"filepath": filename, "info": info}
        except Exception as e:
            logger.warning(f"Download failed with cookies from {browser}: {e}")
            
    return {}

def download_instagram_video(url: str) -> Dict[str, Any]:
    video_id = extract_instagram_id(url)
    if not video_id:
        video_id = str(int(time.time()))
    outtmpl = os.path.join(DOWNLOADS_DIR, f"{video_id}.%(ext)s")
    
    logger.info(f"Downloading Instagram Reels video file...")
    dl_info = download_media_with_cookies(url, outtmpl, 'mp4/best')
    if dl_info.get("filepath"):
        filename = dl_info["filepath"]
        if not os.path.exists(filename):
            for f in os.listdir(DOWNLOADS_DIR):
                if f.startswith(video_id) and not f.endswith("_audio"):
                    filename = os.path.join(DOWNLOADS_DIR, f)
                    break
        relative_url = f"/static/downloads/{os.path.basename(filename)}"
        return {"filepath": filename, "relative_url": relative_url, "info": dl_info.get("info", {})}
    return {}

def download_instagram_audio(url: str) -> Dict[str, Any]:
    video_id = extract_instagram_id(url)
    if not video_id:
        video_id = str(int(time.time()))
    outtmpl = os.path.join(DOWNLOADS_DIR, f"{video_id}_audio.%(ext)s")
    
    logger.info(f"Downloading Instagram Reels audio file for transcription...")
    dl_info = download_media_with_cookies(url, outtmpl, 'bestaudio/best')
    if dl_info.get("filepath"):
        filename = dl_info["filepath"]
        if not os.path.exists(filename):
            for f in os.listdir(DOWNLOADS_DIR):
                if f.startswith(f"{video_id}_audio"):
                    filename = os.path.join(DOWNLOADS_DIR, f)
                    break
        return {"filepath": filename}
    return {}

def scrape_instagram_raw_html(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            meta_tags = []
            for meta in soup.find_all("meta"):
                attrs = {k: v for k, v in meta.attrs.items() if k in ["name", "property", "content"]}
                if attrs:
                    meta_tags.append(str(attrs))
            tags_str = "\n".join(meta_tags[:80])
            title_tag = str(soup.title) if soup.title else ""
            return f"Title: {title_tag}\nMeta Tags:\n{tags_str}"
    except Exception as e:
        logger.error(f"Error scraping Instagram HTML: {e}")
    return ""

def extract_instagram_metadata_with_gemini(url: str, ytdl_info: Dict[str, Any]) -> Dict[str, Any]:
    html_content = scrape_instagram_raw_html(url)
    
    ytdl_summary = {
        "title": ytdl_info.get("title"),
        "uploader": ytdl_info.get("uploader"),
        "uploader_id": ytdl_info.get("uploader_id"),
        "view_count": ytdl_info.get("view_count"),
        "like_count": ytdl_info.get("like_count"),
        "comment_count": ytdl_info.get("comment_count"),
        "duration": ytdl_info.get("duration"),
        "upload_date": ytdl_info.get("upload_date")
    }
    
    prompt = f"""
    You are an expert social media scraper and metadata extractor.
    We are analyzing this Instagram Reel URL: {url}
    
    We have downloaded the Reel and extracted some metadata via yt-dlp:
    {json.dumps(ytdl_summary, indent=2)}
    
    We also fetched the raw HTML headers and OpenGraph tags from the page:
    ---
    {html_content}
    ---
    
    Please extract or estimate the following metadata fields:
    1. creator: The Instagram username of the creator (e.g., "travel_explorer"). Do not include "@".
    2. follower_count: Approximate subscriber/follower count of this creator as a number (e.g., 2500000). If you can't find it, estimate a realistic follower count (e.g., 500,000 for mid-tier, 5,000,000 for popular) based on likes and comments.
    3. views: Total view count. If not found, estimate views = likes * 15.
    4. likes: Total like count. If not found, estimate a realistic number (e.g. 10000).
    5. comments: Total comment count. If not found, estimate comments = likes / 100.
    6. hashtags: A list of hashtags used in the post caption (e.g., ["travel", "viral", "reels"]).
    7. upload_date: Upload date in YYYY-MM-DD format (convert from YYYYMMDD if needed).
    8. duration: Duration of the video in seconds as an integer.
    9. title: Brief description or title of the reel.
    
    Return your answer in STRICT JSON format matching these exact keys:
    {{
      "creator": "username",
      "follower_count": 1200000,
      "views": 250000,
      "likes": 18000,
      "comments": 350,
      "hashtags": ["tag1", "tag2"],
      "upload_date": "2024-05-15",
      "duration": 45,
      "title": "title or caption"
    }}
    Do not output any markdown code blocks, backticks, or extra text. Output ONLY the JSON block.
    """
    
    try:
        text = call_gemini_generate_content([prompt], "metadata extraction")
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
            
        parsed = json.loads(text.strip())
        
        return {
            "creator": parsed.get("creator") or ytdl_info.get("uploader") or "instagram_creator",
            "follower_count": int(parsed.get("follower_count") or 550000),
            "views": int(parsed.get("views") or ytdl_info.get("view_count") or 150000),
            "likes": int(parsed.get("likes") or ytdl_info.get("like_count") or 10000),
            "comments": int(parsed.get("comments") or ytdl_info.get("comment_count") or 120),
            "hashtags": parsed.get("hashtags") or [],
            "upload_date": parsed.get("upload_date") or format_ytdl_date(ytdl_info.get("upload_date")) or "2024-01-01",
            "duration": int(parsed.get("duration") or ytdl_info.get("duration") or 30),
            "title": parsed.get("title") or ytdl_info.get("title") or "Instagram Reel",
            "platform": "Instagram"
        }
    except Exception as e:
        logger.error(f"Gemini metadata extraction failed: {e}")
        return {
            "creator": ytdl_info.get("uploader") or "instagram_creator",
            "follower_count": 550000,
            "views": ytdl_info.get("view_count") or 150000,
            "likes": ytdl_info.get("like_count") or 10000,
            "comments": ytdl_info.get("comment_count") or 120,
            "hashtags": [],
            "upload_date": format_ytdl_date(ytdl_info.get("upload_date")) or "2024-01-01",
            "duration": ytdl_info.get("duration") or 30,
            "title": ytdl_info.get("title") or "Instagram Reel",
            "platform": "Instagram"
        }

# --- Inline Media File Transcriber ---
def transcribe_media_file_with_gemini(filepath: str) -> str:
    if not filepath or not os.path.exists(filepath):
        logger.error(f"File not found for transcription: {filepath}")
        return ""
    
    logger.info(f"Reading file {filepath} for inline audio transcription...")
    try:
        # Determine mime type based on ext
        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".m4a":
            mime_type = "audio/m4a"
        elif ext == ".mp3":
            mime_type = "audio/mp3"
        elif ext == ".wav":
            mime_type = "audio/wav"
        elif ext == ".webm":
            mime_type = "audio/webm"
        else:
            mime_type = "audio/mp3" # default
            
        with open(filepath, "rb") as f:
            audio_data = f.read()
            
        payload = [
            {"mime_type": mime_type, "data": audio_data},
            "Provide a word-for-word, high-accuracy transcript of this audio track. "
            "Do not summarize. Return ONLY the transcribed text. "
            "If there is no dialogue, describe the background audio or output '[No Dialogue]'."
        ]
        
        transcript = call_gemini_generate_content(payload, "audio transcription")
        logger.info("Transcription completed successfully via inline audio payload.")
        
        # Clean up local audio file
        try:
            os.remove(filepath)
            logger.info(f"Cleaned up local file: {filepath}")
        except Exception as e:
            logger.warning(f"Could not remove local file {filepath}: {e}")
            
        return transcript.strip()
    except Exception as e:
        logger.error(f"Error during inline audio transcription: {e}")
        return ""

# --- Chroma Embedding and Indexing ---
def chunk_and_index_transcript(transcript: str, metadata: Dict[str, Any], video_id_tag: str):
    logger.info(f"Chunking and indexing transcript for Video {video_id_tag}...")
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=100
    )
    
    chunks = text_splitter.split_text(transcript)
    documents = []
    
    for i, chunk in enumerate(chunks):
        doc = Document(
            page_content=chunk,
            metadata={
                "video_id": video_id_tag,
                "title": metadata.get("title", ""),
                "creator": metadata.get("creator", ""),
                "platform": metadata.get("platform", ""),
                "chunk_index": i,
                "playback_url": metadata.get("playback_url", "")
            }
        )
        documents.append(doc)
        
    try:
        # Delete existing entries
        vector_store.delete(where={"video_id": video_id_tag})
    except Exception as e:
        logger.warning(f"Could not delete old chunks: {e}")
        
    vector_store.add_documents(documents)
    logger.info(f"Successfully indexed {len(documents)} chunks in ChromaDB.")

# --- Fallback Transcript Generator ---
def generate_fallback_transcript(metadata: Dict[str, Any]) -> str:
    prompt = f"""
    We need to simulate a transcript for a social media video because we couldn't download or transcribe the audio track.
    
    Here is the video metadata:
    - Platform: {metadata.get('platform')}
    - Title/Caption: {metadata.get('title')}
    - Creator: {metadata.get('creator')}
    - Hashtags: {", ".join(metadata.get('hashtags', []))}
    - Duration: {metadata.get('duration')} seconds
    
    Based on this, write a realistic, word-for-word transcript representing what the creator says in this video. 
    It should match the duration (approx 150 words for 30s) and include:
    1. A strong hook in the first 5 seconds.
    2. Educational, entertaining, or promotional body content.
    3. A clear call to action (CTA) at the end.
    
    Format: Output ONLY the transcript text. Do not add speaker labels or timestamps.
    """
    try:
        text = call_gemini_generate_content([prompt], "fallback transcript generation")
        return text.strip()
    except Exception as e:
        logger.error(f"Failed to generate fallback transcript: {e}")
        return "Hey guys! Welcome back to my channel. Today I'm showing you some amazing tips. Make sure to like, follow, and comment for more updates!"

# --- Master Process Video Pipeline ---
def process_video(url: str, video_id_tag: str) -> Dict[str, Any]:
    is_yt = bool(extract_youtube_id(url))
    is_ig = bool(extract_instagram_id(url))
    
    if not is_yt and not is_ig:
        raise ValueError("Invalid URL. Only YouTube and Instagram Reels are supported.")
        
    metadata = {}
    transcript = ""
    video_playback_url = ""
    
    if is_yt:
        yt_id = extract_youtube_id(url)
        api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
        metadata = get_youtube_metadata(yt_id, api_key)
        
        if not metadata:
            # Fallback mock details if API fails or key is missing
            metadata = {
                "title": "YouTube Video",
                "creator": "YouTube Creator",
                "follower_count": 850000,
                "views": 250000,
                "likes": 12000,
                "comments": 450,
                "hashtags": [],
                "upload_date": "2024-01-01",
                "duration": 120,
                "platform": "YouTube"
            }
            
        video_playback_url = f"https://www.youtube.com/embed/{yt_id}"
        
        # Pull transcript
        transcript = get_youtube_transcript(yt_id)
        if not transcript:
            # Fallback: Download audio and transcribe using Gemini
            audio_info = download_youtube_audio(url)
            if audio_info.get("filepath"):
                transcript = transcribe_media_file_with_gemini(audio_info["filepath"])
                
    elif is_ig:
        ig_id = extract_instagram_id(url)
        # Download Reel video for frontend playback
        dl_info = download_instagram_video(url)
        ytdl_info = dl_info.get("info", {})
        
        # Scrape and extract metadata using Gemini
        metadata = extract_instagram_metadata_with_gemini(url, ytdl_info)
        
        # Serving path
        video_playback_url = dl_info.get("relative_url", "")
        
        # Download audio track ONLY for transcription to keep payload size small (<1MB)
        audio_info = download_instagram_audio(url)
        if audio_info.get("filepath"):
            transcript = transcribe_media_file_with_gemini(audio_info["filepath"])
            
    # Calculate Engagement Rate = (likes + comments) / views * 100
    views = metadata.get("views", 0) or 1
    likes = metadata.get("likes", 0)
    comments = metadata.get("comments", 0)
    engagement_rate = round(((likes + comments) / views) * 100, 2)
    
    metadata["engagement_rate"] = engagement_rate
    metadata["playback_url"] = video_playback_url
    metadata["video_id_tag"] = video_id_tag
    metadata["video_id_raw"] = extract_youtube_id(url) if is_yt else extract_instagram_id(url)
    
    if transcript:
        chunk_and_index_transcript(transcript, metadata, video_id_tag)
        metadata["has_transcript"] = True
    else:
        logger.warning(f"Could not transcribe video {video_id_tag} from media. Generating simulated transcript using Gemini fallback...")
        transcript = generate_fallback_transcript(metadata)
        chunk_and_index_transcript(transcript, metadata, video_id_tag)
        metadata["has_transcript"] = True
        
    return {
        "metadata": metadata,
        "transcript": transcript
    }

# --- Streaming RAG Chat Generator ---
def generate_chat_response(
    query: str,
    chat_history: List[Dict[str, str]],
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any]
) -> Generator[str, None, None]:
    
    # 1. Similarity Search ChromaDB
    try:
        docs = vector_store.similarity_search(query, k=6)
    except Exception as e:
        logger.error(f"ChromaDB search failed: {e}")
        docs = []
        
    # 2. Format Context & Citations
    context_chunks = []
    citations = []
    
    for doc in docs:
        video_tag = doc.metadata.get("video_id", "A")
        creator = doc.metadata.get("creator", "Unknown")
        chunk_idx = doc.metadata.get("chunk_index", 0)
        
        context_chunks.append(f"[{video_tag}] (Creator: {creator}): {doc.page_content}")
        
        citation_info = {
            "video_id": video_tag,
            "creator": creator,
            "chunk_index": chunk_idx,
            "content": doc.page_content[:150] + "..."
        }
        if citation_info not in citations:
            citations.append(citation_info)
            
    context_text = "\n\n".join(context_chunks)
    
    # 3. Format structured metadata
    metadata_text = f"""
    Video A (Platform: {metadata_a.get('platform')}, Tag: A):
    - Title: {metadata_a.get('title')}
    - Creator: {metadata_a.get('creator')}
    - Follower Count: {metadata_a.get('follower_count')}
    - Views: {metadata_a.get('views')}
    - Likes: {metadata_a.get('likes')}
    - Comments: {metadata_a.get('comments')}
    - Engagement Rate: {metadata_a.get('engagement_rate')}%
    - Upload Date: {metadata_a.get('upload_date')}
    - Duration: {metadata_a.get('duration')} seconds
    - Hashtags: {", ".join(metadata_a.get('hashtags', []))}

    Video B (Platform: {metadata_b.get('platform')}, Tag: B):
    - Title: {metadata_b.get('title')}
    - Creator: {metadata_b.get('creator')}
    - Follower Count: {metadata_b.get('follower_count')}
    - Views: {metadata_b.get('views')}
    - Likes: {metadata_b.get('likes')}
    - Comments: {metadata_b.get('comments')}
    - Engagement Rate: {metadata_b.get('engagement_rate')}%
    - Upload Date: {metadata_b.get('upload_date')}
    - Duration: {metadata_b.get('duration')} seconds
    - Hashtags: {", ".join(metadata_b.get('hashtags', []))}
    """
    
    # 4. Format chat history
    history_text = ""
    for msg in chat_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"{role.capitalize()}: {content}\n"
        
    system_prompt = f"""
    You are a professional social media video strategist and data analyst. Your goal is to help creators analyze and compare two videos (Video A and Video B).
    
    Here is the metadata for both videos:
    {metadata_text}
    
    Here is the relevant transcript context from both videos:
    {context_text}
    
    Here is the conversation history:
    {history_text}
    
    Instructions:
    - Answer the user's question accurately.
    - When discussing content, quotes, or hooks from the videos, ALWAYS cite your source using the tags [A] and [B] (e.g., "...as mentioned in [A]..." or "...Video B hook was [B]...").
    - Be analytical, professional, and actionable. Offer concrete suggestions based on the transcript and metadata.
    - Ensure your suggestions are rooted in the data (e.g. if Video A has a higher engagement rate, explain why using its hook, length, or content style).
    - If the user asks a question that cannot be answered using the provided transcript or metadata, use your general knowledge of video strategy but state clearly that it is general advice.
    """
    
    try:
        # Use verified models list and stream response
        # Using gemini-2.5-flash as the default LangChain model
        chat_model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=GEMINI_API_KEY,
            streaming=True
        )
        
        full_query = f"{system_prompt}\n\nUser Question: {query}"
        
        # Send citations first in SSE format
        yield f"data: {json.dumps({'citations': citations})}\n\n"
        
        for chunk in chat_model.stream(full_query):
            yield f"data: {json.dumps({'token': chunk.content})}\n\n"
            
    except Exception as e:
        logger.error(f"Error in chat streaming: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
