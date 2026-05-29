"use client";

import React, { useState } from 'react';
import { useVibe } from '../../context/VibeContext';
import { 
  Settings, 
  Cpu, 
  Smartphone, 
  HelpCircle, 
  ShieldCheck, 
  Key,
  Flame,
  Wind
} from 'lucide-react';

export default function SettingsPage() {
  const { username, logoutUser, emotion } = useVibe();

  // Simulations states
  const [eegSim, setEegSim] = useState<boolean>(true);
  const [arSim, setArSim] = useState<boolean>(false);
  const [hapticSim, setHapticSim] = useState<boolean>(true);

  // Integration states
  const [spotifyActive, setSpotifyActive] = useState<boolean>(false);
  const [ytmActive, setYtmActive] = useState<boolean>(true);

  const accentBorders: Record<string, string> = {
    stressed: 'hover:border-cyan-500/30 border-cyan-500/10',
    energetic: 'hover:border-pink-500/30 border-pink-500/10',
    sad: 'hover:border-indigo-500/30 border-indigo-500/10',
    focused: 'hover:border-emerald-500/30 border-emerald-500/10',
    happy: 'hover:border-purple-500/30 border-purple-500/10',
  };

  const borderStyle = accentBorders[emotion] || accentBorders.happy;

  if (!username) return null;

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Configuration Console</span>
        <h2 className="text-3xl font-extrabold text-white mt-1">Platform Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Configure security keys, configure third-party streams, and calibrate simulated neural interfaces.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Device Simulations */}
        <section className={`glass-panel border rounded-3xl p-6 flex flex-col gap-5 ${borderStyle.split(' ')[1]}`}>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" /> Simulated Neural Interfaces
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">Toggle futuristic telemetry interfaces to simulated EEG headsets, wearable haptic controllers, and projection hubs.</p>
          
          <div className="flex flex-col gap-4 mt-2">
            {/* Brainwave headset */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">EEG Headset Telemetry</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Stream simulated alpha/beta frequencies on dashboard HUD.</span>
              </div>
              <input
                type="checkbox"
                checked={eegSim}
                onChange={() => setEegSim(!eegSim)}
                className="w-9 h-5 bg-slate-800 rounded-full appearance-none checked:bg-purple-500 transition-colors relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>

            {/* AR Hologram */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">AR Hologram Projection</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Render simulated transparent spatial visualizer layouts.</span>
              </div>
              <input
                type="checkbox"
                checked={arSim}
                onChange={() => setArSim(!arSim)}
                className="w-9 h-5 bg-slate-800 rounded-full appearance-none checked:bg-purple-500 transition-colors relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>

            {/* Haptic vibrations */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">wearable Haptic feedback</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Simulate haptic pulse transients syncing valence transients.</span>
              </div>
              <input
                type="checkbox"
                checked={hapticSim}
                onChange={() => setHapticSim(!hapticSim)}
                className="w-9 h-5 bg-slate-800 rounded-full appearance-none checked:bg-purple-500 transition-colors relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>
          </div>
        </section>

        {/* Integration Hub */}
        <section className={`glass-panel border rounded-3xl p-6 flex flex-col gap-5 ${borderStyle.split(' ')[1]}`}>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-pink-400" /> API Integration Hub
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">Toggle platform API indexes to scrape recommendations directly from commercial libraries.</p>
          
          <div className="flex flex-col gap-4 mt-2">
            {/* Spotify integration */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Spotify API Link</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Scrape content catalogs via developer keys.</span>
              </div>
              <input
                type="checkbox"
                checked={spotifyActive}
                onChange={() => setSpotifyActive(!spotifyActive)}
                className="w-9 h-5 bg-slate-800 rounded-full appearance-none checked:bg-pink-500 transition-colors relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>

            {/* YouTube Music */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">YouTube Music Indexing</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Proxies search to Google developers libraries.</span>
              </div>
              <input
                type="checkbox"
                checked={ytmActive}
                disabled
                className="w-9 h-5 bg-slate-900 rounded-full appearance-none checked:bg-indigo-500 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white/40 before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 opacity-50"
              />
            </div>
          </div>
        </section>

        {/* Security and credentials info */}
        <section className="glass-panel border border-white/5 rounded-3xl p-6 md:col-span-2">
          <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Security Telemetry
          </h3>
          <p className="text-slate-400 text-xs mb-4">Authentication tokens are stored locally inside standard browser security cookies. Sessions expire automatically after 7 days.</p>
          
          <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1 text-xs">
              <div><span className="text-slate-500">Security Mod:</span> <span className="text-white font-mono font-semibold">JWT-RS256</span></div>
              <div><span className="text-slate-500">Auth Token:</span> <span className="text-emerald-400 font-mono">active_session_token_presence</span></div>
            </div>

            <button
              onClick={logoutUser}
              className="py-3 px-6 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/45 text-rose-400 rounded-xl font-bold text-xs uppercase tracking-wide transition-all"
            >
              Terminate Session (Sign Out)
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
