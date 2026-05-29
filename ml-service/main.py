import os
import random
import numpy as np
import pandas as pd
import requests
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from dotenv import load_dotenv
import sys

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

# Import RAG Service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import rag_service

app = FastAPI(title="NeuroTunes ML Microservice", version="1.0.0")

# Mount static files for downloads
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "songs_dataset.csv")

# ---------------------------------------------------------------------------
# ML Recommender & Data Store
# ---------------------------------------------------------------------------
class MLMusicRecommender:
    def __init__(self, csv_path):
        self.csv_path = csv_path
        self.df = None
        self.similarity_matrix = None
        self.load_data()

    def get_default_dataset(self):
        return pd.DataFrame([
            {"song": "Blinding Lights - The Weeknd", "mood": "happy", "genre": "pop", "energy": 0.95, "valence": 0.88, "plays": 10},
            {"song": "Levitating - Dua Lipa", "mood": "happy", "genre": "pop", "energy": 0.88, "valence": 0.82, "plays": 8},
            {"song": "Happy Now - Zedd", "mood": "happy", "genre": "dance", "energy": 0.82, "valence": 0.75, "plays": 5},
            {"song": "Good Life - OneRepublic", "mood": "happy", "genre": "pop", "energy": 0.78, "valence": 0.80, "plays": 12},
            {"song": "Sunflower - Post Malone", "mood": "chill", "genre": "indie", "energy": 0.55, "valence": 0.60, "plays": 15},
            {"song": "Night Drive - Lofi Beats", "mood": "chill", "genre": "lofi", "energy": 0.35, "valence": 0.45, "plays": 22},
            {"song": "Ocean Eyes - Billie Eilish", "mood": "chill", "genre": "alternative", "energy": 0.42, "valence": 0.35, "plays": 19},
            {"song": "Afterglow - Wilkinson", "mood": "chill", "genre": "electronic", "energy": 0.60, "valence": 0.52, "plays": 7},
            {"song": "Someone Like You - Adele", "mood": "sad", "genre": "ballad", "energy": 0.22, "valence": 0.15, "plays": 25},
            {"song": "Fix You - Coldplay", "mood": "sad", "genre": "rock", "energy": 0.30, "valence": 0.20, "plays": 30},
            {"song": "Let Her Go - Passenger", "mood": "sad", "genre": "acoustic", "energy": 0.25, "valence": 0.18, "plays": 14},
            {"song": "Memories - Maroon 5", "mood": "sad", "genre": "pop", "energy": 0.40, "valence": 0.32, "plays": 11},
            {"song": "Believer - Imagine Dragons", "mood": "energetic", "genre": "rock", "energy": 0.93, "valence": 0.70, "plays": 18},
            {"song": "Stronger - Kanye West", "mood": "energetic", "genre": "rap", "energy": 0.90, "valence": 0.78, "plays": 27},
            {"song": "Legends Never Die - League of Legends", "mood": "energetic", "genre": "anthem", "energy": 0.91, "valence": 0.65, "plays": 9},
            {"song": "Hall of Fame - The Script", "mood": "energetic", "genre": "pop", "energy": 0.84, "valence": 0.72, "plays": 16},
            {"song": "Weightless - Marconi Union", "mood": "focus", "genre": "ambient", "energy": 0.12, "valence": 0.30, "plays": 40},
            {"song": "Intro - The xx", "mood": "focus", "genre": "indie", "energy": 0.48, "valence": 0.50, "plays": 32},
            {"song": "Resonance - HOME", "mood": "focus", "genre": "synthwave", "energy": 0.65, "valence": 0.55, "plays": 21},
            {"song": "Strobe - deadmau5", "mood": "focus", "genre": "electronic", "energy": 0.70, "valence": 0.48, "plays": 13}
        ])

    def load_data(self):
        if os.path.exists(self.csv_path):
            try:
                self.df = pd.read_csv(self.csv_path)
            except Exception:
                self.df = self.get_default_dataset()
        else:
            self.df = self.get_default_dataset()
            self.df.to_csv(self.csv_path, index=False)

        # Standardize columns
        for col in ["song", "mood", "genre", "energy", "valence", "plays"]:
            if col not in self.df.columns:
                if col in ["energy", "valence"]:
                    self.df[col] = 0.5
                elif col == "plays":
                    self.df[col] = 0
                else:
                    self.df[col] = "unknown"

        self.df["mood"] = self.df["mood"].astype(str).str.lower()
        self.df["genre"] = self.df["genre"].astype(str).str.lower()
        self.df["song"] = self.df["song"].astype(str)
        self.df["energy"] = pd.to_numeric(self.df["energy"], errors="coerce").fillna(0.5)
        self.df["valence"] = pd.to_numeric(self.df["valence"], errors="coerce").fillna(0.5)
        self.df["plays"] = pd.to_numeric(self.df["plays"], errors="coerce").fillna(0).astype(int)

        self.rebuild_matrix()

    def rebuild_matrix(self):
        # Encode values
        mood_encoder = LabelEncoder()
        genre_encoder = LabelEncoder()
        
        mood_encoded = mood_encoder.fit_transform(self.df["mood"])
        genre_encoded = genre_encoder.fit_transform(self.df["genre"])
        
        energy_scaled = MinMaxScaler().fit_transform(self.df[["energy"]]).flatten()
        valence_scaled = MinMaxScaler().fit_transform(self.df[["valence"]]).flatten()

        features = np.column_stack([mood_encoded, genre_encoded, energy_scaled, valence_scaled])
        self.similarity_matrix = cosine_similarity(features)

    def recommend(self, mood: str, top_n: int = 5) -> List[dict]:
        mood = mood.strip().lower()
        filtered = self.df[self.df["mood"] == mood]
        
        if filtered.empty:
            # Return general tracks if mood isn't matching
            shuffled = self.df.sample(frac=1).reset_index(drop=True)
            return shuffled.head(top_n).to_dict('records')

        seed_index = random.choice(filtered.index.tolist())
        similarities = sorted(
            enumerate(self.similarity_matrix[seed_index]),
            key=lambda x: x[1],
            reverse=True,
        )

        picks = []
        seen_songs = set()
        
        for idx, score in similarities:
            row = self.df.iloc[idx]
            if row["song"] not in seen_songs and row["mood"] == mood:
                picks.append({
                    "song": row["song"],
                    "mood": row["mood"],
                    "genre": row["genre"],
                    "energy": float(row["energy"]),
                    "valence": float(row["valence"]),
                    "similarity": float(score)
                })
                seen_songs.add(row["song"])
            if len(picks) >= top_n * 2:
                break

        random.shuffle(picks)
        return picks[:top_n]

    def update_reinforcement(self, song_name: str, liked: bool):
        # Reinforcement Learning step: adjust song parameters based on live interaction
        idx = self.df[self.df["song"].str.lower() == song_name.lower()].index
        if not idx.empty:
            target_idx = idx[0]
            current_energy = self.df.at[target_idx, "energy"]
            current_valence = self.df.at[target_idx, "valence"]
            
            if liked:
                # User liked: bump up relevance / valence, increment plays
                self.df.at[target_idx, "plays"] += 1
                self.df.at[target_idx, "valence"] = min(1.0, current_valence + 0.05)
                # Boost energy matching mood slightly
                if self.df.at[target_idx, "mood"] in ["happy", "energetic"]:
                    self.df.at[target_idx, "energy"] = min(1.0, current_energy + 0.03)
            else:
                # User skipped / disliked: decrease valence vector
                self.df.at[target_idx, "valence"] = max(0.0, current_valence - 0.08)
                self.df.at[target_idx, "energy"] = max(0.0, current_energy - 0.04)

            self.df.to_csv(self.csv_path, index=False)
            self.rebuild_matrix()
            return True
        return False

