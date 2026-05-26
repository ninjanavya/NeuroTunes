"""
NeuroTunes — Unified AI Music Player + Jam Rooms
Combines local MP3 playback, AI mood recommendations, YouTube search,
collaborative Jam rooms with QR sharing, and listening history.
"""

import os
import io
import base64
import random
import string
import socket
import sqlite3
from datetime import datetime, timedelta

import requests
import numpy as np
import pandas as pd
import qrcode
from dotenv import load_dotenv

import google.generativeai as genai

from flask import render_template, Flask, request, jsonify, render_template_string, send_from_directory, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import LabelEncoder, MinMaxScaler

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

app = Flask(__name__)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

app.secret_key = os.environ.get("FLASK_SECRET_KEY", "neurotunes-secret-change-me")

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

PORT = int(os.environ.get("PORT", 5000))
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").strip()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "songs_dataset.csv")
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/neurotunes.db"
else:
    DB_PATH = os.path.join(BASE_DIR, "neurotunes.db")
SONGS_DIR = os.path.join(BASE_DIR, "songs")

jam_rooms = {}
ROOM_EXPIRY_HOURS = 2


# ---------------------------------------------------------------------------
# AI Music Recommender
# ---------------------------------------------------------------------------
class MusicRecommender:
    def __init__(self, csv_path):
        self.csv_path = csv_path
        self.df = None
        self.similarity_matrix = None
        self._load_and_prepare()

    def _default_dataset(self):
        return pd.DataFrame([
            {"song": "Blinding Lights", "mood": "happy", "genre": "pop", "energy": 0.95},
            {"song": "Levitating", "mood": "happy", "genre": "pop", "energy": 0.88},
            {"song": "Happy Now", "mood": "happy", "genre": "dance", "energy": 0.82},
            {"song": "Good Life", "mood": "happy", "genre": "electronic", "energy": 0.78},
            {"song": "Sunflower", "mood": "chill", "genre": "indie", "energy": 0.55},
            {"song": "Night Drive", "mood": "chill", "genre": "lofi", "energy": 0.35},
            {"song": "Ocean Eyes", "mood": "chill", "genre": "alternative", "energy": 0.42},
            {"song": "Afterglow", "mood": "chill", "genre": "ambient", "energy": 0.28},
            {"song": "Someone Like You", "mood": "sad", "genre": "ballad", "energy": 0.22},
            {"song": "Fix You", "mood": "sad", "genre": "rock", "energy": 0.30},
            {"song": "Let Her Go", "mood": "sad", "genre": "acoustic", "energy": 0.25},
            {"song": "Memories", "mood": "sad", "genre": "pop", "energy": 0.40},
            {"song": "Believer", "mood": "energetic", "genre": "rock", "energy": 0.93},
            {"song": "Stronger", "mood": "energetic", "genre": "electronic", "energy": 0.90},
            {"song": "Legends Never Die", "mood": "energetic", "genre": "anthem", "energy": 0.91},
            {"song": "Hall of Fame", "mood": "motivated", "genre": "pop", "energy": 0.84},
        ])

    def _load_and_prepare(self):
        if os.path.exists(self.csv_path):
            try:
                self.df = pd.read_csv(self.csv_path)
            except Exception:
                self.df = self._default_dataset()
        else:
            self.df = self._default_dataset()
            self.df.to_csv(self.csv_path, index=False)

        needed = ["song", "mood", "genre", "energy"]
        for col in needed:
            if col not in self.df.columns:
                self.df[col] = 0.5 if col == "energy" else "unknown"

        self.df = self.df.dropna(subset=["song"]).reset_index(drop=True)
        self.df["mood"] = self.df["mood"].astype(str).str.lower()
        self.df["genre"] = self.df["genre"].astype(str).str.lower()
        self.df["song"] = self.df["song"].astype(str)
        self.df["energy"] = pd.to_numeric(self.df["energy"], errors="coerce").fillna(0.5)

        mood_encoded = LabelEncoder().fit_transform(self.df["mood"])
        genre_encoded = LabelEncoder().fit_transform(self.df["genre"])
        energy_scaled = MinMaxScaler().fit_transform(self.df[["energy"]]).flatten()

        features = np.column_stack([mood_encoded, genre_encoded, energy_scaled])
        self.similarity_matrix = cosine_similarity(features)

    def recommend(self, mood, top_n=5):
        mood = (mood or "").strip().lower()
        filtered = self.df[self.df["mood"] == mood]
        if filtered.empty:
            return []

        seed_index = random.choice(filtered.index.tolist())
        similarities = sorted(
            enumerate(self.similarity_matrix[seed_index]),
            key=lambda x: x[1],
            reverse=True,
        )

        picks, seen = [], set()
        for idx, _ in similarities:
            song_name = self.df.iloc[idx]["song"]
            if song_name not in seen and self.df.iloc[idx]["mood"] == mood:
                picks.append(song_name)
                seen.add(song_name)
            if len(picks) >= 10:
                break

        random.shuffle(picks)
        return picks[:top_n]


