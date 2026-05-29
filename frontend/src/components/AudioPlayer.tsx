"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useVibe, Track } from '../context/VibeContext';
import { Play, Pause, SkipForward, Volume2, Heart, ThumbsDown, User, Layers, Radio } from 'lucide-react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | undefined;
    YT: any;
  }
}

export const AudioPlayer: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    setIsPlaying,
    playQueue,
    setPlayQueue,
    playTrack,
    token,
    emotion,
    jamRoom,
    sendJamPlayback,
    nextJamSong
  } = useVibe();

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180); // default 3 min
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isDisliked, setIsDisliked] = useState<boolean>(false);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScrubbingRef = useRef<boolean>(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const initPlayer = () => {
    if (playerRef.current) return;
    try {
      const container = containerRef.current;
      if (!container) return;

      // Clean container first to avoid duplicate node mounts
      container.innerHTML = '';

      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player-iframe-node';
      container.appendChild(playerDiv);

      playerRef.current = new window.YT.Player('youtube-player-iframe-node', {
        height: '200',
        width: '200',
        videoId: activeTrack?.videoId || '',
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(volume);
            if (activeTrack) {
              event.target.loadVideoById(activeTrack.videoId);
              if (isPlaying) event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED = 0
            if (event.data === 0) {
              handleTrackEnded();
            }
            // YT.PlayerState.PLAYING = 1
            if (event.data === 1) {
              setDuration(event.target.getDuration() || 180);
              startProgressTracker();
            }
          }
        }
      });
    } catch (e) {
      console.error('YouTube player init failed', e);
    }
  };

  // Sync state changes with player
  useEffect(() => {
    if (!playerRef.current || !playerRef.current.loadVideoById) return;

    let currentVideoId = '';
    try {
      const videoData = playerRef.current.getVideoData ? playerRef.current.getVideoData() : null;
      if (videoData && videoData.video_id) {
        currentVideoId = videoData.video_id;
      }
    } catch (err) {
      // Ignore if player is not ready yet
    }
    
    if (activeTrack && activeTrack.videoId !== currentVideoId) {
      playerRef.current.loadVideoById(activeTrack.videoId);
      setIsLiked(false);
      setIsDisliked(false);
      if (isPlaying) {
        playerRef.current.playVideo();
      }
    } else if (activeTrack) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } else {
      playerRef.current.stopVideo();
    }
  }, [activeTrack, isPlaying]);

  // Sync volume
  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Sync room currentOffset if updated by server
  useEffect(() => {
    if (jamRoom.code && jamRoom.activeSong && playerRef.current && playerRef.current.seekTo) {
      const diff = Math.abs(currentTime - jamRoom.currentOffset);
      if (diff > 2) {
        playerRef.current.seekTo(jamRoom.currentOffset, true);
        setCurrentTime(jamRoom.currentOffset);
      }
    }
  }, [jamRoom.currentOffset]);

  const startProgressTracker = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && !isScrubbingRef.current) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        
        // Sync timestamp offset periodically if we are the host of a Jam Room
        if (jamRoom.code && jamRoom.host === localStorage.getItem('nt_username') && Math.floor(time) % 5 === 0) {
          sendJamPlayback('seek', time);
        }
      }
    }, 1000);
  };

  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    
    if (jamRoom.code) {
      sendJamPlayback(newState ? 'play' : 'pause', currentTime);
    }
  };

  const handleTrackEnded = () => {
    if (jamRoom.code) {
      const currentUsername = localStorage.getItem('nt_username');
      if (jamRoom.host === currentUsername) {
        nextJamSong();
      }
    } else if (playQueue.length > 0) {
      const nextSong = playQueue[0];
      setPlayQueue(prev => prev.slice(1));
      playTrack(nextSong);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSkip = () => {
    const currentUsername = localStorage.getItem('nt_username');
    if (jamRoom.code && jamRoom.host !== currentUsername) {
      return; // non-hosts cannot skip
    }

    // Report skip (dislike feedback) to ML microservice for reinforcement learning weights subtraction
    if (activeTrack) {
      submitReinforcementFeedback(activeTrack.title, false);
    }

    if (jamRoom.code) {
      nextJamSong();
    } else if (playQueue.length > 0) {
      const nextSong = playQueue[0];
      setPlayQueue(prev => prev.slice(1));
      playTrack(nextSong);
    }
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isScrubbingRef.current = true;
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
  };

  const handleScrubEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    isScrubbingRef.current = false;
    if (playerRef.current && playerRef.current.seekTo) {
      const targetTime = currentTime;
      playerRef.current.seekTo(targetTime, true);
      
      if (jamRoom.code) {
        sendJamPlayback('seek', targetTime);
      }
    }
  };

  // Submit reinforcement learning feedback (post user choice vector)
  const submitReinforcementFeedback = async (songName: string, liked: boolean) => {
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000';
    try {
      await fetch(`${mlUrl}/api/reinforcement-learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: songName, liked })
      });
      console.log(`[ML Reinforcement] Feedback registered for ${songName}: liked=${liked}`);
    } catch (e) {
      console.error('Failed to report reinforcement weights feedback:', e);
    }
  };

  const handleLike = () => {
    if (!activeTrack) return;
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    if (newLiked) setIsDisliked(false);
    submitReinforcementFeedback(activeTrack.title, newLiked);
  };

  const handleDislike = () => {
    if (!activeTrack) return;
    const newDisliked = !isDisliked;
    setIsDisliked(newDisliked);
    if (newDisliked) setIsLiked(false);
    submitReinforcementFeedback(activeTrack.title, !newDisliked);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const vibeBorders: Record<string, string> = {
    stressed: 'border-cyan-500/20 shadow-cyan-500/5',
    energetic: 'border-pink-500/20 shadow-pink-500/5',
    sad: 'border-indigo-500/20 shadow-indigo-500/5',
    focused: 'border-emerald-500/20 shadow-emerald-500/5',
    happy: 'border-purple-500/20 shadow-purple-500/5',
    chill: 'border-blue-500/20 shadow-blue-500/5',
  };

  const glowColor = vibeBorders[emotion] || vibeBorders.happy;

  // Stable rendering structure - player element must never unmount
  return (
    <>
      <div ref={containerRef} className="fixed -top-[9999px] -left-[9999px] w-[200px] h-[200px] pointer-events-none opacity-0" />

      {activeTrack && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-4xl glass-panel border ${glowColor} shadow-xl rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 z-40 transition-all duration-700`}>
          {/* Track Metadata */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 overflow-hidden shadow-inner">
                <Radio className={`w-6 h-6 ${isPlaying ? 'text-purple-400 animate-spin-slow' : 'text-slate-500'}`} />
              </div>
              {isPlaying && (
                <div className="absolute inset-0 flex items-end justify-center pb-2 gap-[3px] bg-black/40 rounded-xl">
                  <span className="w-1 h-3 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                  <span className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                  <span className="w-1 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.5s]"></span>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate text-sm md:text-base max-w-[240px]">{activeTrack.title}</h4>
              <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                {activeTrack.artist || 'Web Stream'}
                {jamRoom.code && (
                  <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5" /> Jam
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Playback Progress */}
          <div className="flex-1 w-full max-w-md flex items-center gap-3">
            <span className="text-slate-400 text-xs font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleScrubChange}
              onMouseUp={handleScrubEnd}
              onTouchEnd={handleScrubEnd}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <span className="text-slate-400 text-xs font-mono">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
            {/* Reinforcement learning loops */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={`p-2 rounded-full border transition-all duration-300 ${
                  isLiked 
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-sm shadow-rose-500/10' 
                    : 'border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30'
                }`}
                title="Like this track (Reinforce AI recommendation)"
              >
                <Heart className="w-4 h-4 fill-current" />
              </button>
              
              <button
                onClick={handleDislike}
                className={`p-2 rounded-full border transition-all duration-300 ${
                  isDisliked 
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-sm shadow-amber-500/10' 
                    : 'border-slate-800 text-slate-500 hover:text-amber-500 hover:border-amber-500/30'
                }`}
                title="Dislike / Skip (Subtract weight from AI)"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>

            {/* Media Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold hover:scale-105 transition-all shadow-md"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              
              {(!jamRoom.code || jamRoom.host === localStorage.getItem('nt_username')) && (
                <button
                  onClick={handleSkip}
                  className="p-2.5 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
                  title="Skip Track"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              )}
            </div>

            {/* Volume controls */}
            <div className="hidden sm:flex items-center gap-2">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="text-slate-400 hover:text-white transition-all"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

