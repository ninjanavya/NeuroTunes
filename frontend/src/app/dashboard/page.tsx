"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVibe, EmotionType, Track } from '../../context/VibeContext';
import { 
  Smile, 
  Frown, 
  Flame, 
  Wind, 
  Target, 
  BrainCircuit, 
  Send, 
  Play, 
  Sparkles, 
  Compass, 
  Cpu
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { 
    username, 
    token, 
    emotion, 
    setEmotion, 
    playTrack, 
    isPlaying 
  } = useVibe();

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState<boolean>(false);

  // AI Companion Chat States
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    { sender: 'assistant', text: "Hello. I'm your NeuroTunes Companion. Tell me how your day is going, or ask me for support." }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Local tracks
  const [localSongs, setLocalSongs] = useState<any[]>([
    { title: "Blinding Lights - The Weeknd", videoId: "dQw4w9WgXcQ", mood: "happy", genre: "pop", energy: 0.95 },
    { title: "Weightless - Marconi Union", videoId: "UfcAVejsvU4", mood: "focus", genre: "ambient", energy: 0.12 },
    { title: "Fix You - Coldplay", videoId: "k4V3_GkykNU", mood: "sad", genre: "rock", energy: 0.30 },
    { title: "Night Drive - Lofi Chill", videoId: "5qap5aO4i9A", mood: "chill", genre: "lofi", energy: 0.35 },
    { title: "Stronger - Kanye West", videoId: "PsO6ZnUZI0g", mood: "energetic", genre: "rap", energy: 0.90 }
  ]);

  // Auth Guard redirect
  useEffect(() => {
    if (!token && !username) {
      router.push('/');
    }
  }, [token, username, router]);

  // Fetch ML recommendations whenever emotion state shifts
  useEffect(() => {
    if (!username) return;
    fetchRecommendations();
  }, [emotion, username]);

  const fetchRecommendations = async () => {
    setRecLoading(true);
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${mlUrl}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: emotion, count: 5 })
      });
      const data = await res.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (e) {
      console.warn('FastAPI recommendations failed, using local filter fallback:', e);
      // Fallback local filtering
      const filtered = localSongs.filter(s => s.mood === (emotion === 'focused' ? 'focus' : emotion === 'chill' ? 'chill' : emotion));
      setRecommendations(filtered.length > 0 ? filtered : localSongs.slice(0, 5));
    } finally {
      setRecLoading(false);
    }
  };

  // AI Companion interaction
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';

    try {
      // 1. Evaluate user emotion from text utilizing NLP
      const nlpRes = await fetch(`${mlUrl}/api/nlp-mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText })
      });
      const nlpData = await nlpRes.json();
      const detectedVibe = nlpData.mood;

      // Log detected mood state to database
      if (token) {
        await fetch(`${apiUrl}/api/moods`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            mood: detectedVibe,
            valence: nlpData.valence,
            arousal: nlpData.arousal,
            journalText: userText
          })
        });
      }

      // 2. Query Gemini API for emotional support and recommendation guidance
      const geminiRes = await fetch(`${apiUrl}/api/ai/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `The user said: "${userText}". I detected their mood is "${detectedVibe}". Say something supportive, tell them you are adapting their NeuroTunes theme, and suggest a type of playlist. Keep it to 2-3 sentences max.` 
        })
      });
      const geminiData = await geminiRes.json();
      
      let replyText = geminiData.explanation || `I hear you. I've shifted your NeuroTunes environment to the ${detectedVibe} mood configuration. Let's play some tracks to match your state.`;

      // Update global emotion state
      const nextEmotion: EmotionType = 
        detectedVibe === 'focus' ? 'focused' : 
        detectedVibe === 'stressed' ? 'stressed' :
        detectedVibe === 'sad' ? 'sad' :
        detectedVibe === 'happy' ? 'happy' :
        detectedVibe === 'energetic' ? 'energetic' : 'chill';

      setEmotion(nextEmotion);

      setChatMessages(prev => [...prev, { sender: 'assistant', text: replyText }]);
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { sender: 'assistant', text: "Forgive me, connection to my neural core was temporarily interrupted. How else can I assist you?" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePlayRecommended = async (rec: any) => {
    const songName = rec.song || rec.title;
    if (!songName) return;

    // Show loading state by temporarily disabling recommendation clicks or similar
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${apiUrl}/api/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: songName })
      });
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const track: Track = {
          videoId: data.results[0].videoId,
          title: songName,
          artist: rec.genre ? `${rec.genre.toUpperCase()} • ML Rec` : 'Bio-Adaptive Track',
          source: 'youtube'
        };
        playTrack(track);
      } else {
        // Fallback
        const track: Track = {
          videoId: 'dQw4w9WgXcQ',
          title: songName,
          artist: 'Bio-Adaptive Track (Fallback)',
          source: 'youtube'
        };
        playTrack(track);
      }
    } catch (err) {
      console.error('Failed to resolve recommended song:', err);
      const track: Track = {
        videoId: 'dQw4w9WgXcQ',
        title: songName,
        artist: 'Bio-Adaptive Track (Fallback)',
        source: 'youtube'
      };
      playTrack(track);
    }
  };

  // UI mappings
  const vibeBorders: Record<EmotionType, string> = {
    stressed: 'border-cyan-500/25 shadow-cyan-500/5',
    energetic: 'border-pink-500/25 shadow-pink-500/5',
    sad: 'border-indigo-500/25 shadow-indigo-500/5',
    focused: 'border-emerald-500/25 shadow-emerald-500/5',
    happy: 'border-purple-500/25 shadow-purple-500/5',
  };

  const vibeTints: Record<EmotionType, string> = {
    stressed: 'bg-cyan-500/10 text-cyan-400',
    energetic: 'bg-pink-500/10 text-pink-400',
    sad: 'bg-indigo-500/10 text-indigo-400',
    focused: 'bg-emerald-500/10 text-emerald-400',
    happy: 'bg-purple-500/10 text-purple-400',
  };

  const glowStyle = vibeBorders[emotion] || vibeBorders.happy;
  const activeTint = vibeTints[emotion] || vibeTints.happy;

  if (!username) return null;

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Dashboard HUD Header */}
      <header className={`glass-panel border ${glowStyle} rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-1000`}>
        <div>
          <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Active Core Module</span>
          <h2 className="text-3xl font-extrabold text-white mt-1">Hello, {username}</h2>
          <p className="text-slate-400 text-sm mt-1">Biometric emotional synthesis core is active and calibrated.</p>
        </div>

        {/* Biometric Telemetry */}
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 flex items-center gap-3 flex-1 md:flex-none min-w-[120px]">
            <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse-slow" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-bold">EEG Wave</span>
              <span className="text-xs text-white font-semibold">Alpha (10.2 Hz)</span>
            </div>
          </div>
          
          <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 flex items-center gap-3 flex-1 md:flex-none min-w-[120px]">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-bold">ML Variance</span>
              <span className="text-xs text-white font-semibold">Valence {emotion === 'sad' ? '0.2' : '0.8'}</span>
            </div>
          </div>
        </div>
      </header>


      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Grid: Vibe Shift & Recommender */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Vibe Shifter Panel */}
          <section className="glass-panel border border-white/5 rounded-3xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-400" /> Shifter Controls
            </h3>
            <p className="text-slate-400 text-xs mb-6">Manually override the AI engine to shift UI aesthetics, particle visualizers, and music queues.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              {[
                { type: 'happy', label: 'Happy', icon: Smile, tint: 'hover:bg-purple-500/10 hover:text-purple-400 border-purple-500/20 text-purple-300' },
                { type: 'sad', label: 'Sad', icon: Frown, tint: 'hover:bg-indigo-500/10 hover:text-indigo-400 border-indigo-500/20 text-indigo-300' },
                { type: 'chill', label: 'Chill', icon: Wind, tint: 'hover:bg-blue-500/10 hover:text-blue-400 border-blue-500/20 text-blue-300' },
                { type: 'energetic', label: 'Energetic', icon: Flame, tint: 'hover:bg-pink-500/10 hover:text-pink-400 border-pink-500/20 text-pink-300' },
                { type: 'focused', label: 'Focus', icon: Target, tint: 'hover:bg-emerald-500/10 hover:text-emerald-400 border-emerald-500/20 text-emerald-300' }
              ].map((btn) => {
                const Icon = btn.icon;
                const isSelected = emotion === btn.type || (btn.type === 'chill' && emotion === 'stressed');
                return (
                  <button
                    key={btn.type}
                    onClick={() => setEmotion(btn.type as EmotionType)}
                    className={`flex flex-col items-center gap-2.5 py-4 px-3 rounded-2xl border transition-all duration-300 ${
                      isSelected 
                        ? activeTint + ' border-current scale-[1.03] shadow-md shadow-purple-500/5' 
                        : 'border-white/5 bg-slate-900/30 text-slate-400 ' + btn.tint
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-semibold">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Recommendations list */}
          <section className="glass-panel border border-white/5 rounded-3xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" /> AI Emotion-Aware Recommendations
            </h3>
            
            {recLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
                <span className="text-slate-500 text-xs font-medium">Running vector similarity search...</span>
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No AI recommendations computed for this vibe yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    onClick={() => handlePlayRecommended(rec)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/20 border border-white/5 hover:border-purple-500/30 hover:bg-slate-950/50 cursor-pointer transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold group-hover:bg-purple-500 group-hover:text-white transition-colors">
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white truncate max-w-[280px]">{rec.song || rec.title}</span>
                        <span className="text-[10px] text-slate-500 capitalize">{rec.genre || 'Soundscape'} • {rec.mood || 'Vibe'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {rec.similarity && (
                        <span className="text-[10px] font-mono text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          {Math.round(rec.similarity * 100)}% Sim
                        </span>
                      )}
                      <button className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white text-slate-400 group-hover:text-slate-900 flex items-center justify-center transition-all">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Grid: AI Companion Chat widget */}
        <div className="flex flex-col gap-8">
          <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between h-[510px]">
            <div>
              <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-pink-400" /> AI Music Companion
              </h3>
              <p className="text-slate-400 text-xs mb-4">Chat with the assistant to receive emotional wellness feedback, playlist suggestions, and adaptive pacing.</p>
              
              {/* Chat Output */}
              <div className="h-[310px] overflow-y-auto flex flex-col gap-3 pr-2 scroll-chat">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-purple-600/25 border border-purple-500/30 text-purple-100 self-end rounded-br-none'
                        : 'bg-slate-950/50 border border-white/5 text-slate-300 self-start rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-slate-950/50 border border-white/5 text-slate-500 self-start rounded-2xl rounded-bl-none p-3.5 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.5s]"></span>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type how you feel..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>

      </div>
    </div>
  );
}
