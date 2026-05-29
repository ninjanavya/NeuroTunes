"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Send, 
  Sparkles, 
  Tv, 
  ThumbsUp, 
  MessageCircle, 
  Eye, 
  Users, 
  Calendar, 
  Clock, 
  Hash, 
  BarChart, 
  HelpCircle, 
  RefreshCw,
  ArrowRight,
  TrendingUp,
  BookOpen
} from 'lucide-react';

interface VideoMetadata {
  title: string;
  creator: string;
  follower_count: number;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  upload_date: string;
  duration: number;
  hashtags: string[];
  platform: 'YouTube' | 'Instagram';
  playback_url: string;
  video_id_tag: 'A' | 'B';
  video_id_raw: string;
  has_transcript: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    video_id: 'A' | 'B';
    creator: string;
    chunk_index: number;
    content: string;
  }>;
}

export default function RAGPage() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  
  const [videoA, setVideoA] = useState<VideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<VideoMetadata | null>(null);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';

  // Automatically scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fillDemoUrls = () => {
    setUrlA('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    setUrlB('https://www.instagram.com/reel/C8D1z3uO8_D/');
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA || !urlB) return;
    
    setLoading(true);
    setLoadingStatus('Detecting video platforms and downloading content...');
    
    // Set simulated step logs for a dynamic loading experience
    const steps = [
      'Extracting metadata for YouTube & Instagram Reel...',
      'Downloading Reels audio track for parsing...',
      'Transcribing media tracks using Gemini AI...',
      'Splitting transcripts into semantic chunks...',
      'Generating chunk embeddings using Gemini text-embedding-001...',
      'Storing chunks into ChromaDB and establishing relations...'
    ];
    
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setLoadingStatus(steps[stepIndex]);
        stepIndex++;
      }
    }, 4000);

    try {
      const response = await fetch(`${mlUrl}/api/process-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_a: urlA, url_b: urlB }),
      });
      
      clearInterval(interval);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to process videos');
      }
      
      const data = await response.json();
      setVideoA(data.video_a);
      setVideoB(data.video_b);
      
      // Initialize chat with a welcome strategic analysis prompt
      setChatHistory([
        {
          role: 'assistant',
          content: `Strategic Video Comparison RAG session initialized! 

Successfully processed **Video A (YouTube - ${data.video_a.creator})** and **Video B (Instagram - ${data.video_b.creator})**. 
Both transcripts have been indexed in our ChromaDB.

You can ask me anything about their metrics, hooks, and suggest improvements. What would you like to compare?`
        }
      ]);
      
    } catch (error: any) {
      console.error(error);
      alert(`Error analyzing videos: ${error.message}`);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSendMessage = async (messageToSend?: string) => {
    const query = messageToSend || inputMessage;
    if (!query.trim() || !videoA || !videoB || chatLoading) return;
    
    if (!messageToSend) {
      setInputMessage('');
    }
    
    // Add user message to history
    const newHistory = [...chatHistory, { role: 'user', content: query } as ChatMessage];
    setChatHistory(newHistory);
    setChatLoading(true);
    
    // Append a placeholder assistant message that we will stream into
    const assistantIndex = newHistory.length;
    setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);
    
    try {
      const response = await fetch(`${mlUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          chat_history: chatHistory.map(m => ({ role: m.role, content: m.content })),
          metadata_a: videoA,
          metadata_b: videoB
        })
      });
      
      if (!response.body) throw new Error("No response body");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let assistantResponse = '';
      let citations: any[] = [];
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        // SSE responses can contain multiple "data: " statements
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.citations) {
                citations = data.citations;
              } else if (data.token) {
                assistantResponse += data.token;
                // Update the state on the fly
                setChatHistory(prev => {
                  const updated = [...prev];
                  updated[assistantIndex] = {
                    role: 'assistant',
                    content: assistantResponse,
                    citations: citations.length > 0 ? citations : undefined
                  };
                  return updated;
                });
              } else if (data.error) {
                assistantResponse += `\n[Error: ${data.error}]`;
              }
            } catch (e) {
              // Ignore parsing errors for partial lines
            }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setChatHistory(prev => {
        const updated = [...prev];
        updated[assistantIndex] = {
          role: 'assistant',
          content: `Error communicating with model: ${e.message}`
        };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  const presetQuestions = [
    { label: "Why did Video A get more engagement than Video B?", query: "Why did Video A get more engagement than Video B?" },
    { label: "Compare engagement rates", query: "What's the engagement rate of each video?" },
    { label: "Compare hooks (first 5 seconds)", query: "Compare the hooks in the first 5 seconds." },
    { label: "Who is Video B creator & follower count?", query: "Who's the creator of Video B and what's their follower count?" },
    { label: "Suggest improvements for Video B based on A", query: "Suggest improvements for Video B based on what worked in Video A." }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 min-h-screen text-slate-200">
      {/* Title Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-3xl tracking-tight bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Social Video RAG Analytics
            </h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Compare YouTube and Instagram Reels and chat with their transcripts
            </p>
          </div>
        </div>
      </div>

      {/* URL Forms Panel */}
      {!videoA && !videoB && (
        <div className="glass-panel border-white/10 p-8 rounded-3xl flex flex-col gap-6 max-w-3xl mx-auto w-full bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Video className="text-emerald-400 w-6 h-6" />
            <h2 className="text-white font-bold text-xl">Analyze Social Media Videos</h2>
          </div>
          
          <form onSubmit={handleAnalyze} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Video A (YouTube Video or Short)</label>
              <input 
                type="url" 
                placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3.5 text-sm w-full focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-600"
                value={urlA}
                onChange={e => setUrlA(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Video B (Instagram Reel)</label>
              <input 
                type="url" 
                placeholder="e.g., https://www.instagram.com/reel/C8D1z3uO8_D/" 
                className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3.5 text-sm w-full focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-600"
                value={urlB}
                onChange={e => setUrlB(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-2">
              <button 
                type="button" 
                onClick={fillDemoUrls}
                className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-all border border-slate-700 hover:border-emerald-500/30 px-3.5 py-2 rounded-lg bg-slate-950/20"
                disabled={loading}
              >
                Autofill Demo URLs
              </button>
              
              <button 
                type="submit" 
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Analyze Videos
                    <ArrowRight className="w-4.5 h-4.5" />
                  </>
                )}
              </button>
            </div>
          </form>
          
          {loading && (
            <div className="mt-4 flex flex-col gap-2 bg-slate-950/40 rounded-2xl p-4 border border-white/5 animate-pulse">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-300 font-medium">Pipeline Status:</span>
              </div>
              <p className="text-xs text-slate-500 italic font-mono pl-7">{loadingStatus}</p>
            </div>
          )}
        </div>
      )}

      {/* Main RAG Dashboard - side-by-side cards and chat */}
      {videoA && videoB && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          {/* Left / Top Side: Side-by-Side Video Cards (col span 7) */}
          <div className="lg:col-span-7 flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart className="text-emerald-400 w-5 h-5" />
                Performance Side-by-Side
              </h2>
              <button 
                onClick={() => { setVideoA(null); setVideoB(null); }}
                className="text-xs font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Videos
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Video A Card */}
              <div className="glass-panel border-white/10 rounded-2xl p-5 flex flex-col gap-4 bg-slate-900/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-red-600/10 text-red-500 border-l border-b border-red-500/20 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Video A
                </div>
                
                {/* Embedded Video Player */}
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-white/5 relative">
                  {videoA.playback_url ? (
                    <iframe 
                      src={videoA.playback_url} 
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
                      <Tv className="w-8 h-8" />
                      <span className="text-xs font-medium">Video Player Unavailable</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] text-red-400 font-extrabold uppercase tracking-wide bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
                      {videoA.platform}
                    </span>
                    <h3 className="text-white font-bold text-sm truncate mt-1.5" title={videoA.title}>{videoA.title}</h3>
                  </div>

                  <div className="h-[1px] bg-white/5"></div>
                  
                  {/* Statistics Details */}
                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div className="flex flex-col gap-0.5 bg-slate-950/20 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Creator</span>
                      <span className="text-white font-bold truncate">@{videoA.creator}</span>
                      <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        {videoA.follower_count.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-0.5 bg-slate-950/20 p-2 rounded-lg border border-white/5 justify-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Engagement Rate</span>
                      <span className={`text-base font-extrabold flex items-center gap-1 mt-0.5 ${
                        videoA.engagement_rate > videoB.engagement_rate ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {videoA.engagement_rate}%
                        {videoA.engagement_rate > videoB.engagement_rate && <TrendingUp className="w-4 h-4" />}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 col-span-2 justify-between px-1">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoA.views.toLocaleString()}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <ThumbsUp className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoA.likes.toLocaleString()}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoA.comments.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="h-[1px] bg-white/5"></div>

                  <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Uploaded:
                      </span>
                      <span className="text-slate-300 font-bold">{videoA.upload_date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Duration:
                      </span>
                      <span className="text-slate-300 font-bold">{videoA.duration}s</span>
                    </div>
                  </div>

                  {videoA.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {videoA.hashtags.slice(0, 4).map((tag, idx) => (
                        <span key={idx} className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-950/40 rounded-md border border-white/5 flex items-center gap-0.5">
                          <Hash className="w-2.5 h-2.5 text-slate-500" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Video B Card */}
              <div className="glass-panel border-white/10 rounded-2xl p-5 flex flex-col gap-4 bg-slate-900/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-pink-600/10 text-pink-500 border-l border-b border-pink-500/20 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Video B
                </div>
                
                {/* Embedded Video Player / Static Video */}
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-white/5 relative flex items-center justify-center">
                  {videoB.playback_url ? (
                    <video 
                      src={`${mlUrl}${videoB.playback_url}`} 
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-center bg-gradient-to-b from-slate-950 to-slate-900 border border-white/5">
                      <Tv className="w-8 h-8 text-pink-500/40 animate-pulse" />
                      <span className="text-xs text-slate-400 font-bold">Instagram Video Sandbox</span>
                      <p className="text-[10px] text-slate-500 max-w-[190px]">Instagram strict rates bypassed. Serving dynamic metadata & transcript RAG.</p>
                      <a 
                        href={`https://www.instagram.com/reel/${videoB.video_id_raw}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-pink-400 border border-pink-500/20 px-3 py-1 bg-pink-500/10 rounded-md hover:bg-pink-500/20 transition-all mt-1"
                      >
                        Watch on Instagram
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] text-pink-400 font-extrabold uppercase tracking-wide bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                      {videoB.platform}
                    </span>
                    <h3 className="text-white font-bold text-sm truncate mt-1.5" title={videoB.title}>{videoB.title}</h3>
                  </div>

                  <div className="h-[1px] bg-white/5"></div>
                  
                  {/* Statistics Details */}
                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div className="flex flex-col gap-0.5 bg-slate-950/20 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Creator</span>
                      <span className="text-white font-bold truncate">@{videoB.creator}</span>
                      <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        {videoB.follower_count.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-0.5 bg-slate-950/20 p-2 rounded-lg border border-white/5 justify-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Engagement Rate</span>
                      <span className={`text-base font-extrabold flex items-center gap-1 mt-0.5 ${
                        videoB.engagement_rate > videoA.engagement_rate ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {videoB.engagement_rate}%
                        {videoB.engagement_rate > videoA.engagement_rate && <TrendingUp className="w-4 h-4" />}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 col-span-2 justify-between px-1">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoB.views.toLocaleString()}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <ThumbsUp className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoB.likes.toLocaleString()}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <strong className="text-white">{videoB.comments.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="h-[1px] bg-white/5"></div>

                  <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Uploaded:
                      </span>
                      <span className="text-slate-300 font-bold">{videoB.upload_date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Duration:
                      </span>
                      <span className="text-slate-300 font-bold">{videoB.duration}s</span>
                    </div>
                  </div>

                  {videoB.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {videoB.hashtags.slice(0, 4).map((tag, idx) => (
                        <span key={idx} className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-950/40 rounded-md border border-white/5 flex items-center gap-0.5">
                          <Hash className="w-2.5 h-2.5 text-slate-500" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: RAG Chat Panel (col span 5) */}
          <div className="lg:col-span-5 glass-panel border-white/10 rounded-3xl flex flex-col h-[650px] bg-slate-900/25 backdrop-blur-xl w-full">
            {/* Chat Panel Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="text-emerald-400 w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-white">Creator Strategy Agent</h3>
                  <span className="text-[10px] text-emerald-400/80 font-semibold">ChromaDB Context Active</span>
                </div>
              </div>
              
              <button 
                onClick={() => setChatHistory([
                  {
                    role: 'assistant',
                    content: 'Memory cleared! Ask me a new strategy question comparing the videos.'
                  }
                ])}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold border border-white/5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                Clear Chat
              </button>
            </div>

            {/* Chat Messages Logs */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4.5 scrollbar-thin">
              {chatHistory.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col gap-2 max-w-[85%] ${
                    msg.role === 'user' ? 'self-end items-end' : 'self-start'
                  }`}
                >
                  <div className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-100 rounded-br-none' 
                      : 'bg-slate-950/65 border border-white/5 text-slate-300 rounded-bl-none'
                  }`}>
                    {msg.content ? (
                      <p className="whitespace-pre-line">{msg.content}</p>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500 italic">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating response...
                      </span>
                    )}
                  </div>
                  
                  {/* Sources / Citations list */}
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-col gap-1.5 pl-2 mt-0.5">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-slate-500" />
                        Source citations:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {msg.citations.map((cite, cIdx) => (
                          <div 
                            key={cIdx} 
                            className="text-[9px] text-slate-400 border border-white/5 px-2 py-0.5 rounded bg-slate-950/40 cursor-help"
                            title={`Chunk ${cite.chunk_index}: ${cite.content}`}
                          >
                            <span className={`font-bold ${cite.video_id === 'A' ? 'text-red-400' : 'text-pink-400'} mr-1`}>
                              [{cite.video_id}]
                            </span>
                            @{cite.creator}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Presets Menu */}
            {chatHistory.length <= 2 && (
              <div className="px-5 pb-3 flex flex-col gap-1.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1 pl-1">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
                  Ask strategic presets:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {presetQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q.query)}
                      className="text-[10px] text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 border border-white/5 px-3 py-1.5 rounded-xl bg-slate-950/45 text-left transition-all active:scale-95 leading-normal"
                      disabled={chatLoading}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input Box */}
            <div className="p-4 border-t border-white/5 bg-slate-950/40 rounded-b-3xl">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask a strategic question comparing hooks, views..." 
                  className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-emerald-500/35 transition-all text-slate-200 placeholder:text-slate-600"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                  disabled={chatLoading}
                />
                
                <button 
                  onClick={() => handleSendMessage()}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                  disabled={chatLoading}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
