"use client";

import React, { useRef, useEffect } from 'react';
import { useVibe, EmotionType } from '../context/VibeContext';

export const CanvasNeuralBg: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { emotion, isPlaying } = useVibe();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle class definition
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.size = Math.random() * 2 + 1;
      }

      update(speedMultiplier: number) {
        this.x += this.vx * speedMultiplier;
        this.y += this.vy * speedMultiplier;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }

      draw(color: string) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = 75;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Configure properties based on emotion and elapsed frames
    const getEmotionConfig = (type: EmotionType, currentTick: number) => {
      let baseHue = 270;
      let speed = 1.2;
      let baseDistance = 120;

      switch (type) {
        case 'stressed':
          baseHue = 190;
          speed = 2.2;
          baseDistance = 140;
          break;
        case 'energetic':
          baseHue = 330;
          speed = 2.8;
          baseDistance = 160;
          break;
        case 'sad':
          baseHue = 240;
          speed = 0.4;
          baseDistance = 100;
          break;
        case 'focused':
          baseHue = 150;
          speed = 0.8;
          baseDistance = 90;
          break;
        case 'happy':
        default:
          baseHue = 270;
          speed = 1.2;
          baseDistance = 120;
          break;
      }

      // Constantly shift hue slowly over time (drifting around the base hue by +/- 25 degrees)
      const shiftedHue = Math.round(baseHue + Math.sin(currentTick * 0.005) * 25);
      
      // Let the connection distance breathe slowly (expanding/contracting by +/- 15px)
      const distance = Math.round(baseDistance + Math.sin(currentTick * 0.008) * 15);

      return {
        hue: shiftedHue,
        color: `hsla(${shiftedHue}, 85%, 65%, 0.65)`,
        speed,
        distance
      };
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let tick = 0;
    
    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      tick += 1;
      
      const config = getEmotionConfig(emotion, tick);
      let speedMultiplier = config.speed;
      
      // Bump speed if music is playing
      if (isPlaying) {
        speedMultiplier *= 1.35;
      }

      // Draw lines between particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(speedMultiplier);
        particles[i].draw(config.color);

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.distance) {
            const alpha = (1 - dist / config.distance) * 0.85;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(${config.hue}, 85%, 55%, ${alpha * 0.18})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [emotion, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 bg-[#020617] transition-all duration-1000"
    />
  );
};
