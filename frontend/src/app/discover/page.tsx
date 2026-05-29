"use client";

import React, { useState } from 'react';
import { useVibe, Track } from '../../context/VibeContext';
import { Search, Play, Plus, ListMusic, Layers, Radio } from 'lucide-react';

export default function DiscoverPage() {
  const { playTrack, addToQueue, jamRoom, addSongToJam, emotion } = useVibe();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchLogs, setSearchLogs] = useState<string>('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setSearchLogs('Querying YouTube index database...');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
      const res = await fetch(`${apiUrl}/api/youtube-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() })
      });
      const data = await res.json();
      
      if (data.results) {
        setSearchResults(data.results);
        setSearchLogs(`Search completed. Found ${data.results.length} indexing streams.`);
      } else {
        setSearchLogs(data.error || 'Failed to search YouTube index.');
      }
    } catch (err) {
      setSearchLogs('Express backend offline. Check server console.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerPlay = (item: any) => {
    const track: Track = {
      videoId: item.videoId,
      title: item.title,
      artist: 'YouTube Audio Stream',
      source: 'youtube'
    };
    playTrack(track);
  };

  const triggerAddToQueue = (item: any) => {
    const track: Track = {
      videoId: item.videoId,
      title: item.title,
      artist: 'YouTube Audio Stream',
      source: 'youtube'
    };
    addToQueue(track);
  };

  const triggerAddToJam = (item: any) => {
    const track: Track = {
      videoId: item.videoId,
      title: item.title,
      artist: 'YouTube Audio Stream',
      source: 'youtube'
    };
    addSongToJam(track);
  };

  const accentShadows: Record<string, string> = {
    stressed: 'shadow-cyan-500/5 hover:border-cyan-500/30',
    energetic: 'shadow-pink-500/5 hover:border-pink-500/30',
    sad: 'shadow-indigo-500/5 hover:border-indigo-500/30',
    focused: 'shadow-emerald-500/5 hover:border-emerald-500/30',
    happy: 'shadow-purple-500/5 hover:border-purple-500/30',
  };

  const borderStyle = accentShadows[emotion] || accentShadows.happy;

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Global Discovery</span>
        <h2 className="text-3xl font-extrabold text-white mt-1">Discover Audio</h2>
        <p className="text-slate-400 text-sm mt-1">Search YouTube Indexing or local MP3 databases for custom vibes.</p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="w-full flex gap-3 max-w-2xl bg-slate-900/60 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, artist, genre or mood..."
          className="flex-grow bg-transparent px-4 py-3 text-sm text-white focus:outline-none placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-white text-slate-900 rounded-xl px-6 py-3 font-bold text-xs uppercase tracking-wide flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isLoading ? 'Searching...' : <><Search className="w-4 h-4" /> Query</>}
        </button>
      </form>

      {searchLogs && <p className="text-[10px] font-mono text-slate-500 -mt-4">{searchLogs}</p>}

      {/* Search Output Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {searchResults.map((item, index) => (
          <div
            key={index}
            className={`glass-panel border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-between p-4 shadow-lg transition-all duration-300 ${borderStyle} group`}
          >
            {/* Visualizer Thumbnail Mockup */}
            <div className="relative aspect-video rounded-xl bg-gradient-to-tr from-slate-900 to-slate-950 border border-white/5 overflow-hidden flex items-center justify-center mb-4">
              <div className="absolute inset-0 bg-slate-950/20 z-0"></div>
              {/* Dynamic waveform visualizer mock */}
              <div className="absolute bottom-4 inset-x-4 flex items-end justify-center gap-1 h-12 pointer-events-none opacity-40">
                <span className="w-1.5 h-6 bg-purple-500/70 rounded-full animate-pulse-slow"></span>
                <span className="w-1.5 h-10 bg-pink-500/70 rounded-full animate-pulse-slow [animation-delay:0.3s]"></span>
                <span className="w-1.5 h-4 bg-indigo-500/70 rounded-full animate-pulse-slow [animation-delay:0.1s]"></span>
                <span className="w-1.5 h-8 bg-cyan-500/70 rounded-full animate-pulse-slow [animation-delay:0.5s]"></span>
                <span className="w-1.5 h-5 bg-emerald-500/70 rounded-full animate-pulse-slow [animation-delay:0.2s]"></span>
              </div>
              <Radio className="w-8 h-8 text-slate-700 relative z-10 group-hover:scale-110 group-hover:text-purple-400 transition-all duration-300" />
            </div>

            {/* Meta Details */}
            <div className="flex-grow flex flex-col justify-between">
              <div>
                <h4 className="text-white font-bold text-sm tracking-wide line-clamp-2 leading-relaxed mb-3">{item.title}</h4>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => triggerPlay(item)}
                  className="w-full py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Stream
                </button>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => triggerAddToQueue(item)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:text-white hover:border-slate-700 transition-all"
                    title="Queue song locally"
                  >
                    <ListMusic className="w-3.5 h-3.5" /> Queue
                  </button>

                  {jamRoom.code && (
                    <button
                      onClick={() => triggerAddToJam(item)}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-indigo-600/30 hover:text-indigo-100 transition-all"
                      title="Add to shared Jam Room"
                    >
                      <Layers className="w-3.5 h-3.5" /> + Jam
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4">
          <Search className="w-12 h-12 text-slate-700" />
          <p className="text-xs max-w-sm text-center leading-relaxed">Search to index millions of digital tracks, customized for your emotional dashboard state.</p>
        </div>
      )}
    </div>
  );
}
