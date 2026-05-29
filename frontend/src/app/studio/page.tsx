"use client";

import React, { useState } from 'react';
import { useVibe, Track } from '../../context/VibeContext';
import { Sparkles, Play, Plus, BookOpen, Compass, LineChart } from 'lucide-react';
import { ResponsiveContainer, LineChart as RechartLine, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function StudioPage() {
  const { playTrack, addToQueue, jamRoom, addSongToJam, emotion } = useVibe();
  
  const [prompt, setPrompt] = useState<string>('');
  const [aiSongs, setAiSongs] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Transition Curve Mock Data based on generated list
  const [transitionData, setTransitionData] = useState<any[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setTransitionData([]);
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
      const res = await fetch(`${apiUrl}/api/ai/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      const data = await res.json();

      if (data.songs) {
        setAiSongs(data.songs);
        setExplanation(data.explanation || 'AI DJ curated transitions configured.');
        
        // Calculate dynamic valence curve for display (e.g., transition curve)
        const curve = data.songs.map((songName: string, index: number) => {
          const songsCount = data.songs.length;
          // Calculate valence mapping (e.g. rising valence or custom curve)
          let v = 0.4 + (index / (songsCount - 1)) * 0.45;
          let a = 0.3 + (index / (songsCount - 1)) * 0.5;

          if (prompt.toLowerCase().includes('sad')) {
            v = 0.2 + (index / (songsCount - 1)) * 0.65;
            a = 0.25 + (index / (songsCount - 1)) * 0.6;
          } else if (prompt.toLowerCase().includes('focus') || prompt.toLowerCase().includes('code')) {
            v = 0.5;
            a = 0.35 + (index / (songsCount - 1)) * 0.15;
          }
          
          return {
            name: `Track ${index + 1}`,
            valence: parseFloat(v.toFixed(2)),
            arousal: parseFloat(a.toFixed(2))
          };
        });
        setTransitionData(curve);
      } else {
        setError(data.error || 'Failed to generate playlist.');
      }
    } catch (err) {
      setError('Express server connection failed. Please ensure backend-node is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAI = async (songStr: string) => {
    // Song format: "Song Name - Artist"
    const splitIndex = songStr.indexOf('-');
    let title = songStr;
    let artist = 'AI Recommendation';
    
    if (splitIndex !== -1) {
      title = songStr.substring(0, splitIndex).trim();
      artist = songStr.substring(splitIndex + 1).trim();
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${apiUrl}/api/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: songStr })
      });
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const track: Track = {
          videoId: data.results[0].videoId,
          title,
          artist,
          source: 'youtube'
        };
        playTrack(track);
      } else {
        const track: Track = {
          videoId: 'dQw4w9WgXcQ',
          title,
          artist,
          source: 'youtube'
        };
        playTrack(track);
      }
    } catch (err) {
      console.error('Failed to resolve AI song:', err);
      const track: Track = {
        videoId: 'dQw4w9WgXcQ',
        title,
        artist,
        source: 'youtube'
      };
      playTrack(track);
    }
  };

  const handleQueueAI = async (songStr: string) => {
    const splitIndex = songStr.indexOf('-');
    let title = songStr;
    let artist = 'AI Recommendation';
    
    if (splitIndex !== -1) {
      title = songStr.substring(0, splitIndex).trim();
      artist = songStr.substring(splitIndex + 1).trim();
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${apiUrl}/api/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: songStr })
      });
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const track: Track = {
          videoId: data.results[0].videoId,
          title,
          artist,
          source: 'youtube'
        };
        addToQueue(track);
      } else {
        const track: Track = {
          videoId: 'dQw4w9WgXcQ',
          title,
          artist,
          source: 'youtube'
        };
        addToQueue(track);
      }
    } catch (err) {
      console.error('Failed to resolve AI queue song:', err);
      const track: Track = {
        videoId: 'dQw4w9WgXcQ',
        title,
        artist,
        source: 'youtube'
      };
      addToQueue(track);
    }
  };

  const handleAddToJamAI = async (songStr: string) => {
    const splitIndex = songStr.indexOf('-');
    let title = songStr;
    let artist = 'AI Recommendation';
    
    if (splitIndex !== -1) {
      title = songStr.substring(0, splitIndex).trim();
      artist = songStr.substring(splitIndex + 1).trim();
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${apiUrl}/api/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: songStr })
      });
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const track: Track = {
          videoId: data.results[0].videoId,
          title,
          artist,
          source: 'youtube'
        };
        addSongToJam(track);
      } else {
        const track: Track = {
          videoId: 'dQw4w9WgXcQ',
          title,
          artist,
          source: 'youtube'
        };
        addSongToJam(track);
      }
    } catch (err) {
      console.error('Failed to resolve AI Jam song:', err);
      const track: Track = {
        videoId: 'dQw4w9WgXcQ',
        title,
        artist,
        source: 'youtube'
      };
      addSongToJam(track);
    }
  };

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Neural Curation</span>
        <h2 className="text-3xl font-extrabold text-white mt-1">AI Playlist Studio</h2>
        <p className="text-slate-400 text-sm mt-1">Prompt the AI DJ to curate transitional soundscapes that guide your cognitive and emotional state.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between h-[450px]">
          <div>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Curation Prompt
            </h3>
            <p className="text-slate-400 text-xs mb-6">Describe your starting feeling and your desired goal state (e.g. "I am feeling stressed and need to transition to a calm study focus").</p>
            
            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type your emotional pathway instruction..."
                className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 resize-none h-[140px]"
              />

              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs uppercase tracking-wide rounded-xl disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {isLoading ? 'Assembling tracks...' : <><Sparkles className="w-4 h-4 fill-current" /> Curate Pathway</>}
              </button>
            </form>
          </div>
          
          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-4">
            <Compass className="w-4 h-4 text-slate-600" /> GEMINI CORE LOADED
          </div>
        </section>

        {/* Results Panel */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Transition Curve Chart */}
          {transitionData.length > 0 && (
            <section className="glass-panel border border-white/5 rounded-3xl p-6">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <LineChart className="w-4 h-4 text-emerald-400" /> Planned Emotional Transition Curve (Valence / Arousal)
              </h3>
              
              <div className="w-full h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartLine data={transitionData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis dataKey="name" stroke="#475569" fontSize={8} />
                    <YAxis stroke="#475569" fontSize={8} domain={[0, 1]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '9px', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="valence" stroke="#8b5cf6" strokeWidth={1.5} name="Valence (Positivity)" />
                    <Line type="monotone" dataKey="arousal" stroke="#ec4899" strokeWidth={1.5} name="Arousal (Energy)" />
                  </RechartLine>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Song curation list */}
          <section className="glass-panel border border-white/5 rounded-3xl p-6 flex-grow flex flex-col justify-between">
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Curated Pathway Playlist
              </h3>
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></span>
                  <span className="text-slate-500 text-xs">AI is designing transitional pathways...</span>
                </div>
              ) : aiSongs.length === 0 ? (
                <div className="text-center py-24 text-slate-500 text-xs leading-relaxed">
                  {error ? (
                    <span className="text-rose-400 font-mono">{error}</span>
                  ) : (
                    'Enter a playlist pathway query on the left. E.g. "I feel tired and want to end up motivated for code focus."'
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {aiSongs.map((song, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/20 border border-white/5 hover:border-purple-500/20 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500">0{idx + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white truncate max-w-[280px]">{song}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePlayAI(song)}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" /> Play
                        </button>
                        <button
                          onClick={() => handleQueueAI(song)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:text-white hover:border-slate-700 transition-all"
                        >
                          <Plus className="w-2.5 h-2.5" /> Queue
                        </button>
                        {jamRoom.code && (
                          <button
                            onClick={() => handleAddToJamAI(song)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-indigo-600/30 hover:text-indigo-100 transition-all"
                          >
                            + Jam
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {explanation && (
              <div className="text-[10px] text-slate-400 bg-slate-950/30 border border-white/5 p-3 rounded-xl mt-6 leading-relaxed">
                <strong>Transition Strategy:</strong> {explanation}
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  );
}
