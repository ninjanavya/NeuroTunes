"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useVibe, EmotionType } from '../../context/VibeContext';
import { Eye, EyeOff, Radio, Play, Pause, Sparkles, Volume2 } from 'lucide-react';

export default function VisualizerPage() {
  const { activeTrack, isPlaying, setIsPlaying, emotion } = useVibe();
  const [showHud, setShowHud] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Circle particles parameters
    interface VisualParticle {
      angle: number;
      radius: number;
      speed: number;
      size: number;
      color: string;
      pulseOffset: number;
    }

    const particles: VisualParticle[] = [];
    const count = 120;

    const getEmotionTheme = (type: EmotionType) => {
      switch (type) {
        case 'stressed':
          return { baseColor: 'rgba(6, 182, 212, 0.65)', pulseSpeed: 0.08, dispersion: 1.8, particleSize: 1.5 };
        case 'energetic':
          return { baseColor: 'rgba(236, 72, 153, 0.7)', pulseSpeed: 0.12, dispersion: 2.5, particleSize: 2.2 };
        case 'sad':
          return { baseColor: 'rgba(99, 102, 241, 0.35)', pulseSpeed: 0.02, dispersion: 0.8, particleSize: 1.2 };
        case 'focused':
          return { baseColor: 'rgba(16, 185, 129, 0.45)', pulseSpeed: 0.04, dispersion: 1.1, particleSize: 1.0 };
        case 'happy':
        default:
          return { baseColor: 'rgba(139, 92, 246, 0.55)', pulseSpeed: 0.06, dispersion: 1.4, particleSize: 1.8 };
      }
    };

    // Initialize particle fields in a ring configuration
    const initParticles = () => {
      const theme = getEmotionTheme(emotion);
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          angle: (i / count) * Math.PI * 2,
          radius: Math.random() * 80 + 120,
          speed: (Math.random() * 0.01 + 0.003),
          size: Math.random() * theme.particleSize + 0.5,
          color: theme.baseColor,
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    };

    initParticles();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Audio Waveform Simulator
    let tick = 0;
    const draw = () => {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.18)'; // trails effect
      ctx.fillRect(0, 0, width, height);

      const theme = getEmotionTheme(emotion);
      const centerX = width / 2;
      const centerY = height / 2;

      tick += theme.pulseSpeed;

      // Base radius pulses to simulated beats
      let beatFactor = 1.0;
      if (isPlaying) {
        beatFactor = 1.0 + Math.sin(tick * 2.5) * 0.08 + Math.cos(tick * 0.8) * 0.04;
      }

      // Draw central pulse orb glow
      const radialGrad = ctx.createRadialGradient(
        centerX, centerY, 50 * beatFactor,
        centerX, centerY, 220 * beatFactor
      );
      
      const glowColor = theme.baseColor.replace('0.5', '0.05').replace('0.6', '0.05').replace('0.7', '0.05').replace('0.3', '0.03');
      const coreColor = theme.baseColor.replace('0.5', '0.35').replace('0.6', '0.35').replace('0.7', '0.35').replace('0.3', '0.2');

      radialGrad.addColorStop(0, coreColor);
      radialGrad.addColorStop(0.3, glowColor);
      radialGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 220 * beatFactor, 0, Math.PI * 2);
      ctx.fillStyle = radialGrad;
      ctx.fill();

      // Draw particle nodes
      particles.forEach((p) => {
        p.angle += p.speed * (isPlaying ? 1.5 : 0.4);
        
        // Pulse dispersion
        const pPulse = Math.sin(tick + p.pulseOffset) * 15 * theme.dispersion * (isPlaying ? 1.5 : 0.2);
        const currentRadius = (p.radius * beatFactor) + pPulse;
        
        const x = centerX + Math.cos(p.angle) * currentRadius;
        const y = centerY + Math.sin(p.angle) * currentRadius;

        ctx.beginPath();
        ctx.arc(x, y, p.size * (isPlaying ? 1.4 : 1.0), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Draw miniature orbital threads linking nearby particles
        if (isPlaying && Math.random() > 0.95) {
          ctx.beginPath();
          ctx.moveTo(centerX + Math.cos(p.angle) * (currentRadius - 5), centerY + Math.sin(p.angle) * (currentRadius - 5));
          ctx.lineTo(x, y);
          ctx.strokeStyle = theme.baseColor.replace('0.5', '0.1').replace('0.6', '0.1').replace('0.7', '0.1');
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });

      // Draw simulated oscilliscope waveform ring in center
      ctx.beginPath();
      const wavePoints = 80;
      for (let i = 0; i <= wavePoints; i++) {
        const angle = (i / wavePoints) * Math.PI * 2;
        const waveAmp = isPlaying ? (Math.sin(i * 0.8 + tick * 4) * 8 + Math.cos(i * 1.5 - tick * 2) * 5) : 1;
        const r = (100 * beatFactor) + waveAmp;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = theme.baseColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [emotion, isPlaying]);

  const emotionGlows: Record<EmotionType, string> = {
    stressed: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    energetic: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    sad: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    focused: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    happy: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  const hudGlow = emotionGlows[emotion] || emotionGlows.happy;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      {/* Background Interactive canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 pointer-events-none" />

      {/* Floating Header Actions */}
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        <button
          onClick={() => setShowHud(!showHud)}
          className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-slate-400 hover:text-white hover:border-white/10 transition-all backdrop-blur-md"
          title="Toggle HUD Display"
        >
          {showHud ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Center metadata overlay */}
      {!activeTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10 pointer-events-none select-none">
          <Radio className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
          <h3 className="text-slate-500 text-sm font-semibold tracking-wider uppercase">NeuroAura Standby</h3>
          <p className="text-slate-600 text-xs mt-1">Initialize any audio track to activate real-time beat sync visualizers.</p>
        </div>
      )}

      {/* Fullscreen HUD HUD Overlay */}
      {showHud && activeTrack && (
        <div className="absolute inset-x-6 top-6 bottom-6 flex flex-col justify-between pointer-events-none z-10">
          
          {/* Top HUD bar */}
          <div className="flex justify-between items-start w-full">
            <div className={`glass-panel border rounded-2xl p-4 min-w-[200px] flex items-center gap-3.5 ${hudGlow.split(' ')[2]}`}>
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Active Stream</span>
                <span className="text-xs text-white font-semibold truncate max-w-[150px]">{activeTrack.title}</span>
              </div>
            </div>

            <div className={`glass-panel border rounded-2xl p-4 text-right flex flex-col ${hudGlow.split(' ')[2]}`}>
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Aesthetic Mod</span>
              <span className="text-xs text-white font-semibold uppercase tracking-wider mt-0.5">{emotion} Aura</span>
            </div>
          </div>

          {/* Bottom HUD stats bar */}
          <div className="flex flex-col md:flex-row justify-between items-end w-full gap-4">
            
            {/* Visualizer Diagnostic */}
            <div className="glass-panel border border-white/5 rounded-2xl p-4 max-w-sm w-full md:w-auto">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-2">Beat Engine Telemetry</span>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <span className="text-slate-400">Freq Gain:</span> <span className="text-emerald-400 font-mono text-[10px] text-right">0.82 dBFs</span>
                <span className="text-slate-400">BPM Sync:</span> <span className="text-cyan-400 font-mono text-[10px] text-right">108.2</span>
                <span className="text-slate-400">Audio FPS:</span> <span className="text-purple-400 font-mono text-[10px] text-right">60 Hz</span>
              </div>
            </div>

            {/* Platform Controls */}
            <div className="glass-panel border border-white/5 rounded-2xl p-4 flex items-center gap-4 pointer-events-auto self-stretch md:self-auto justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              
              <div className="flex flex-col">
                <span className="text-slate-400 text-xs font-semibold">{isPlaying ? 'Streaming Audio' : 'Audio Suspended'}</span>
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Click to toggle</span>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
