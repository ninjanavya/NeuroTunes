import os
import random
import sqlite3
from datetime import datetime

import requests
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import LabelEncoder, MinMaxScaler

app = Flask(__name__)

YOUTUBE_API_KEY = "PASTE_YOUR_API_KEY_HERE"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "songs_dataset.csv")
DB_PATH = os.path.join(BASE_DIR, "neurotunes.db")
SONGS_DIR = os.path.join(BASE_DIR, "songs")


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
                if col == "energy":
                    self.df[col] = 0.5
                else:
                    self.df[col] = "unknown"

        self.df = self.df.dropna(subset=["song"]).reset_index(drop=True)
        self.df["mood"] = self.df["mood"].astype(str).str.lower()
        self.df["genre"] = self.df["genre"].astype(str).str.lower()
        self.df["song"] = self.df["song"].astype(str)
        self.df["energy"] = pd.to_numeric(self.df["energy"], errors="coerce").fillna(0.5)

        mood_encoder = LabelEncoder()
        genre_encoder = LabelEncoder()

        mood_encoded = mood_encoder.fit_transform(self.df["mood"])
        genre_encoded = genre_encoder.fit_transform(self.df["genre"])
        energy_scaled = MinMaxScaler().fit_transform(self.df[["energy"]]).flatten()

        features = np.column_stack([mood_encoded, genre_encoded, energy_scaled])
        self.similarity_matrix = cosine_similarity(features)

    def recommend(self, mood, top_n=5):
        mood = (mood or "").strip().lower()
        filtered = self.df[self.df["mood"] == mood]

        if filtered.empty:
            return []

        seed_index = random.choice(filtered.index.tolist())
        similarities = list(enumerate(self.similarity_matrix[seed_index]))
        similarities = sorted(similarities, key=lambda x: x[1], reverse=True)

        picks = []
        seen = set()
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


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS listening_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_name TEXT NOT NULL,
            source TEXT DEFAULT 'local',
            played_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def save_history(song_name, source="local"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO listening_history (song_name, source, played_at) VALUES (?, ?, ?)",
        (song_name, source, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()


def get_history(limit=8):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT song_name, source, played_at FROM listening_history ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"song": row[0], "source": row[1], "played_at": row[2]}
        for row in rows
    ]


def get_local_songs():
    songs = []
    if os.path.exists(SONGS_DIR):
        for file in os.listdir(SONGS_DIR):
            if file.lower().endswith(".mp3"):
                songs.append(
                    {
                        "song": file,
                        "display": os.path.splitext(file)[0],
                        "artist": "Local Track",
                        "mood": random.choice(["happy", "sad", "chill", "energetic"]),
                        "genre": random.choice(["pop", "lofi", "rock", "indie"]),
                        "energy": round(random.uniform(0.3, 0.95), 2),
                    }
                )
    return songs


@app.route("/")
def home():
    return HTML_PAGE


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
        if q in s["display"].lower() or q in s["song"].lower() or q in s["genre"].lower() or q in s["mood"].lower()
    ]
    return jsonify({"songs": results})


@app.route("/recommend", methods=["POST"])
def recommend_api():
    payload = request.get_json(silent=True) or {}
    mood = payload.get("mood", "")
    recs = recommender.recommend(mood)
    return jsonify(recs)


@app.route("/history")
def history_api():
    return jsonify({"history": get_history()})


@app.route("/track-play", methods=["POST"])
def track_play():
    payload = request.get_json(silent=True) or {}
    song_name = payload.get("song", "Unknown Song")
    source = payload.get("source", "local")
    save_history(song_name, source)
    return jsonify({"status": "ok"})


@app.route("/youtube-search")
def youtube_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": [], "error": "Empty query"})

    if not YOUTUBE_API_KEY or YOUTUBE_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return jsonify({"results": [], "error": "YouTube API key not configured"}), 400

    try:
        response = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": 6,
                "key": YOUTUBE_API_KEY,
            },
            timeout=15,
        )
        data = response.json()

        if "error" in data:
            return jsonify({"results": [], "error": data["error"]}), 400

        results = []
        for item in data.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            snippet = item.get("snippet", {})
            thumbs = snippet.get("thumbnails", {})
            thumb = ""
            if "medium" in thumbs:
                thumb = thumbs["medium"].get("url", "")
            elif "default" in thumbs:
                thumb = thumbs["default"].get("url", "")

            if video_id:
                results.append(
                    {
                        "videoId": video_id,
                        "title": snippet.get("title", "Untitled"),
                        "channel": snippet.get("channelTitle", "Unknown Channel"),
                        "thumbnail": thumb,
                    }
                )

        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"results": [], "error": str(e)}), 500


