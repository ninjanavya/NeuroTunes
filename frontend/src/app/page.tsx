"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVibe } from '../context/VibeContext';
import { BrainCircuit, Play, ShieldAlert, Sparkles, UserPlus, Lock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { username, token, loginUser } = useVibe();
  
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [formUser, setFormUser] = useState<string>('');
  const [formPass, setFormPass] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Redirect if logged in
  useEffect(() => {
    if (username && token) {
      router.push('/calibrate');
    }
  }, [username, token, router]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formUser, password: formPass }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        loginUser(data.token, data.username);
        router.push('/calibrate');
      } else {
        setAuthError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setAuthError('Connection error to Express server. Please verify backend-node is online.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 md:px-12 py-24 relative overflow-hidden bg-radial-gradient">
      {/* Cinematic Glowing Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow [animation-delay:2s]"></div>

      {/* Hero Content */}
      <div className="max-w-4xl text-center flex flex-col items-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/5 text-purple-400 text-xs font-semibold mb-6 uppercase tracking-wider animate-float">
          <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Music Engine
        </div>

        <h1 className="text-5xl md:text-8xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Neuro<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">Tunes</span>
        </h1>

        <p className="text-slate-400 text-base md:text-xl font-light max-w-2xl leading-relaxed mb-10">
          Experience the first bio-adaptive music platform. NeuroTunes harmonizes real-time facial analytics, journaling sentiment, and voice pitch into responsive cyberpunk soundscapes.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => {
              setIsLogin(true);
              setShowAuthModal(true);
            }}
            className="px-8 py-4 rounded-xl bg-white text-slate-900 font-bold hover:scale-[1.03] transition-all shadow-lg flex items-center gap-2 group"
          >
            <Play className="w-5 h-5 fill-current text-slate-900 group-hover:translate-x-0.5 transition-transform" /> Enter Platform
          </button>
          
          <button
            onClick={() => {
              setIsLogin(false);
              setShowAuthModal(true);
            }}
            className="px-8 py-4 rounded-xl bg-slate-900/60 text-white font-bold border border-slate-800 hover:border-slate-700 hover:scale-[1.03] transition-all backdrop-blur-md flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" /> Initialize System
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 z-10">
        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:border-purple-500/20 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
            <BrainCircuit className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-white text-lg font-bold mb-2">Multimodal Emotion Scanning</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Real-time biometric analytics utilizing camera facial mapping, voice sentiment processing, and NLP semantic journals.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:border-pink-500/20 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-4">
            <Play className="w-6 h-6 text-pink-400" />
          </div>
          <h3 className="text-white text-lg font-bold mb-2">Soundtrack Synthesis</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Adaptive recommendation loops using cosine-similarity ranking and custom reinforcement skip feedback parameters.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:border-indigo-500/20 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-white text-lg font-bold mb-2">Cooperative Vibe Rooms</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Create high-fidelity Socket.IO Jam rooms with QR sharing, allowing friends to synchronize queues and music playback states.
          </p>
        </div>
      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md glass-panel border border-white/10 rounded-2xl p-8 relative shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthError(null);
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              ✕
            </button>

            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
              {isLogin ? 'Access Platform Terminal' : 'Initialize Personal Vibe Profile'}
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              {isLogin ? 'Enter security passcode to unlock biometric dashboard.' : 'Configure credentials to start bio-adaptive streaming.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Username / Node ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cyber_jock"
                  value={formUser}
                  onChange={(e) => setFormUser(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Passcode / Key</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formPass}
                  onChange={(e) => setFormPass(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:opacity-95 disabled:opacity-50 transition-opacity mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Verifying Neural Grid...' : isLogin ? 'Access Terminal' : 'Initialize Profile'}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setAuthError(null);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {isLogin ? "Need a profile? Initialize here" : 'Already configured? Access credentials'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