recommender = MLMusicRecommender(CSV_PATH)

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class FaceExpressionData(BaseModel):
    landmarks: Optional[List[float]] = None
    expressions: Optional[dict] = None # e.g. {"happy": 0.8, "sad": 0.1...}
    image_base64: Optional[str] = None

class VoiceToneData(BaseModel):
    pitch_hz: Optional[float] = None
    volume_db: Optional[float] = None
    tempo_bpm: Optional[float] = None
    speech_transcript: Optional[str] = None

class TextJournalData(BaseModel):
    text: str

class RecommendationRequest(BaseModel):
    mood: str
    count: Optional[int] = 5

class FeedbackRequest(BaseModel):
    song: str
    liked: bool

# ---------------------------------------------------------------------------
# Microservice Routes
# ---------------------------------------------------------------------------

@app.post("/api/analyze-expression")
async def analyze_expression(data: FaceExpressionData):
    """
    Accepts facial expressions structure or landmarks from browser.
    Returns dominant emotion, valence/arousal maps.
    """
    # If the frontend sent direct expression probabilities (e.g. from face-api.js or simple webcams)
    if data.expressions:
        dominant = max(data.expressions, key=data.expressions.get)
        confidence = float(data.expressions[dominant])
        
        # Mapping to Core Emotion Wheel (valence/arousal)
        mappings = {
            "happy": {"valence": 0.85, "arousal": 0.70},
            "sad": {"valence": 0.15, "arousal": 0.20},
            "angry": {"valence": 0.10, "arousal": 0.85},
            "surprised": {"valence": 0.60, "arousal": 0.80},
            "neutral": {"valence": 0.50, "arousal": 0.40},
            "fearful": {"valence": 0.20, "arousal": 0.75},
            "disgusted": {"valence": 0.18, "arousal": 0.30}
        }
        
        state = mappings.get(dominant.lower(), {"valence": 0.5, "arousal": 0.5})
        return {
            "dominant_emotion": dominant,
            "valence": state["valence"],
            "arousal": state["arousal"],
            "confidence": confidence
        }

    # If landmarks coordinate list (float coordinates) is supplied:
    if data.landmarks and len(data.landmarks) > 0:
        # Landmark-based classifier simulation:
        # Distance measurements mapping eye aspect ratio (EAR) & mouth smile ratio
        # (simulating geometric calculations)
        smile_metric = float(random.uniform(0.1, 0.9))
        frown_metric = float(random.uniform(0.1, 0.8))
        
        if smile_metric > 0.6:
            emotion = "happy"
            val, aro = 0.82, 0.68
        elif frown_metric > 0.5:
            emotion = "sad"
            val, aro = 0.20, 0.22
        else:
            emotion = "neutral"
            val, aro = 0.50, 0.35

        return {
            "dominant_emotion": emotion,
            "valence": val,
            "arousal": aro,
            "confidence": 0.84
        }

    # Mock response if called empty
    emotions = ["happy", "sad", "chill", "energetic", "focus"]
    selected = random.choice(emotions)
    emotion_metrics = {
        "happy": {"val": 0.8, "aro": 0.7},
        "sad": {"val": 0.2, "aro": 0.2},
        "chill": {"val": 0.6, "aro": 0.3},
        "energetic": {"val": 0.7, "aro": 0.9},
        "focus": {"val": 0.5, "aro": 0.4}
      }
    return {
        "dominant_emotion": selected,
        "valence": emotion_metrics[selected]["val"],
        "arousal": emotion_metrics[selected]["aro"],
        "confidence": float(round(random.uniform(0.75, 0.95), 2))
    }

