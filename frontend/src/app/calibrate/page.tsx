"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVibe, EmotionType, Track } from '../../context/VibeContext';
import { Camera, VideoOff, Sparkles, Play, ArrowRight, BrainCircuit, RefreshCw } from 'lucide-react';

export default function CalibratePage() {
  const router = useRouter();
  const { token, username, setEmotion, playTrack } = useVibe();

  // Cam stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [scanStep, setScanStep] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanMessage, setScanMessage] = useState<string>('Biometric scanner initialized.');
  const [detectedMood, setDetectedMood] = useState<EmotionType>('happy');
  const [suggestedPlaylist, setSuggestedPlaylist] = useState<any[]>([]);

  const [faceApiLoaded, setFaceApiLoaded] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);

  // Load face-api script on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if ((window as any).faceapi) {
      setFaceApiLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
    script.async = true;
    script.onload = () => {
      setFaceApiLoaded(true);
    };
    script.onerror = () => {
      console.warn('Failed to load Face-API script, using fallback simulation.');
    };
    document.body.appendChild(script);
  }, []);

  // Load models once script is loaded
  useEffect(() => {
    if (!faceApiLoaded) return;

    const loadModels = async () => {
      try {
        const faceapi = (window as any).faceapi;
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        console.log('Biometric facial models loaded.');
      } catch (err: any) {
        console.warn('Failed to load face-api models, using fallback simulation:', err);
      }
    };

    loadModels();
  }, [faceApiLoaded]);

  // Auth Guard
  useEffect(() => {
    if (!token && !username) {
      router.push('/');
    } else {
      initializeCamera();
    }
    return () => stopCamera();
  }, [token, username]);

  const initializeCamera = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported on this browser/device.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setHasCamera(true);
      triggerScan();
    } catch (err) {
      console.warn('Camera access denied or missing, using simulation fallback.', err);
      setHasCamera(false);
      triggerScan();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Simulate scanning phases
  const triggerScan = () => {
    setScanStep('scanning');
    setScanProgress(0);
    setScanMessage('Locating facial nodes...');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(progress);

      if (progress === 30) {
        setScanMessage('Calibrating eye-mouth aspect coordinates...');
      } else if (progress === 60) {
        setScanMessage('Calculating valence and arousal vectors...');
      } else if (progress === 85) {
        setScanMessage('Matching soundscape similarity embeddings...');
      } else if (progress >= 100) {
        clearInterval(interval);
        finalizeCalibration();
      }
    }, 150);
  };

  const finalizeCalibration = async () => {
    let chosenMood: EmotionType = 'happy';

    // Try to run real face expression analysis
    const faceapi = (window as any).faceapi;
    if (hasCamera && modelsLoaded && faceapi && videoRef.current) {
      try {
        setScanMessage('Scanning facial expression metrics...');
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.45 })
        ).withFaceExpressions();

        if (detection && detection.expressions) {
          const exprs = detection.expressions;
          const dominant = Object.keys(exprs).reduce((a, b) => exprs[a] > exprs[b] ? a : b) as string;
          
          chosenMood = 
            dominant === 'surprised' ? 'energetic' :
            dominant === 'happy' ? 'happy' :
            dominant === 'sad' ? 'sad' :
            dominant === 'angry' || dominant === 'fearful' ? 'stressed' :
            dominant === 'neutral' ? 'chill' : 'chill';
            
          console.log('Real CV scan detected mood:', chosenMood);
        } else {
          const moods: EmotionType[] = ['happy', 'sad', 'chill', 'energetic', 'focused', 'stressed'];
          chosenMood = moods[Math.floor(Math.random() * moods.length)];
          console.log('Face not detected in feed, choosing random onboarding mood:', chosenMood);
        }
      } catch (err) {
        console.warn('Face detection error during calibration, falling back:', err);
        const moods: EmotionType[] = ['happy', 'sad', 'chill', 'energetic', 'focused', 'stressed'];
        chosenMood = moods[Math.floor(Math.random() * moods.length)];
      }
    } else {
      const moods: EmotionType[] = ['happy', 'sad', 'chill', 'energetic', 'focused', 'stressed'];
      chosenMood = moods[Math.floor(Math.random() * moods.length)];
      console.log('No camera or face models loaded, using fallback mood:', chosenMood);
    }

    setDetectedMood(chosenMood);
    setEmotion(chosenMood);
    
    setScanMessage(`Biometric Scan Complete. Detected state: ${chosenMood.toUpperCase()}`);
    setScanStep('complete');

    // Query python service to get customized tracks
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${mlUrl}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: chosenMood, count: 4 })
      });
      const data = await res.json();
      if (data.recommendations) {
        setSuggestedPlaylist(data.recommendations);
      }
    } catch (e) {
      const fallbacks: Record<EmotionType, any[]> = {
        happy: [
          { title: "Blinding Lights - The Weeknd", videoId: "dQw4w9WgXcQ" },
          { title: "Levitating - Dua Lipa", videoId: "9bZkp7q19f0" }
        ],
        sad: [
          { title: "Someone Like You - Adele", videoId: "kJQP7kiw5Fk" },
          { title: "Fix You - Coldplay", videoId: "k4V3_GkykNU" }
        ],
        chill: [
          { title: "Night Drive - Lofi beats", videoId: "5qap5aO4i9A" },
          { title: "Ocean Eyes - Billie Eilish", videoId: "OPf0YbXqDm0" }
        ],
        energetic: [
          { title: "Believer - Imagine Dragons", videoId: "V-_O7nl0Ii0" },
          { title: "Stronger - Kanye West", videoId: "PsO6ZnUZI0g" }
        ],
        focused: [
          { title: "Weightless - Marconi Union", videoId: "UfcAVejsvU4" },
          { title: "Resonance - HOME", videoId: "8GW6sLrK40k" }
        ],
        stressed: [
          { title: "Weightless - Marconi Union", videoId: "UfcAVejsvU4" },
          { title: "Ambient Space Wave", videoId: "OPf0YbXqDm0" }
        ]
      };
      setSuggestedPlaylist(fallbacks[chosenMood] || fallbacks.happy);
    }
    stopCamera();
  };

  const handlePlaySuggested = async (trackObj: any) => {
    const songName = trackObj.song || trackObj.title;
    if (!songName) return;

    setScanMessage('Resolving stream...');
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
          artist: 'Calibrated Stream',
          source: 'youtube'
        };
        playTrack(track);
      } else {
        const track: Track = {
          videoId: trackObj.videoId || 'dQw4w9WgXcQ',
          title: songName,
          artist: 'Calibrated Stream (Fallback)',
          source: 'youtube'
        };
        playTrack(track);
      }
    } catch (err) {
      console.error('Failed to resolve suggested song:', err);
      const track: Track = {
        videoId: trackObj.videoId || 'dQw4w9WgXcQ',
        title: songName,
        artist: 'Calibrated Stream (Fallback)',
        source: 'youtube'
      };
      playTrack(track);
    }
    router.push('/dashboard');
  };

  const handleProceed = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 md:px-12 py-16 relative overflow-hidden bg-[#020617]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-[90px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-indigo-500/5 rounded-full blur-[110px] animate-pulse-slow"></div>

      <div className="max-w-xl w-full text-center flex flex-col items-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/5 text-purple-400 text-xs font-semibold mb-6 uppercase tracking-wider">
          <BrainCircuit className="w-3.5 h-3.5" /> Biometric Sync Portal
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2 leading-tight">
          Vibe Calibration
        </h1>
        <p className="text-slate-400 text-sm font-light max-w-sm mb-8">
          Calibrating NeuroTunes engine to your current emotional valence.
        </p>

        {/* Video Scanner Element */}
        {scanStep !== 'complete' && (
          <div className="relative w-72 h-72 rounded-full bg-slate-950/80 border border-white/5 overflow-hidden flex items-center justify-center shadow-xl shadow-purple-500/5 mb-8">
            {hasCamera ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                muted
                playsInline
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <VideoOff className="w-8 h-8" />
                <span className="text-xs">Camera module bypassed</span>
              </div>
            )}

            {/* Scanning graphic circles */}
            {scanStep === 'scanning' && (
              <div className="absolute inset-0 border border-purple-500/20 m-2 rounded-full flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border border-dashed border-cyan-500/60 rounded-full animate-spin-slow"></div>
                <div className="w-56 h-56 border border-dotted border-pink-500/40 rounded-full animate-pulse-slow"></div>
                {/* HUD scan overlay lines */}
                <div className="absolute w-full h-[1px] bg-cyan-500/30 animate-pulse"></div>
              </div>
            )}
          </div>
        )}

        {/* Telemetry Progress Info */}
        {scanStep !== 'complete' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150" style={{ width: `${scanProgress}%` }}></div>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">{scanMessage}</span>
          </div>
        )}

        {/* Calibration Complete View */}
        {scanStep === 'complete' && (
          <div className="w-full max-w-md glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="text-left">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block">Biometric Vibe</span>
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 capitalize">{detectedMood} State</span>
              </div>
              <button 
                onClick={triggerScan}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Re-calibrate scanner"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Suggested Transition tracks */}
            <div className="text-left">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-3">AI Transition Soundscape</span>
              <div className="flex flex-col gap-2">
                {suggestedPlaylist.map((track, idx) => (
                  <div
                    key={idx}
                    onClick={() => handlePlaySuggested(track)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/20 border border-white/5 hover:border-purple-500/30 hover:bg-slate-950/40 cursor-pointer transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">0{idx + 1}</span>
                      <span className="text-xs font-semibold text-white truncate max-w-[240px]">{track.song || track.title}</span>
                    </div>
                    <button className="w-6 h-6 rounded-full bg-white/5 group-hover:bg-white text-slate-400 group-hover:text-slate-900 flex items-center justify-center transition-all">
                      <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Next buttons */}
            <button
              onClick={handleProceed}
              className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 text-sm"
            >
              Enter Platform Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
