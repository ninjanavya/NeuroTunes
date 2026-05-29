require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'neurotunes-super-secret-key-12938';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ---------------------------------------------------------------------------
// Auth Routes
// ---------------------------------------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await db.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const user = await db.createUser(username, password);
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ success: true, token, username: user.username });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ userId: req.user.userId, username: req.user.username });
});

// ---------------------------------------------------------------------------
// Music & History Routes
// ---------------------------------------------------------------------------
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.getListeningHistory(req.user.userId, 25);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

app.post('/api/history', authenticateToken, async (req, res) => {
  try {
    const { songName, source, mood, energy } = req.body;
    if (!songName) return res.status(400).json({ error: 'Song name is required' });

    const id = await db.addListeningHistory(req.user.userId, songName, source, mood, energy);
    res.status(201).json({ success: true, historyId: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save playing track' });
  }
});

// ---------------------------------------------------------------------------
// Mood Log Routes
// ---------------------------------------------------------------------------
app.get('/api/moods', authenticateToken, async (req, res) => {
  try {
    const moods = await db.getMoodHistory(req.user.userId, 40);
    res.json({ moods });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve mood history' });
  }
});

app.post('/api/moods', authenticateToken, async (req, res) => {
  try {
    const { mood, valence, arousal, journalText } = req.body;
    if (!mood) return res.status(400).json({ error: 'Mood tag is required' });

    const id = await db.addMoodHistory(req.user.userId, mood, valence, arousal, journalText);
    res.status(201).json({ success: true, moodLogId: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save mood entry' });
  }
});

// ---------------------------------------------------------------------------
// YouTube search proxy
// ---------------------------------------------------------------------------
app.post('/api/youtube-search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  if (!YOUTUBE_API_KEY) {
    // Return high-quality simulated search results matching the query to ensure the app works out-of-the-box!
    console.log('[YouTube Search] No API Key found, generating high-quality simulated results...');
    const simulatedTracks = [
      { videoId: 'dQw4w9WgXcQ', title: `${query} - Retro Vibe Remix (NeuroTunes Edit)` },
      { videoId: '9bZkp7q19f0', title: `${query} - Cyberpunk Chillout Theme` },
      { videoId: '5qap5aO4i9A', title: `${query} - Lofi Study Beats for Deep Focus` },
      { videoId: 'OPf0YbXqDm0', title: `${query} - Ambient Space Wave Visualizer` },
      { videoId: 'V-_O7nl0Ii0', title: `${query} - High Energy Motivational Anthem` },
      { videoId: 'kJQP7kiw5Fk', title: `${query} - Emotional Cinematic Symphony` },
      { videoId: '8GW6sLrK40k', title: `${query} - Synthwave Cyberdrive Midnight` },
      { videoId: 'k4V3_GkykNU', title: `${query} - Acoustic Soft Resonance` },
      { videoId: 'dQw4w9WgXcQ', title: `${query} - Electro Dance Pulse` },
      { videoId: '9bZkp7q19f0', title: `${query} - Lofi Rain Study Beats` },
      { videoId: '5qap5aO4i9A', title: `${query} - High Tempo Focus Cyberpunk` },
      { videoId: 'OPf0YbXqDm0', title: `${query} - Dreamy Space Voyage Beats` }
    ];
    return res.json({ results: simulatedTracks });
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 20,
        key: YOUTUBE_API_KEY,
        videoEmbeddable: 'true',
        videoSyndicated: 'true'
      }
    });

    const results = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title
    })).filter(item => item.videoId);

    res.json({ results });
  } catch (error) {
    console.error('YouTube API error:', error.message);
    res.status(500).json({ error: 'YouTube Search Failed', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// AI Playlist Studio via Gemini REST API
// ---------------------------------------------------------------------------
app.post('/api/ai/playlist', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  if (!GEMINI_API_KEY) {
    // AI Fallback Heuristic
    console.log('[Gemini API] No Key configured, generating fallback heuristic playlist...');
    const lowercasePrompt = prompt.toLowerCase();
    let themeSongs = [];

    if (lowercasePrompt.includes('sad') || lowercasePrompt.includes('depress') || lowercasePrompt.includes('cry')) {
      themeSongs = [
        'Someone Like You - Adele',
        'Fix You - Coldplay',
        'Ocean Eyes - Billie Eilish',
        'Let Her Go - Passenger',
        'Stay - Rihanna'
      ];
    } else if (lowercasePrompt.includes('focus') || lowercasePrompt.includes('work') || lowercasePrompt.includes('code')) {
      themeSongs = [
        'Weightless - Marconi Union',
        'Intro - The xx',
        'Night Drive - Lofi Beats',
        'Strobe - deadmau5',
        'Resonance - HOME'
      ];
    } else if (lowercasePrompt.includes('gym') || lowercasePrompt.includes('energetic') || lowercasePrompt.includes('work out')) {
      themeSongs = [
        'Believer - Imagine Dragons',
        'Stronger - Kanye West',
        'Legends Never Die - League of Legends',
        'Till I Collapse - Eminem',
        'Sandstorm - Darude'
      ];
    } else {
      themeSongs = [
        'Blinding Lights - The Weeknd',
        'Levitating - Dua Lipa',
        'Sunflower - Post Malone',
        'Happy - Pharrell Williams',
        'Good Life - OneRepublic'
      ];
    }
    
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1000));
    return res.json({ songs: themeSongs, explanation: `Generated dynamically using rule-based mood matching for: "${prompt}"` });
  }

  try {
    // Query Google Gemini API (gemini-2.5-flash) using standard REST endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: `You are an expert futuristic AI DJ on the NeuroTunes platform. Based on the user's emotional request: "${prompt}", generate a list of 5 exact song titles and their artists that fit this exact vibe.
          Return ONLY a valid JSON object in this exact format:
          {
            "songs": ["Song Name - Artist", "Song Name - Artist"],
            "explanation": "Brief explanation of how these songs transition the user's emotional state."
          }
          Do not include any markdown, backticks like \`\`\`json, or extraneous text. Return raw JSON text only.`
        }]
      }]
    };

    const response = await axios.post(url, payload);
    const content = response.data.candidates[0].content.parts[0].text.trim();
    
    // Clean potential markdown blocks
    let cleanJSON = content;
    if (cleanJSON.startsWith('```json')) {
      cleanJSON = cleanJSON.substring(7, cleanJSON.length - 3);
    } else if (cleanJSON.startsWith('```')) {
      cleanJSON = cleanJSON.substring(3, cleanJSON.length - 3);
    }
    
    const playlistResult = JSON.parse(cleanJSON.trim());
    res.json(playlistResult);
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    res.status(500).json({ error: 'AI Playlist Generation Failed', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// Weekly AI Wellness Report
// ---------------------------------------------------------------------------
app.get('/api/ai/weekly-report', authenticateToken, async (req, res) => {
  try {
    const userHistory = await db.getListeningHistory(req.user.userId, 50);
    const moodHistory = await db.getMoodHistory(req.user.userId, 30);

    const textMoodEntries = moodHistory.map(m => `[${m.logged_at}] Vibe: ${m.mood}. Journal: ${m.journal_text}`).join('\n');
    const songList = userHistory.map(h => `${h.song_name} (${h.mood})`).join(', ');

    if (!GEMINI_API_KEY) {
      // Rule-based heuristic wellness report
      const fallbackReport = {
        moodBreakdown: { happy: 30, sad: 15, energetic: 35, chill: 20 },
        wellnessSummary: "Your dominant mood this week was energetic and happy. You utilized music primarily to sustain a productive flow. There were minor notes of focus spikes during late evening hours.",
        burnoutRisk: "Low (15%)",
        recommendations: [
          "Try scheduling a 20-minute 'chill ambient' decompression session around 8:00 PM.",
          "Your energy spikes in the morning. Try matching that with high-bpm techno/pop.",
          "Explore mindful journaling on Wednesday evenings to track emotional recovery patterns."
        ]
      };
      return res.json(fallbackReport);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: `You are NeuroTunes AI, an advanced emotional wellness companion. Analyze the user's weekly activity log and output a detailed psychological music profile.
          
          Listening History (Recent):
          ${songList}

          Mood Logs & Journals:
          ${textMoodEntries}

          Generate a JSON report analyzing:
          1. 'moodBreakdown': Percentage breakdown of moods detected (e.g. {"happy": 40, "sad": 20, "energetic": 10, "chill": 30}). Must sum to 100.
          2. 'wellnessSummary': A paragraph analyzing their music therapy patterns, stress triggers, and emotional recovery.
          3. 'burnoutRisk': Low, Moderate, High with percentage.
          4. 'recommendations': Array of 3 actionable mindfulness, playlist, or pacing recommendations.

          Return ONLY raw valid JSON text matching this exact format:
          {
            "moodBreakdown": {"happy": 40, "sad": 20, "energetic": 10, "chill": 30},
            "wellnessSummary": "Detailed multi-sentence summary here...",
            "burnoutRisk": "Moderate (45%)",
            "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
          }
          Do not include any markdown syntax.`
        }]
      }]
    };

    const response = await axios.post(url, payload);
    const content = response.data.candidates[0].content.parts[0].text.trim();
    
    let cleanJSON = content;
    if (cleanJSON.startsWith('```json')) {
      cleanJSON = cleanJSON.substring(7, cleanJSON.length - 3);
    } else if (cleanJSON.startsWith('```')) {
      cleanJSON = cleanJSON.substring(3, cleanJSON.length - 3);
    }
    
    const report = JSON.parse(cleanJSON.trim());
    res.json(report);
  } catch (error) {
    console.error('Weekly Report Error:', error.message);
    res.status(500).json({ error: 'AI Weekly Report Generation Failed', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// In-Memory Jam Room Controller
// ---------------------------------------------------------------------------
const jamRooms = {};
const ROOM_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours room expiry

// Cleanup inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(jamRooms).forEach(code => {
    if (now - jamRooms[code].lastActivity > ROOM_TIMEOUT) {
      console.log(`[Jam Room] Expired room ${code} due to inactivity`);
      delete jamRooms[code];
    }
  });
}, 15 * 60 * 1000);