@app.post("/api/analyze-voice")
async def analyze_voice(data: VoiceToneData):
    """
    Analyzes audio descriptors (frequency pitch, audio amplitude, transcript text).
    """
    # Sentiment calculation using basic speech heuristics
    pitch = data.pitch_hz or 120.0
    volume = data.volume_db or -20.0
    tempo = data.tempo_bpm or 100.0
    
    # Calculate Valence (pleasurableness) & Arousal (energy intensity) from vocal features
    # High pitch + High tempo => High Arousal (Excited/Angry)
    # Low volume + Low tempo => Low Arousal (Sad/Calm)
    arousal = min(1.0, max(0.0, (pitch / 250.0) * 0.4 + (tempo / 150.0) * 0.4 + (volume + 40.0) / 40.0 * 0.2))
    
    # Determine dominant mood based on acoustic vectors
    if arousal > 0.7:
        if pitch > 180:
            dominant = "energetic"
            valence = 0.75
        else:
            dominant = "stressed"
            valence = 0.30
    elif arousal < 0.4:
        if volume < -25:
            dominant = "sad"
            valence = 0.22
        else:
            dominant = "chill"
            valence = 0.68
    else:
        dominant = "focused"
        valence = 0.50

    return {
        "dominant_emotion": dominant,
        "valence": float(round(valence, 2)),
        "arousal": float(round(arousal, 2)),
        "confidence": 0.81
    }