recommender = MusicRecommender(CSV_PATH)


# ---------------------------------------------------------------------------
# SQLite Listening History
# ---------------------------------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS listening_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            song_name TEXT NOT NULL,
            source TEXT DEFAULT 'local',
            played_at TEXT NOT NULL
        )
    ''')
    try:
        conn.execute("ALTER TABLE listening_history ADD COLUMN user_id INTEGER")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()

# Initialize database on startup (needed for Vercel/serverless environments)
init_db()


def save_history(song_name, source="local"):
    user_id = session.get('user_id', 0)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO listening_history (user_id, song_name, source, played_at) VALUES (?, ?, ?, ?)",
        (user_id, song_name, source, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()


def get_history(limit=8):
    user_id = session.get('user_id', 0)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT song_name, source, played_at FROM listening_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"song": r[0], "source": r[1], "played_at": r[2]} for r in rows]


# ---------------------------------------------------------------------------
# Local Song Discovery
# ---------------------------------------------------------------------------
def get_local_songs():
    songs = []
    if os.path.exists(SONGS_DIR):
        for f in os.listdir(SONGS_DIR):
            if f.lower().endswith(".mp3"):
                songs.append({
                    "song": f,
                    "display": os.path.splitext(f)[0],
                    "artist": "Local Track",
                    "mood": random.choice(["happy", "sad", "chill", "energetic"]),
                    "genre": random.choice(["pop", "lofi", "rock", "indie"]),
                    "energy": round(random.uniform(0.3, 0.95), 2),
                })
    return songs


# ---------------------------------------------------------------------------
# Networking helpers
# ---------------------------------------------------------------------------
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def build_base_url():
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL.rstrip("/")
    return f"http://{get_local_ip()}:{PORT}"


# ---------------------------------------------------------------------------
# Jam Room helpers
# ---------------------------------------------------------------------------
def generate_room_code(length=6):
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if code not in jam_rooms:
            return code


def build_join_link(room_code):
    return f"{build_base_url()}/?room={room_code}"


def generate_qr_base64(text):
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def cleanup_expired_rooms():
    now = datetime.now()
    expired = [
        code for code, room in jam_rooms.items()
        if now - room.get("created_at", now) > timedelta(hours=ROOM_EXPIRY_HOURS)
    ]
    for code in expired:
        del jam_rooms[code]


def build_room_response(room_code):
    join_link = build_join_link(room_code)
    qr_b64 = generate_qr_base64(join_link)
    room_data = dict(jam_rooms[room_code])
    room_data.pop("created_at", None)
    return {
        "roomCode": room_code,
        "joinLink": join_link,
        "qrCode": f"data:image/png;base64,{qr_b64}",
        "room": room_data,
    }


# ---------------------------------------------------------------------------
# Unified HTML Page
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/login", methods=["GET"])
def login_page():
    return render_template("login.html")

@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"success": False, "error": "Missing fields"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password))
        )
        conn.commit()
        
        # Auto log in
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        session['user_id'] = user[0]
        session['username'] = username
        conn.close()
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"success": False, "error": "Username already taken."}), 400

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['username'] = username
        return jsonify({"success": True})
    
    return jsonify({"success": False, "error": "Invalid username or password."}), 401

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login_page'))



@app.route("/api/generate_playlist", methods=["POST"])
def generate_playlist():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured. Please add GEMINI_API_KEY to .env"}), 400
    prompt = request.json.get("prompt", "")
    if not prompt:
        return jsonify({"error": "No prompt provided."}), 400
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            f"You are an expert AI DJ. Based on this prompt: '{prompt}', generate a list of 5 exact song titles and their artists that perfectly match this vibe. "
            f"Return ONLY a valid JSON array of strings in this exact format: ['Song Title - Artist', 'Song Title - Artist']. Do not include any markdown, code blocks, or extra text."
        )
        
        import json
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
            
        songs = json.loads(text.strip())
        return jsonify({"songs": songs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("index.html", username=session.get('username'))


@app.route("/config")
def config_api():
    return jsonify({
        "public": bool(PUBLIC_BASE_URL),
        "baseUrl": build_base_url()
    })


@app.route("/songs")
def songs_api():
    return jsonify({"songs": get_local_songs()})


@app.route("/audio/<path:filename>")
def audio_file(filename):
    return send_from_directory(SONGS_DIR, filename)


@app.route("/search")
def local_search():
    q = request.args.get("q", "").strip().lower()
    songs = get_local_songs()
    if not q:
        return jsonify({"songs": songs})

    results = [
        s for s in songs
        if q in s["display"].lower() or q in s["genre"].lower() or q in s["mood"].lower()
    ]
    return jsonify({"songs": results})


@app.route("/recommend", methods=["POST"])
def recommend_api():
    payload = request.get_json(silent=True) or {}
    mood = payload.get("mood", "")
    return jsonify(recommender.recommend(mood))


@app.route("/history")
def history_api():
    return jsonify({"history": get_history()})


@app.route("/track-play", methods=["POST"])
def track_play():
    payload = request.get_json(silent=True) or {}
    save_history(payload.get("song", "Unknown"), payload.get("source", "local"))
    return jsonify({"status": "ok"})


@app.route("/youtube-search", methods=["POST"])
def youtube_search():
    try:
        data = request.get_json(silent=True) or {}
        query = str(data.get("query", "")).strip()

        if not query:
            return jsonify({"error": "Search query missing"}), 400

        if not YOUTUBE_API_KEY:
            return jsonify({"error": "YouTube API key not set. Add YOUTUBE_API_KEY to your .env file."}), 400

        r = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": 6,
                "key": YOUTUBE_API_KEY,
                "videoEmbeddable": "true",
                "videoSyndicated": "true",
                "regionCode": "IN",
            },
            timeout=20,
        )

        yt_data = r.json()
        if r.status_code != 200:
            return jsonify({"error": "YouTube API failed", "details": yt_data}), 400

        results = []
        for item in yt_data.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            title = item.get("snippet", {}).get("title", "Untitled")
            if video_id:
                results.append({"videoId": video_id, "title": title})

        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/jam-create", methods=["POST"])
def create_jam():
    cleanup_expired_rooms()
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "Guest").strip() or "Guest"
    room_code = generate_room_code()

    jam_rooms[room_code] = {
        "host": username,
        "members": [username],
        "queue": [],
        "activeSong": None,
        "isPlaying": False,
        "currentOffset": 0,
        "created_at": datetime.now(),
    }
    return jsonify(build_room_response(room_code))


@app.route("/jam-join", methods=["POST"])
def join_jam():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "Guest").strip() or "Guest"
    room_code = (data.get("roomCode") or "").strip().upper()

    if not room_code or room_code not in jam_rooms:
        return jsonify({"error": "Jam room not found"}), 404

    if username not in jam_rooms[room_code]["members"]:
        jam_rooms[room_code]["members"].append(username)

    return jsonify(build_room_response(room_code))


@app.route("/jam-add-song", methods=["POST"])
def add_song_to_jam():
    data = request.get_json(silent=True) or {}
    room_code = (data.get("roomCode") or "").strip().upper()
    username = (data.get("username") or "Guest").strip() or "Guest"
    song = data.get("song") or {}

    if not room_code or room_code not in jam_rooms:
      return jsonify({"error": "Jam room not found"}), 404

    video_id = song.get("videoId")
    title = song.get("title", "Untitled")

    if not video_id:
        return jsonify({"error": "Invalid song"}), 400

    existing = [s for s in jam_rooms[room_code]["queue"] if s["videoId"] == video_id]
    if existing:
        return jsonify({"error": "Song already in Jam queue"}), 400

    jam_rooms[room_code]["queue"].append({
        "videoId": video_id,
        "title": title,
        "addedBy": username,
    })

    if username not in jam_rooms[room_code]["members"]:
        jam_rooms[room_code]["members"].append(username)

    return jsonify(build_room_response(room_code))


@app.route("/jam/<room_code>", methods=["GET"])
def get_jam(room_code):
    room_code = room_code.strip().upper()
    if room_code not in jam_rooms:
        return jsonify({"error": "Jam room not found"}), 404
    return jsonify(build_room_response(room_code))


@app.route("/jam-update-playback", methods=["POST"])
def update_jam_playback():
    data = request.get_json(silent=True) or {}
    room_code = (data.get("roomCode") or "").strip().upper()
    
    if not room_code or room_code not in jam_rooms:
        return jsonify({"error": "Jam room not found"}), 404
        
    if "activeSong" in data:
        jam_rooms[room_code]["activeSong"] = data["activeSong"]
    if "isPlaying" in data:
        jam_rooms[room_code]["isPlaying"] = data["isPlaying"]
    if "currentOffset" in data:
        try:
            jam_rooms[room_code]["currentOffset"] = float(data["currentOffset"])
        except ValueError:
            pass
            
    return jsonify(build_room_response(room_code))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    os.makedirs(SONGS_DIR, exist_ok=True)
    init_db()

    print("NeuroTunes is running!")
    print(f"Local:   http://127.0.0.1:{PORT}")
    print(f"Network: http://{get_local_ip()}:{PORT}")
    if PUBLIC_BASE_URL:
        print(f"Public:  {PUBLIC_BASE_URL}")
    print(f"Put MP3 files in: {SONGS_DIR}")

    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