HTML_PAGE = r'''
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>NeuroTunes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #07070d;
  --surface: #10111b;
  --card: rgba(255,255,255,0.06);
  --card-2: rgba(255,255,255,0.09);
  --text: #f5f7fb;
  --muted: #a4acc4;
  --accent: #7c4dff;
  --accent-2: #9d7cff;
  --border: rgba(255,255,255,0.10);
  --success: #1ed760;
  --danger: #ff6b81;
}
body {
  font-family: 'Inter', sans-serif;
  background: radial-gradient(circle at top right, rgba(124,77,255,0.18), transparent 25%),
              radial-gradient(circle at bottom left, rgba(30,215,96,0.12), transparent 30%),
              var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
}
.app {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: 1fr 92px;
  grid-template-areas: "sidebar main" "player player";
  height: 100vh;
}
.sidebar {
  grid-area: sidebar;
  background: rgba(13,14,22,0.95);
  border-right: 1px solid var(--border);
  padding: 24px 18px;
  backdrop-filter: blur(16px);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.brand .icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--accent), #4020a0);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(124,77,255,0.35);
}
.brand h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: 24px;
  letter-spacing: 1px;
}
.nav-item {
  padding: 13px 14px;
  margin-bottom: 10px;
  border-radius: 12px;
  color: var(--muted);
  background: transparent;
  transition: 0.25s;
}
.nav-item:hover, .nav-item.active {
  background: var(--card-2);
  color: var(--text);
  transform: translateX(4px);
}
.moods {
  margin-top: 28px;
}
.section-label {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.mood-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mood-btn {
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: 0.25s;
}
.mood-btn:hover {
  background: rgba(124,77,255,0.18);
  border-color: rgba(124,77,255,0.45);
}
.main {
  grid-area: main;
  padding: 26px;
  overflow-y: auto;
}
.hero {
  background: linear-gradient(135deg, rgba(124,77,255,0.26), rgba(10,10,20,0.85));
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 28px;
  margin-bottom: 22px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
}
.hero h2 {
  font-size: 30px;
  margin-bottom: 10px;
}
.hero p {
  color: var(--muted);
  max-width: 700px;
}
.search-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr auto;
  gap: 12px;
  margin: 18px 0 26px;
}
.search-box, .yt-box {
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 14px 16px;
  border-radius: 14px;
  outline: none;
}
.action-btn {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border: none;
  color: white;
  padding: 14px 18px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(124,77,255,0.32);
}
.grid-title {
  font-size: 20px;
  margin-bottom: 14px;
}
.song-grid, .yt-grid, .history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
  transition: 0.25s ease;
  backdrop-filter: blur(12px);
}
.card:hover {
  transform: translateY(-6px) scale(1.01);
  border-color: rgba(124,77,255,0.45);
}
.art {
  height: 150px;
  background: linear-gradient(135deg, #25174f, #101223 65%, #07111d);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46px;
}
.card-body {
  padding: 16px;
}
.song-name {
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.4;
}
.song-meta {
  color: var(--muted);
  font-size: 14px;
  margin-bottom: 12px;
}
.inline-actions {
  display: flex;
  gap: 10px;
}
.small-btn {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.05);
  color: var(--text);
  cursor: pointer;
}
.small-btn.primary {
  background: rgba(124,77,255,0.18);
  border-color: rgba(124,77,255,0.35);
}
.yt-thumb {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}
.player {
  grid-area: player;
  background: rgba(8,10,18,0.98);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  padding: 14px 22px;
}
.now-playing {
  display: flex;
  flex-direction: column;
}
.now-playing .title {
  font-weight: 700;
}
.now-playing .sub {
  color: var(--muted);
  font-size: 13px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.control-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.06);
  color: white;
  cursor: pointer;
}
.control-btn.play {
  background: var(--success);
  color: black;
  border: none;
  font-weight: 800;
}
.player-right {
  justify-self: end;
  color: var(--muted);
  font-size: 13px;
}
.embed-wrap {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  margin-bottom: 26px;
}
.empty {
  color: var(--muted);
  padding: 24px 0;
}
.notice {
  color: #ffd580;
  margin-top: 10px;
  font-size: 14px;
}
@media (max-width: 980px) {
  .search-row {
    grid-template-columns: 1fr;
  }
  .app {
    grid-template-columns: 1fr;
    grid-template-areas: "main" "player";
  }
  .sidebar {
    display: none;
  }
  .player {
    grid-template-columns: 1fr;
    text-align: center;
    height: auto;
  }
  .player-right {
    justify-self: center;
  }
}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="icon">🎵</div>
      <h1>NeuroTunes</h1>
    </div>

    <div class="nav-item active">🏠 Home</div>
    <div class="nav-item">🎼 Library</div>
    <div class="nav-item">❤️ Favorites</div>
    <div class="nav-item">🕘 History</div>

    <div class="moods">
      <div class="section-label">Mood Engine</div>
      <div class="mood-btns">
        <button class="mood-btn" onclick="getRecommendations('happy')">Happy</button>
        <button class="mood-btn" onclick="getRecommendations('sad')">Sad</button>
        <button class="mood-btn" onclick="getRecommendations('chill')">Chill</button>
        <button class="mood-btn" onclick="getRecommendations('energetic')">Energetic</button>
      </div>
      <div class="notice">Tip: add your API key in app.py to enable YouTube search.</div>
    </div>
  </aside>

  <main class="main">
    <section class="hero">
      <h2>AI-Powered Music Experience</h2>
      <p>Search local songs, get mood-based recommendations, and instantly discover music from YouTube inside one premium-looking player built for demos and project showcases.</p>
    </section>

    <div class="search-row">
      <input class="search-box" id="localSearch" placeholder="Search local songs..." oninput="searchLocalSongs(this.value)">
      <input class="yt-box" id="ytSearch" placeholder="Search any song on YouTube...">
      <button class="action-btn" onclick="searchYouTube()">Search YouTube</button>
    </div>

    <div class="grid-title">Recommended for You</div>
    <div class="song-grid" id="recommendedGrid"></div>

    <div class="grid-title">Your Local Library</div>
    <div class="song-grid" id="libraryGrid"></div>

    <div class="grid-title">YouTube Results</div>
    <div class="yt-grid" id="youtubeGrid"></div>

    <div class="embed-wrap">
      <div class="grid-title" style="margin-bottom:12px;">Now Playing on YouTube</div>
      <div id="youtubePlayer" class="empty">Search a song on YouTube to play it here.</div>
    </div>

    <div class="grid-title">Listening History</div>
    <div class="history-grid" id="historyGrid"></div>
  </main>

  <footer class="player">
    <div class="now-playing">
      <span class="title" id="nowTitle">Nothing playing</span>
      <span class="sub" id="nowSub">Select a local song or YouTube result</span>
    </div>
    <div class="controls">
      <button class="control-btn" onclick="prevLocalSong()">⏮</button>
      <button class="control-btn play" id="playBtn" onclick="toggleLocalPlayback()">▶</button>
      <button class="control-btn" onclick="nextLocalSong()">⏭</button>
    </div>
    <div class="player-right" id="playerState">Local + YouTube Hybrid Player</div>
  </footer>
</div>

<script>
let localSongs = [];
let filteredSongs = [];
let currentIndex = -1;
let audio = new Audio();

audio.addEventListener('ended', nextLocalSong);

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadLocalSongs() {
  const grid = document.getElementById('libraryGrid');
  grid.innerHTML = '<div class="empty">Loading local songs...</div>';
  try {
    const res = await fetch('/songs');
    const data = await res.json();
    localSongs = data.songs || [];
    filteredSongs = [...localSongs];
    renderLocalSongs(filteredSongs);
  } catch (e) {
    grid.innerHTML = '<div class="empty">Could not load local songs.</div>';
  }
}

function renderLocalSongs(songs) {
  const grid = document.getElementById('libraryGrid');
  if (!songs.length) {
    grid.innerHTML = '<div class="empty">No local songs found. Put MP3 files inside the songs folder.</div>';
    return;
  }

  grid.innerHTML = songs.map(song => {
    const originalIndex = localSongs.findIndex(s => s.song === song.song);
    return `
      <div class="card">
        <div class="art">🎧</div>
        <div class="card-body">
          <div class="song-name">${escapeHtml(song.display)}</div>
          <div class="song-meta">${escapeHtml(song.genre)} • mood: ${escapeHtml(song.mood)}</div>
          <div class="inline-actions">
            <button class="small-btn primary" onclick="playLocalSong(${originalIndex})">Play</button>
            <button class="small-btn" onclick="trackPlay('${escapeHtml(song.display)}','local')">Track</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function searchLocalSongs(q) {
  try {
    const res = await fetch('/search?q=' + encodeURIComponent(q));
    const data = await res.json();
    filteredSongs = data.songs || [];
    renderLocalSongs(filteredSongs);
  } catch (e) {
    document.getElementById('libraryGrid').innerHTML = '<div class="empty">Search failed.</div>';
  }
}

function playLocalSong(index) {
  if (index < 0 || index >= localSongs.length) return;
  currentIndex = index;
  const song = localSongs[index];
  audio.src = '/audio/' + encodeURIComponent(song.song);
  audio.play();
  document.getElementById('playBtn').textContent = '⏸';
  document.getElementById('nowTitle').textContent = song.display;
  document.getElementById('nowSub').textContent = 'Playing local song';
  document.getElementById('playerState').textContent = 'Local playback active';
  trackPlay(song.display, 'local');
}

function toggleLocalPlayback() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    document.getElementById('playBtn').textContent = '⏸';
  } else {
    audio.pause();
    document.getElementById('playBtn').textContent = '▶';
  }
}

function nextLocalSong() {
  if (!localSongs.length) return;
  currentIndex = (currentIndex + 1) % localSongs.length;
  playLocalSong(currentIndex);
}

function prevLocalSong() {
  if (!localSongs.length) return;
  currentIndex = (currentIndex - 1 + localSongs.length) % localSongs.length;
  playLocalSong(currentIndex);
}

async function getRecommendations(mood) {
  const grid = document.getElementById('recommendedGrid');
  grid.innerHTML = '<div class="empty">Generating recommendations...</div>';
  try {
    const res = await fetch('/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood })
    });
    const songs = await res.json();
    if (!songs.length) {
      grid.innerHTML = '<div class="empty">No recommendations found for this mood.</div>';
      return;
    }
    grid.innerHTML = songs.map(name => `
      <div class="card">
        <div class="art">✨</div>
        <div class="card-body">
          <div class="song-name">${escapeHtml(name)}</div>
          <div class="song-meta">AI picked this for your ${escapeHtml(mood)} mood</div>
          <div class="inline-actions">
            <button class="small-btn primary" onclick="document.getElementById('ytSearch').value='${escapeHtml(name)}'; searchYouTube();">Find on YouTube</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty">Recommendation service unavailable.</div>';
  }
}

async function searchYouTube() {
  const query = document.getElementById('ytSearch').value.trim();
  const grid = document.getElementById('youtubeGrid');
  if (!query) {
    grid.innerHTML = '<div class="empty">Enter a song name to search on YouTube.</div>';
    return;
  }

  grid.innerHTML = '<div class="empty">Searching YouTube...</div>';
  try {
    const res = await fetch('/youtube-search?q=' + encodeURIComponent(query));
    const data = await res.json();

    if (data.error) {
      grid.innerHTML = '<div class="empty">' + escapeHtml(typeof data.error === 'string' ? data.error : 'YouTube search failed.') + '</div>';
      return;
    }

    if (!data.results || !data.results.length) {
      grid.innerHTML = '<div class="empty">No YouTube results found.</div>';
      return;
    }

    grid.innerHTML = data.results.map(item => `
      <div class="card">
        <img class="yt-thumb" src="${item.thumbnail}" alt="thumbnail">
        <div class="card-body">
          <div class="song-name">${escapeHtml(item.title)}</div>
          <div class="song-meta">${escapeHtml(item.channel)}</div>
          <div class="inline-actions">
            <button class="small-btn primary" onclick="playYouTube('${item.videoId}', '${escapeHtml(item.title)}')">Play</button>
            <button class="small-btn" onclick="trackPlay('${escapeHtml(item.title)}','youtube')">Track</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty">Could not contact YouTube search service.</div>';
  }
}

function playYouTube(videoId, title) {
  audio.pause();
  document.getElementById('playBtn').textContent = '▶';
  document.getElementById('youtubePlayer').innerHTML = `
    <iframe width="100%" height="420"
      src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      title="YouTube video player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen></iframe>
  `;
  document.getElementById('nowTitle').textContent = title;
  document.getElementById('nowSub').textContent = 'Playing from YouTube';
  document.getElementById('playerState').textContent = 'YouTube playback active';
  trackPlay(title, 'youtube');
}

async function trackPlay(song, source) {
  try {
    await fetch('/track-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song, source })
    });
    loadHistory();
  } catch (e) {}
}

async function loadHistory() {
  const grid = document.getElementById('historyGrid');
  try {
    const res = await fetch('/history');
    const data = await res.json();
    const history = data.history || [];

    if (!history.length) {
      grid.innerHTML = '<div class="empty">No listening history yet.</div>';
      return;
    }

    grid.innerHTML = history.map(item => `
      <div class="card">
        <div class="card-body">
          <div class="song-name">${escapeHtml(item.song)}</div>
          <div class="song-meta">Source: ${escapeHtml(item.source)}<br>${escapeHtml(item.played_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty">Could not load history.</div>';
  }
}

loadLocalSongs();
loadHistory();
getRecommendations('happy');
</script>
</body>
</html>
'''


if __name__ == "__main__":
    os.makedirs(SONGS_DIR, exist_ok=True)
    init_db()
    print("NeuroTunes is running at http://127.0.0.1:5000")
    print("Put local MP3 files in the songs folder.")
    app.run(debug=True, host="127.0.0.1", port=5000)