@app.post("/api/nlp-mood")
async def analyze_nlp_mood(data: TextJournalData):
    """
    Extracts core sentiment from diary entry.
    Queries Gemini if API key is present, otherwise falls back to a lexicon dictionary parser.
    """
    text = data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text journal must not be empty.")

    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [{
                        "text": f"""Analyze the emotional sentiment of this personal journal entry: "{text}".
                        Determine the primary mood (happy, sad, chill, energetic, focused, stressed), a valence score (0.0 to 1.0, where 0 is extremely negative/depressed and 1 is extremely happy/pleasurable), and an arousal score (0.0 to 1.0, where 0 is extremely calm/lethargic and 1 is extremely active/agitated).
                        
                        Return ONLY a valid JSON object matching this exact format:
                        {{
                          "mood": "happy",
                          "valence": 0.85,
                          "arousal": 0.7,
                          "summary": "One-sentence explanation of why they feel this way."
                        }}
                        Do not include any markdown styling."""
                    }]
                }]
            }
            res = requests.post(url, json=payload, timeout=10)
            if res.status_code == 200:
                result_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                # Strip markdown code fencing if API returned it
                if result_text.startswith("```json"):
                    result_text = result_text[7:-3]
                elif result_text.startswith("```"):
                    result_text = result_text[3:-3]
                    
                import json
                parsed = json.loads(result_text.strip())
                return parsed
        except Exception as e:
            print(f"[Gemini NLP fallback] Failed to request Gemini: {e}")

    # Lexicon Fallback (rule-based NLP)
    text_lower = text.lower()
    happy_words = ["happy", "glad", "joy", "excited", "awesome", "great", "love", "smile"]
    sad_words = ["sad", "depressed", "blue", "cry", "lonely", "unhappy", "hurt", "grief"]
    stressed_words = ["stress", "anxious", "worry", "panic", "tired", "burnout", "overwhelm", "pressure"]
    focus_words = ["focus", "work", "code", "learn", "study", "concentration", "deep", "mindful"]
    chill_words = ["chill", "relax", "calm", "peace", "rest", "sleep", "slow", "quiet"]

    scores = {
        "happy": sum(1 for w in happy_words if w in text_lower),
        "sad": sum(1 for w in sad_words if w in text_lower),
        "stressed": sum(1 for w in stressed_words if w in text_lower),
        "focused": sum(1 for w in focus_words if w in text_lower),
        "chill": sum(1 for w in chill_words if w in text_lower)
    }

    dominant = max(scores, key=scores.get)
    if scores[dominant] == 0:
        dominant = "chill" # default to calm chill

    metrics = {
        "happy": {"val": 0.80, "aro": 0.65, "summary": "Expression of joy and optimism detected."},
        "sad": {"val": 0.18, "aro": 0.20, "summary": "Feelings of sadness or emotional fatigue present."},
        "stressed": {"val": 0.30, "aro": 0.80, "summary": "High arousal and emotional stress signals detected."},
        "focused": {"val": 0.55, "aro": 0.45, "summary": "Productivity and cognitive concentration state."},
        "chill": {"val": 0.65, "aro": 0.25, "summary": "Calm, rested, or meditative emotional state."}
    }

    return {
        "mood": dominant,
        "valence": metrics[dominant]["val"],
        "arousal": metrics[dominant]["aro"],
        "summary": metrics[dominant]["summary"]
    }

@app.post("/api/recommend")
async def get_recommendations(req: RecommendationRequest):
    """
    Retrieves cosine-similarity items matching requested mood.
    """
    picks = recommender.recommend(req.mood, req.count)
    return {"recommendations": picks}

@app.post("/api/reinforcement-learn")
async def register_feedback(req: FeedbackRequest):
    """
    Adapts recommendation parameters dynamically by updating vector weight offsets.
    """
    success = recommender.update_reinforcement(req.song, req.liked)
    if not success:
        raise HTTPException(status_code=404, detail="Song not found in dataset")
    return {"status": "success", "message": f"Updated weights for: {req.song}"}

# ===========================================================================
# RAG Video Comparison Chatbot Endpoints
# ===========================================================================
class ProcessVideosRequest(BaseModel):
    url_a: str
    url_b: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    chat_history: List[ChatMessage]
    metadata_a: dict
    metadata_b: dict

@app.post("/api/process-videos")
async def api_process_videos(req: ProcessVideosRequest):
    try:
        logger = rag_service.logger
        logger.info(f"Processing Video A: {req.url_a}")
        video_a = rag_service.process_video(req.url_a, "A")
        
        logger.info(f"Processing Video B: {req.url_b}")
        video_b = rag_service.process_video(req.url_b, "B")
        
        return {
            "status": "success",
            "video_a": video_a["metadata"],
            "video_b": video_b["metadata"]
        }
    except Exception as e:
        rag_service.logger.error(f"Error in process-videos endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    try:
        history = [{"role": msg.role, "content": msg.content} for msg in req.chat_history]
        generator = rag_service.generate_chat_response(
            query=req.query,
            chat_history=history,
            metadata_a=req.metadata_a,
            metadata_b=req.metadata_b
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        rag_service.logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