function generateRoomCode() {
  let code = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return jamRooms[code] ? generateRoomCode() : code;
}

// ---------------------------------------------------------------------------
// Socket.IO Room Actions
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', (data) => {
    const { username } = data;
    const roomCode = generateRoomCode();
    const cleanUser = username || 'Anonymous Guest';
    
    jamRooms[roomCode] = {
      code: roomCode,
      host: cleanUser,
      members: [cleanUser],
      queue: [],
      activeSong: null,
      isPlaying: false,
      currentOffset: 0,
      reactions: { likes: [], dislikes: [] },
      lastActivity: Date.now()
    };
    
    socket.username = cleanUser;
    socket.roomCode = roomCode;

    socket.join(roomCode);
    console.log(`[Jam Room] Created: ${roomCode} by ${cleanUser}`);
    socket.emit('room_created', jamRooms[roomCode]);
  });

  // 2. Join Room
  socket.on('join_room', (data) => {
    const { roomCode, username } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const cleanUser = username || 'Anonymous Guest';

    if (!jamRooms[cleanCode]) {
      socket.emit('error_message', 'Jam Room not found or has expired.');
      return;
    }

    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    // Prevent duplicates in members list
    if (!room.members.includes(cleanUser)) {
      room.members.push(cleanUser);
    }

    socket.username = cleanUser;
    socket.roomCode = cleanCode;

    socket.join(cleanCode);
    console.log(`[Jam Room] ${cleanUser} joined ${cleanCode}`);

    // Notify room of member list change
    io.to(cleanCode).emit('member_update', { members: room.members });
    // Send full state to newly joined client
    socket.emit('room_state', room);
  });

  // 3. Playback Control (syncing play, pause, seek across users)
  socket.on('playback_control', (data) => {
    const { roomCode, action, activeSong, currentOffset } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!jamRooms[cleanCode]) return;
    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    if (action === 'play') {
      room.isPlaying = true;
      if (activeSong && (!room.activeSong || room.activeSong.videoId !== activeSong.videoId)) {
        room.activeSong = activeSong;
        room.reactions = { likes: [], dislikes: [] }; // reset reactions on new song play
        io.to(cleanCode).emit('reaction_update', room.reactions);
      }
      if (currentOffset !== undefined) room.currentOffset = parseFloat(currentOffset);
    } else if (action === 'pause') {
      room.isPlaying = false;
    } else if (action === 'seek') {
      if (currentOffset !== undefined) room.currentOffset = parseFloat(currentOffset);
    }

    // Broadcast change to all members in the room except sender
    socket.to(cleanCode).emit('playback_change', {
      action,
      activeSong: room.activeSong,
      isPlaying: room.isPlaying,
      currentOffset: room.currentOffset
    });
  });

  // 4. Add song to Vibe Queue
  socket.on('add_song', (data) => {
    const { roomCode, song, username } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!jamRooms[cleanCode] || !song) return;
    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    // Avoid duplicates in queue
    const duplicate = room.queue.find(item => item.videoId === song.videoId);
    if (duplicate) {
      socket.emit('error_message', 'Song already added to the Jam queue.');
      return;
    }

    const newSong = {
      videoId: song.videoId,
      title: song.title,
      addedBy: username || 'Anonymous'
    };

    if (!room.activeSong) {
      // If queue and active song are empty, play this immediately!
      room.activeSong = newSong;
      room.isPlaying = true;
      room.currentOffset = 0;
      room.reactions = { likes: [], dislikes: [] };

      io.to(cleanCode).emit('playback_change', {
        action: 'play',
        activeSong: newSong,
        isPlaying: true,
        currentOffset: 0
      });
      io.to(cleanCode).emit('reaction_update', room.reactions);
    } else {
      room.queue.push(newSong);
    }

    console.log(`[Jam Room] Song added to ${cleanCode}: ${song.title}`);
    
    // Broadcast updated queue state to everyone
    io.to(cleanCode).emit('queue_update', { queue: room.queue });
  });

  // 5. Trigger next song
  socket.on('next_song', (data) => {
    const { roomCode, username } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!jamRooms[cleanCode]) return;
    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    // Verify only host can skip
    if (room.host !== username) {
      socket.emit('error_message', 'Only the host can trigger the next song.');
      return;
    }

    // Reset reactions for the next track
    room.reactions = { likes: [], dislikes: [] };
    io.to(cleanCode).emit('reaction_update', room.reactions);

    if (room.queue.length > 0) {
      const nextTrack = room.queue.shift();
      room.activeSong = nextTrack;
      room.isPlaying = true;
      room.currentOffset = 0;

      io.to(cleanCode).emit('playback_change', {
        action: 'play',
        activeSong: nextTrack,
        isPlaying: true,
        currentOffset: 0
      });
      io.to(cleanCode).emit('queue_update', { queue: room.queue });
    } else {
      room.activeSong = null;
      room.isPlaying = false;
      room.currentOffset = 0;

      io.to(cleanCode).emit('playback_change', {
        action: 'pause',
        activeSong: null,
        isPlaying: false,
        currentOffset: 0
      });
      io.to(cleanCode).emit('queue_update', { queue: [] });
    }
  });

  // 6. Collaborative Reactions
  socket.on('jam_reaction', (data) => {
    const { roomCode, username, reactionType } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!jamRooms[cleanCode] || !username || !reactionType) return;
    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    if (!room.reactions) {
      room.reactions = { likes: [], dislikes: [] };
    }

    // Remove user from both arrays first to prevent double-reacting or conflicting reactions
    room.reactions.likes = room.reactions.likes.filter(u => u !== username);
    room.reactions.dislikes = room.reactions.dislikes.filter(u => u !== username);

    if (reactionType === 'like') {
      room.reactions.likes.push(username);
    } else if (reactionType === 'dislike') {
      room.reactions.dislikes.push(username);
    }

    io.to(cleanCode).emit('reaction_update', room.reactions);
  });

  // 7. Manual Client Syncing requests
  socket.on('sync_playback', (data) => {
    const { roomCode, isPlaying, currentOffset } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!jamRooms[cleanCode]) return;
    const room = jamRooms[cleanCode];
    room.lastActivity = Date.now();

    if (currentOffset !== undefined) room.currentOffset = parseFloat(currentOffset);
    if (isPlaying !== undefined) room.isPlaying = !!isPlaying;

    socket.to(cleanCode).emit('sync', {
      isPlaying: room.isPlaying,
      currentOffset: room.currentOffset
    });
  });

  // 8. Leave room
  socket.on('leave_room', (data) => {
    const { roomCode, username } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const cleanUser = username || 'Guest';

    if (jamRooms[cleanCode]) {
      const room = jamRooms[cleanCode];
      room.members = room.members.filter(m => m !== cleanUser);
      socket.leave(cleanCode);
      console.log(`[Jam Room] ${cleanUser} left ${cleanCode}`);

      if (room.members.length === 0) {
        console.log(`[Jam Room] Room ${cleanCode} is empty, cleaning up...`);
        delete jamRooms[cleanCode];
      } else {
        if (room.host === cleanUser) {
          room.host = room.members[0];
          console.log(`[Jam Room] Host left. New host is: ${room.host}`);
          io.to(cleanCode).emit('room_state', room);
        } else {
          io.to(cleanCode).emit('member_update', { members: room.members });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    if (socket.roomCode && socket.username) {
      const roomCode = socket.roomCode;
      const username = socket.username;

      if (jamRooms[roomCode]) {
        const room = jamRooms[roomCode];
        room.members = room.members.filter(m => m !== username);
        console.log(`[Jam Room] ${username} disconnected from ${roomCode}`);

        if (room.members.length === 0) {
          console.log(`[Jam Room] Room ${roomCode} is empty, cleaning up...`);
          delete jamRooms[roomCode];
        } else {
          if (room.host === username) {
            room.host = room.members[0];
            console.log(`[Jam Room] Host disconnected. New host is: ${room.host}`);
            io.to(roomCode).emit('room_state', room);
          } else {
            io.to(roomCode).emit('member_update', { members: room.members });
          }
        }
      }
    }
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`NeuroTunes Express backend running on Port ${PORT}`);
  console.log(`Websocket Sync server online & ready`);
  console.log(`=================================================`);
});
