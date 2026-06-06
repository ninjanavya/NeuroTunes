"use client";

import React, { useState } from 'react';
import { useVibe, Track } from '../../context/VibeContext';
import { 
  Users, 
  Layers, 
  Copy, 
  Plus, 
  Play, 
  SkipForward, 
  LogOut, 
  QrCode,
  Radio,
  CheckCircle2
} from 'lucide-react';

export default function JamPage() {
  const {
    username,
    jamRoom,
    createJamRoom,
    joinJamRoom,
    leaveJamRoom,
    nextJamSong,
    sendJamReaction,
    errorMsg,
    setErrorMsg
  } = useVibe();

  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // URL Auto-join parameter scanner
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && !jamRoom.code && username) {
      setErrorMsg(null);
      joinJamRoom(codeParam.toUpperCase());
      // Clean up URL parameter to avoid re-triggering
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [username, jamRoom.code]);

  const handleCreate = () => {
    setErrorMsg(null);
    createJamRoom();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setErrorMsg(null);
    joinJamRoom(inputCode.trim().toUpperCase());
  };

  const copyLink = () => {
    if (!jamRoom.code) return;
    const url = `${window.location.origin}/jam?code=${jamRoom.code}`;
    
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy link via API: ', err);
          fallbackCopy(url);
        });
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Prevent scrolling to bottom of page when focusing
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.warn('Fallback copy command returned unsuccessful.');
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
  };

  if (!username) return null;

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Cooperative Vibe Hub</span>
        <h2 className="text-3xl font-extrabold text-white mt-1">Jam Vibe Room</h2>
        <p className="text-slate-400 text-sm mt-1">Listen together in real time. Share playlist queues and synchronize playbacks with friends.</p>
      </div>

      {!jamRoom.code ? (
        /* Create or Join Entry view */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full mx-auto mt-6">
          
          {/* Create room */}
          <section className="glass-panel border border-white/5 rounded-3xl p-8 flex flex-col justify-between h-[280px]">
            <div>
              <h3 className="text-white font-extrabold text-xl mb-2 flex items-center gap-2">
                <Radio className="w-6 h-6 text-purple-400" /> Host Vibe Room
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">Initialize a new secure Jam Room. You will become the primary streaming broadcaster and manage QR sharing links.</p>
            </div>
            
            <button
              onClick={handleCreate}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" /> Host Jam Room
            </button>
          </section>

          {/* Join room */}
          <section className="glass-panel border border-white/5 rounded-3xl p-8 flex flex-col justify-between h-[280px]">
            <div>
              <h3 className="text-white font-extrabold text-xl mb-2 flex items-center gap-2">
                <Layers className="w-6 h-6 text-pink-400" /> Join Shared Session
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">Enter a 6-digit alphanumeric room passcode sent by a friend to synchronize playback feeds.</p>
            </div>

            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                required
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="ENTER CODE (E.G. XD82JK)"
                className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono uppercase tracking-widest text-center focus:outline-none focus:border-pink-500/50"
              />
              <button
                type="submit"
                className="bg-white text-slate-900 px-6 py-3 font-bold rounded-xl text-xs uppercase tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Join
              </button>
            </form>
          </section>

          {errorMsg && (
            <div className="md:col-span-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              ✕ {errorMsg}
            </div>
          )}

        </div>
      ) : (
        /* Active Jam Room dashboard view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Room sharing & member details */}
          <div className="flex flex-col gap-8">
            {/* Share settings */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Room Details</h3>
                <button
                  onClick={leaveJamRoom}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center gap-1.5 text-xs font-semibold"
                  title="Disconnect Room"
                >
                  <LogOut className="w-4 h-4" /> Disconnect
                </button>
              </div>

              {/* Room ID display */}
              <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center gap-1">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Active Room Code</span>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 font-mono tracking-wider">{jamRoom.code}</span>
              </div>

              {/* Share QR Mock & Link copy */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={copyLink}
                  className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copied link</> : <><Copy className="w-4 h-4" /> Copy Join Link</>}
                </button>
              </div>
            </section>

            {/* Members chips lists */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" /> Active Members ({jamRoom.members.length})
              </h3>
              
              <div className="flex flex-wrap gap-2.5">
                {jamRoom.members.map((name, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-slate-950/30 border border-white/5 rounded-full px-3.5 py-1.5 text-xs text-slate-300 font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="capitalize">{name}</span>
                    {name === jamRoom.host && (
                      <span className="text-[8px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 py-0.2 rounded-md ml-1">Host</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right panel: Active playlist and queue syncing */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Active song status */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-2">Synchronized Stream Feed</span>
              {jamRoom.activeSong ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-950/20 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-purple-400 animate-spin-slow" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white max-w-[280px] truncate">{jamRoom.activeSong.title}</span>
                        <span className="text-[10px] text-slate-500">Broadcasting via {jamRoom.activeSong.addedBy || 'Broadcaster'}</span>
                      </div>
                    </div>

                    {username === jamRoom.host ? (
                      <button
                        onClick={nextJamSong}
                        className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold pointer-events-auto"
                      >
                        <SkipForward className="w-4 h-4 fill-current" /> Next
                      </button>
                    ) : (
                      /* Collaborative reactions panel for members */
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => sendJamReaction('like')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                            jamRoom.reactions?.likes?.includes(username)
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          👍 Like
                        </button>
                        <button
                          onClick={() => sendJamReaction('dislike')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                            jamRoom.reactions?.dislikes?.includes(username)
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          👎 Dislike
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reaction Summary display */}
                  {((jamRoom.reactions?.likes?.length || 0) > 0 || (jamRoom.reactions?.dislikes?.length || 0) > 0) && (
                    <div className="flex flex-col gap-2 p-3 bg-slate-950/15 border border-white/5 rounded-xl text-xs text-slate-400">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Room Feedback</span>
                      <div className="flex flex-wrap gap-4">
                        {jamRoom.reactions?.likes && jamRoom.reactions.likes.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-semibold">👍 {jamRoom.reactions.likes.length} Likes:</span>
                            <span className="text-slate-300 capitalize">{jamRoom.reactions.likes.join(', ')}</span>
                          </div>
                        )}
                        {jamRoom.reactions?.dislikes && jamRoom.reactions.dislikes.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-rose-400 font-semibold">👎 {jamRoom.reactions.dislikes.length} Dislikes:</span>
                            <span className="text-slate-300 capitalize">{jamRoom.reactions.dislikes.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : jamRoom.queue.length > 0 ? (
                <div className="flex items-center justify-between p-4 bg-slate-950/20 border border-white/5 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Queue has {jamRoom.queue.length} track(s) ready</span>
                    <span className="text-[10px] text-slate-500">
                      {username === jamRoom.host ? 'Ready to initiate the Jam session' : 'Waiting for host to start playback...'}
                    </span>
                  </div>
                  {username === jamRoom.host && (
                    <button
                      onClick={nextJamSong}
                      className="py-2.5 px-5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wide hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Jam
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Playback queue is currently empty. Add tracks from the Discover tab!
                </div>
              )}
            </section>

            {/* Vibe Queue list */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6 flex-grow">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-pink-400" /> Collaborative Vibe Queue
              </h3>

              {jamRoom.queue.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs leading-relaxed">
                  No tracks queued inside the Vibe Room. Open the 'Discover' tab, search any song, and click the '+ Jam' button to append here!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {jamRoom.queue.map((song, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/20 border border-white/5 hover:border-pink-500/20 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500">0{idx + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white truncate max-w-[280px]">{song.title}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5">Queued by {song.addedBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

        </div>
      )}
    </div>
  );
}
