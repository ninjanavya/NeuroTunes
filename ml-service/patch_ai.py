import re

# 1. Update app.py
with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

import_code = """
import google.generativeai as genai
"""
if 'import google.generativeai' not in content:
    content = content.replace('from dotenv import load_dotenv', 'from dotenv import load_dotenv\n' + import_code)

api_code = """
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
"""
if 'GEMINI_API_KEY =' not in content:
    content = content.replace('YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()', 'YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()\n' + api_code)

route_code = """
@app.route("/api/generate_playlist", methods=["POST"])
def generate_playlist():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured. Please add GEMINI_API_KEY to .env"}), 400
    prompt = request.json.get("prompt", "")
    if not prompt:
        return jsonify({"error": "No prompt provided."}), 400
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
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
"""
if 'def generate_playlist():' not in content:
    content = content.replace('@app.route("/")', route_code + '\n@app.route("/")')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)


# 2. Update templates/index.html
with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

sidebar_dj = """
    <div class="panel" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.4);">
      <div class="nav-label" style="color:var(--accent);">🤖 AI DJ</div>
      <textarea id="aiPrompt" class="search-input" placeholder="e.g., Songs for a cyberpunk drive..." style="width:100%; height:60px; resize:none; margin-bottom:10px; font-size:12px;"></textarea>
      <button class="btn btn-primary btn-xs" style="width:100%" onclick="generateAIPlaylist()">Generate Playlist</button>
      <div id="aiStatus" class="status info" style="display:none; margin-top:10px; font-size:11px; padding:8px;"></div>
    </div>
"""
if 'aiPrompt' not in html:
    html = html.replace('<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border);', sidebar_dj + '\n    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border);')

js_code = """
async function generateAIPlaylist() {
  const prompt = document.getElementById('aiPrompt').value;
  if (!prompt) return;
  
  const statusEl = document.getElementById('aiStatus');
  statusEl.style.display = 'block';
  statusEl.className = 'status info';
  statusEl.textContent = 'Thinking... 🤖';
  showSection('home');
  
  try {
    const res = await fetch('/api/generate_playlist', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt})
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    statusEl.className = 'status success';
    statusEl.textContent = 'Queueing ' + data.songs.length + ' songs...';
    
    for (const song of data.songs) {
      await searchAndQueueSong(song);
    }
    statusEl.textContent = 'Playlist ready!';
    
    // Auto play if not playing
    if (playbackSource === 'none' && queue.length > 0) {
      currentIndex = queue.length - data.songs.length;
      playCurrent();
    }
  } catch(e) {
    statusEl.className = 'status error';
    statusEl.textContent = e.message;
  }
}

async function searchAndQueueSong(query) {
  try {
    const res = await fetch('/youtube-search', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({query}) });
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      queue.push(data.results[0]);
      renderQueue();
    }
  } catch(e) {}
}
"""
if 'generateAIPlaylist' not in html:
    html = html.replace('// ── Jam & AI (Basic) ──', '// ── Jam & AI (Basic) ──\n' + js_code)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Patch applied to app.py and index.html")
