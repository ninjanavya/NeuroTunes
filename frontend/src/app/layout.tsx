import React from 'react';
import { VibeProvider } from '../context/VibeContext';
import { CanvasNeuralBg } from '../components/CanvasNeuralBg';
import { Sidebar } from '../components/Sidebar';
import { AudioPlayer } from '../components/AudioPlayer';
import './globals.css';

export const metadata = {
  title: 'NeuroTunes - AI Emotion-Adaptive Music OS',
  description: 'A premium, next-generation AI music platform that adapts soundscapes, background visuals, and UI aesthetics to human emotions in real time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#020617] text-slate-100 min-h-screen">
        <VibeProvider>
          {/* Reactive Neural Network Background */}
          <CanvasNeuralBg />

          <div className="flex min-h-screen">
            {/* Navigational Sidebar */}
            <Sidebar />

            {/* Main Application Container */}
            <div className="flex-1 flex flex-col md:pl-64 relative z-10 w-full">
              <main className="flex-1 w-full pt-16 md:pt-0 pb-36">
                {children}
              </main>
            </div>
          </div>

          {/* Persistent Dynamic Media Player */}
          <AudioPlayer />
        </VibeProvider>
      </body>
    </html>
  );
}
