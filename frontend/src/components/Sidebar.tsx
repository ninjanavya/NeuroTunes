"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVibe, EmotionType } from '../context/VibeContext';
import { 
  Home, 
  Activity, 
  Search, 
  Disc, 
  Eye, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut,
  BrainCircuit,
  Menu,
  X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { emotion, username, logoutUser } = useVibe();
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Highlight color maps matching emotional states
  const accentColors: Record<EmotionType, string> = {
    stressed: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    energetic: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    sad: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    focused: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    happy: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  };

  const borderColors: Record<EmotionType, string> = {
    stressed: 'border-cyan-500/25',
    energetic: 'border-pink-500/25',
    sad: 'border-indigo-500/25',
    focused: 'border-emerald-500/25',
    happy: 'border-purple-500/25',
  };

  const glowColor = borderColors[emotion] || borderColors.happy;
  const activeStyle = accentColors[emotion] || accentColors.happy;

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Emotion Analyzer', path: '/emotion', icon: Activity },
    { name: 'Discover', path: '/discover', icon: Search },
    { name: 'AI Playlist Studio', path: '/studio', icon: Disc },
    { name: 'NeuroAura Visualizer', path: '/visualizer', icon: Eye },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Jam Vibe Room', path: '/jam', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (!username) return null;

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 glass-panel border-b border-white/5 flex items-center justify-between px-6 z-30">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <BrainCircuit className="w-5 h-5 animate-pulse-slow" />
          </div>
          <span className="text-white font-bold text-sm tracking-wide">NeuroTunes</span>
        </Link>

        <div className="flex items-center gap-4">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border border-white/5 font-semibold capitalize ${activeStyle.split(' ')[0]} bg-white/5`}>
            {emotion}
          </span>
          <button 
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Open Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Backdrop Drawer Overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Navigation Sidebar Drawer */}
      <aside className={`fixed left-0 top-0 h-screen w-64 glass-panel border-r ${glowColor} flex flex-col justify-between p-6 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Close Button for Mobile */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all absolute top-4 right-4"
          title="Close Menu"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col gap-6">
          <Link href="/dashboard" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <BrainCircuit className="w-6 h-6 animate-pulse-slow" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-wide">NeuroTunes</h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">AI OS v2030</span>
            </div>
          </Link>

          {/* Emotion HUD */}
          <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Realtime Vibe</span>
              <span className={`text-xs font-semibold capitalize tracking-wide ${activeStyle.split(' ')[0]}`}>{emotion}</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                emotion === 'stressed' ? 'bg-cyan-400' :
                emotion === 'energetic' ? 'bg-pink-400' :
                emotion === 'sad' ? 'bg-indigo-400' :
                emotion === 'focused' ? 'bg-emerald-400' : 'bg-purple-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                emotion === 'stressed' ? 'bg-cyan-500' :
                emotion === 'energetic' ? 'bg-pink-500' :
                emotion === 'sad' ? 'bg-indigo-500' :
                emotion === 'focused' ? 'bg-emerald-500' : 'bg-purple-500'
              }`}></span>
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-300 ${
                    isActive 
                      ? activeStyle 
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Actions Footer */}
        <div className="flex flex-col gap-4">
          <div className="h-[1px] bg-white/5 w-full"></div>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <span className="text-sm font-semibold capitalize">{username.charAt(0)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-white font-medium truncate max-w-[110px]">{username}</span>
                <span className="text-[9px] text-slate-500 font-semibold">Standard User</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsMobileOpen(false);
                logoutUser();
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
