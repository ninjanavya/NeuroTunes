"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useVibe, EmotionType } from '../../context/VibeContext';
import { 
  Camera, 
  Mic, 
  MicOff, 
  PenTool, 
  Sparkles, 
  Activity, 
  Heart, 
  Brain,
  VideoOff
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ChartPoint {
  time: string;
  valence: number;
  arousal: number;
  attention: number;
}

export default function EmotionPage() {
  const { token, emotion, setEmotion } = useVibe();
  
  // Cam States
  const [useCam, setUseCam] = useState<boolean>(false);
  const [camLogs, setCamLogs] = useState<string>('Biometric optical feeds offline.');
  const [faceMetrics, setFaceMetrics] = useState({ happy: 20, sad: 10, energetic: 30, stressed: 15, neutral: 25 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  // Audio States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioStatus, setAudioStatus] = useState<string>('Vocal audio capture idle.');
  const [voiceMetrics, setVoiceMetrics] = useState({ pitch: 120, energy: 45, confidence: 80 });

  // Journal States
  const [diaryText, setDiaryText] = useState<string>('');
  const [journalFeedback, setJournalFeedback] = useState<string>('');
  const [journalLoading, setJournalLoading] = useState<boolean>(false);

  // Graph Data
  const [graphData, setGraphData] = useState<ChartPoint[]>([
    { time: '10:00', valence: 0.6, arousal: 0.4, attention: 0.8 },
    { time: '10:15', valence: 0.5, arousal: 0.5, attention: 0.7 },
    { time: '10:30', valence: 0.7, arousal: 0.8, attention: 0.9 },
    { time: '10:45', valence: 0.8, arousal: 0.9, attention: 0.85 },
    { time: '11:00', valence: 0.4, arousal: 0.3, attention: 0.6 }
  ]);

  const [faceApiLoaded, setFaceApiLoaded] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const detectIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      setCamLogs('Failed to load Face-API script.');
    };
    document.body.appendChild(script);
  }, []);

  // Load models once script is loaded
  useEffect(() => {
    if (!faceApiLoaded) return;

    const loadModels = async () => {
      try {
        setCamLogs('Loading computer vision facial models...');
        const faceapi = (window as any).faceapi;
        
        // Models URL on jsdelivr
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        setModelsLoaded(true);
        setCamLogs('Biometric facial models ready.');
      } catch (err: any) {
        console.error('Failed to load face-api models:', err);
        setCamLogs(`Failed to load models: ${err.message || err}`);
      }
    };

    loadModels();
  }, [faceApiLoaded]);

  // Turn Camera On/Off
  useEffect(() => {
    if (useCam) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((stream) => {
          camStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          if (modelsLoaded) {
            setCamLogs('Optical feed online. Calibrating real-time face tracking...');
            startRealFaceDetection();
          } else {
            setCamLogs('Optical feed online. Loading biometric models...');
          }
        })
        .catch((err) => {
          setCamLogs('Access denied or webcam not connected.');
          setUseCam(false);
        });
    } else {
      stopCam();
    }

    return () => stopCam();
  }, [useCam, modelsLoaded]);

  const stopCam = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach(track => track.stop());
      camStreamRef.current = null;
    }
    setCamLogs('Biometric optical feeds offline.');
  };

  const startRealFaceDetection = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }

    const faceapi = (window as any).faceapi;
    if (!faceapi || !videoRef.current) return;

    detectIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const detections = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.45 })
        ).withFaceExpressions();

        if (detections && detections.expressions) {
          const exprs = detections.expressions;
          
          // Map to percentages
          const h = Math.round((exprs.happy || 0) * 100);
          const s = Math.round((exprs.sad || 0) * 100);
          const st = Math.round((exprs.angry || 0) * 100);
          const e = Math.round((exprs.surprised || 0) * 100);
          const n = Math.round((exprs.neutral || 0) * 100);
          
          setFaceMetrics({
            happy: h,
            sad: s,
            energetic: e,
            stressed: st,
            neutral: n
          });

          // Fetch evaluation from the Python ML microservice
          const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';
          const response = await fetch(`${mlUrl}/api/analyze-expression`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expressions: exprs })
          });
          const result = await response.json();

          if (result && result.dominant_emotion) {
            setCamLogs(`Optical scan: ${result.dominant_emotion.toUpperCase()} expression detected (${Math.round(result.confidence * 100)}% confidence).`);
            
            // Periodically propagate to global mood state
            const nextEmotion: EmotionType = 
              result.dominant_emotion === 'surprised' || result.dominant_emotion === 'energetic' ? 'energetic' :
              result.dominant_emotion === 'happy' ? 'happy' :
              result.dominant_emotion === 'sad' ? 'sad' :
              result.dominant_emotion === 'angry' || result.dominant_emotion === 'fearful' ? 'stressed' :
              result.dominant_emotion === 'neutral' ? 'chill' : 'chill';
            
            setEmotion(nextEmotion);

            // Save mood logs to Node.js backend
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            if (token) {
              await fetch(`${apiUrl}/api/moods`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  mood: result.dominant_emotion,
                  valence: result.valence,
                  arousal: result.arousal,
                  journalText: `Optical biometric scanner automated trace`
                })
              }).catch(err => console.error('Failed to save mood log:', err));
            }

            // Plot new point on graph
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}:${now.getSeconds() < 10 ? '0' : ''}${now.getSeconds()}`;
            setGraphData(prev => [
              ...prev.slice(1), 
              { 
                time: timeStr, 
                valence: result.valence, 
                arousal: result.arousal, 
                attention: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)) 
              }
            ]);
          }
        } else {
          setCamLogs('Optical feed online. Searching for face landmarks...');
        }
      } catch (err) {
        console.error('Face detection loop error:', err);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, []);

  // Voice Recording trigger
  const handleToggleVoice = () => {
    if (isRecording) {
      setIsRecording(false);
      setAudioStatus('Vocal audio capture idle.');
    } else {
      setIsRecording(true);
      setAudioStatus('Listening to pitch variance and vocal envelope...');
      
      setTimeout(() => {
        // Mock voice sentiment results
        const randomPitch = Math.round(Math.random() * 150 + 90);
        const randomEnergy = Math.round(Math.random() * 40 + 30);
        setVoiceMetrics({
          pitch: randomPitch,
          energy: randomEnergy,
          confidence: 88
        });
        
        setIsRecording(false);
        setAudioStatus(`Analysis complete: Detected moderate energy voice, pitch ${randomPitch}Hz.`);
        
        // Push state to graph
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`;
        setGraphData(prev => [
          ...prev.slice(1),
          { time: timeStr, valence: 0.65, arousal: parseFloat((randomEnergy / 100).toFixed(2)), attention: 0.8 }
        ]);
      }, 3500);
    }
  };

  // Text journal mood evaluation
  const handleDiarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaryText.trim()) return;

    setJournalLoading(true);
    setJournalFeedback('');
    
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
      const res = await fetch(`${mlUrl}/api/nlp-mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: diaryText })
      });
      const data = await res.json();
      
      setJournalFeedback(`NLP Analysis: ${data.summary || `Vibe classified as ${data.mood}`}. Valence: ${data.valence}, Arousal: ${data.arousal}`);
      
      // Update global context mood
      const nextEmotion: EmotionType = 
        data.mood === 'focus' ? 'focused' : 
        data.mood === 'stressed' ? 'stressed' :
        data.mood === 'sad' ? 'sad' :
        data.mood === 'happy' ? 'happy' :
        data.mood === 'energetic' ? 'energetic' : 'chill';

      setEmotion(nextEmotion);

      // Save journal to database
      if (token) {
        await fetch(`${apiUrl}/api/moods`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            mood: data.mood,
            valence: data.valence,
            arousal: data.arousal,
            journalText: diaryText
          })
        });
      }

      // Add to graph timeline
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`;
      setGraphData(prev => [
        ...prev.slice(1),
        { time: timeStr, valence: data.valence, arousal: data.arousal, attention: 0.85 }
      ]);

      setDiaryText('');
    } catch (err) {
      console.error(err);
      setJournalFeedback('Connection failed. Verify python service is running.');
    } finally {
      setJournalLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Biometric Diagnostics</span>
        <h2 className="text-3xl font-extrabold text-white mt-1">Emotion Analysis Terminal</h2>
        <p className="text-slate-400 text-sm mt-1">Scan your face, record audio notes, or journal thoughts to calibrate recommendations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Optical Scanning */}
        <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col items-center">
          <h3 className="text-white font-bold text-lg mb-4 self-start flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" /> Optical Face Scanner
          </h3>
          
          <div className="relative w-full aspect-video rounded-2xl bg-slate-950/80 border border-white/5 overflow-hidden flex items-center justify-center">
            {useCam ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                muted
                playsInline
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <VideoOff className="w-10 h-10" />
                <span className="text-xs">Camera module offline</span>
              </div>
            )}
            
            {/* HUD Scan target frames */}
            {useCam && (
              <div className="absolute inset-0 border border-purple-500/20 m-4 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 border border-dashed border-cyan-500/50 rounded-full animate-spin-slow"></div>
                <div className="absolute top-2 left-2 text-[9px] text-cyan-400 font-mono">SCAN_MOD: LIVE_COORD</div>
                <div className="absolute bottom-2 right-2 text-[9px] text-cyan-400 font-mono">MESH_FPS: 28</div>
              </div>
            )}
          </div>

          <div className="w-full mt-4">
            <button
              onClick={() => setUseCam(!useCam)}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-all ${
                useCam ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400' : 'bg-white text-slate-900'
              }`}
            >
              {useCam ? 'Disconnect Scanner' : 'Initialize Scanner'}
            </button>
            <p className="text-slate-500 text-[10px] font-mono mt-3 leading-relaxed truncate">{camLogs}</p>
          </div>

          {/* Expressions breakdown */}
          <div className="w-full mt-6 bg-slate-950/30 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
            <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Face Expression Vectors</span>
            {Object.entries(faceMetrics).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize text-slate-400 font-medium">{key}</span>
                <div className="flex items-center gap-2 w-2/3">
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full transition-all duration-500" style={{ width: `${val}%` }}></div>
                  </div>
                  <span className="w-8 text-right font-mono text-[10px] text-slate-300">{val}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Vocal and journaling */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Vocal Analyzer */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-pink-400" /> Vocal Sentiment Monitor
                </h3>
                <p className="text-slate-400 text-xs mb-6">Analyze pitch patterns and vocal amplitude from a audio sample to detect arousal vectors.</p>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
                {isRecording ? (
                  <div className="flex items-center gap-1.5 h-8">
                    <span className="w-1.5 h-6 bg-pink-500 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                    <span className="w-1.5 h-8 bg-pink-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="w-1.5 h-5 bg-pink-500 rounded-full animate-bounce [animation-delay:0.5s]"></span>
                    <span className="w-1.5 h-7 bg-pink-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  </div>
                ) : (
                  <MicOff className="w-8 h-8 text-slate-600" />
                )}
                <span className="text-[10px] text-slate-500 mt-3 font-mono text-center leading-normal max-w-[200px]">{audioStatus}</span>
              </div>

              <button
                onClick={handleToggleVoice}
                className={`w-full py-3 mt-6 rounded-xl font-bold text-xs uppercase tracking-wide transition-all ${
                  isRecording ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400' : 'bg-slate-900/60 border border-slate-800 text-white'
                }`}
              >
                {isRecording ? 'Deactivate Mic' : 'Record Audio Vibe'}
              </button>
            </section>

            {/* NLP Diary */}
            <section className="glass-panel border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-indigo-400" /> Cognitive Mood Journal
                </h3>
                <p className="text-slate-400 text-xs mb-4">Write a brief log of your thoughts. Our NLP model will parse the text sentiment vector.</p>
              </div>

              <form onSubmit={handleDiarySubmit} className="flex flex-col gap-4">
                <textarea
                  value={diaryText}
                  onChange={(e) => setDiaryText(e.target.value)}
                  placeholder="Today I feel a bit overwhelmed but determined..."
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none h-[120px]"
                />
                
                {journalFeedback && (
                  <div className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl">
                    {journalFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={journalLoading || !diaryText.trim()}
                  className="w-full py-3 bg-white text-slate-900 font-bold text-xs uppercase tracking-wide rounded-xl disabled:opacity-40 transition-opacity"
                >
                  {journalLoading ? 'Parsing sentiment...' : 'Log Journal Vibe'}
                </button>
              </form>
            </section>

          </div>

          {/* Core Analytics Graph */}
          <section className="glass-panel border border-white/5 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Biometric Valence/Arousal Monitor
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">TIMELINE: LIVE FEED</span>
            </div>

            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="aroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="time" stroke="#475569" fontSize={9} fontClassName="font-mono" />
                  <YAxis stroke="#475569" fontSize={9} domain={[0, 1]} ticks={[0, 0.5, 1]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '10px', color: '#f8fafc' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="valence" stroke="#8b5cf6" fillOpacity={1} fill="url(#valGrad)" name="Valence" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="arousal" stroke="#ec4899" fillOpacity={1} fill="url(#aroGrad)" name="Arousal" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
