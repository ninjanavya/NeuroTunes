"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type EmotionType = 'happy' | 'sad' | 'chill' | 'energetic' | 'focused' | 'stressed';

export interface Track {
  videoId: string;
  title: string;
  artist?: string;
  source?: string;
  addedBy?: string;
}

interface JamRoomState {
  code: string | null;
  host: string | null;
  members: string[];
  queue: Track[];
  activeSong: Track | null;
  isPlaying: boolean;
  currentOffset: number;
  reactions: {
    likes: string[];
    dislikes: string[];
  };
}

interface VibeContextType {
  emotion: EmotionType;
  setEmotion: (emotion: EmotionType) => void;
  activeTrack: Track | null;
  playTrack: (track: Track) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playQueue: Track[];
  setPlayQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  addToQueue: (track: Track) => void;
  removeFromQueue: (videoId: string) => void;
  
  // Auth
  token: string | null;
  username: string | null;
  loginUser: (userToken: string, name: string) => void;
  logoutUser: () => void;
  
  // Jam Room
  jamRoom: JamRoomState;
  createJamRoom: () => void;
  joinJamRoom: (code: string) => void;
  leaveJamRoom: () => void;
  addSongToJam: (track: Track) => void;
  nextJamSong: () => void;
  sendJamPlayback: (action: 'play' | 'pause' | 'seek', offset?: number) => void;
  sendJamReaction: (reactionType: 'like' | 'dislike') => void;
  errorMsg: string | null;
  setErrorMsg: (msg: string | null) => void;
}

const VibeContext = createContext<VibeContextType | undefined>(undefined);

export const VibeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [emotion, setEmotion] = useState<EmotionType>('happy');
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playQueue, setPlayQueue] = useState<Track[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentication
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Jam Room State
  const [jamRoom, setJamRoom] = useState<JamRoomState>({
    code: null,
    host: null,
    members: [],
    queue: [],
    activeSong: null,
    isPlaying: false,
    currentOffset: 0,
    reactions: { likes: [], dislikes: [] }
  });

  const socketRef = useRef<Socket | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Fetch token/user from LocalStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('nt_token');
    const savedUser = localStorage.getItem('nt_username');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUsername(savedUser);
    }
  }, []);

  // Socket setup
  useEffect(() => {
    // Only connect when username is set
    if (!username) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO connected to backend:', socket.id);
      const savedRoomCode = localStorage.getItem('nt_jam_room_code');
      if (savedRoomCode) {
        socket.emit('join_room', { roomCode: savedRoomCode, username });
      }
    });

    socket.on('room_created', (room) => {
      localStorage.setItem('nt_jam_room_code', room.code);
      setJamRoom({
        code: room.code,
        host: room.host,
        members: room.members,
        queue: room.queue,
        activeSong: room.activeSong,
        isPlaying: room.isPlaying,
        currentOffset: room.currentOffset,
        reactions: room.reactions || { likes: [], dislikes: [] }
      });
      setErrorMsg(null);
    });

    socket.on('room_state', (room) => {
      localStorage.setItem('nt_jam_room_code', room.code);
      setJamRoom({
        code: room.code,
        host: room.host,
        members: room.members,
        queue: room.queue,
        activeSong: room.activeSong,
        isPlaying: room.isPlaying,
        currentOffset: room.currentOffset,
        reactions: room.reactions || { likes: [], dislikes: [] }
      });
      
      // Auto-load song if room has active track
      if (room.activeSong) {
        isSyncingRef.current = true;
        setActiveTrack(room.activeSong);
        setIsPlaying(room.isPlaying);
        isSyncingRef.current = false;
      }
      setErrorMsg(null);
    });

    socket.on('member_update', ({ members }) => {
      setJamRoom(prev => ({ ...prev, members }));
    });

    socket.on('queue_update', ({ queue }) => {
      setJamRoom(prev => ({ ...prev, queue }));
    });

    socket.on('playback_change', (data: { action: string; activeSong: Track | null; isPlaying: boolean; currentOffset: number }) => {
      isSyncingRef.current = true;
      if (data.activeSong) {
        setActiveTrack(data.activeSong);
      } else {
        setActiveTrack(null);
      }
      setIsPlaying(data.isPlaying);
      setJamRoom(prev => ({
        ...prev,
        activeSong: data.activeSong,
        isPlaying: data.isPlaying,
        currentOffset: data.currentOffset
      }));
      isSyncingRef.current = false;
    });

    socket.on('sync', (data: { isPlaying: boolean; currentOffset: number }) => {
      isSyncingRef.current = true;
      setIsPlaying(data.isPlaying);
      isSyncingRef.current = false;
    });

    socket.on('reaction_update', (reactions) => {
      setJamRoom(prev => ({
        ...prev,
        reactions: reactions || { likes: [], dislikes: [] }
      }));
    });

    socket.on('error_message', (msg: string) => {
      setErrorMsg(msg);
      if (msg.includes('not found') || msg.includes('expired')) {
        localStorage.removeItem('nt_jam_room_code');
        setJamRoom({
          code: null,
          host: null,
          members: [],
          queue: [],
          activeSong: null,
          isPlaying: false,
          currentOffset: 0,
          reactions: { likes: [], dislikes: [] }
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [username]);

  // Auth Operations
  const loginUser = (userToken: string, name: string) => {
    localStorage.setItem('nt_token', userToken);
    localStorage.setItem('nt_username', name);
    setToken(userToken);
    setUsername(name);
  };

  const logoutUser = () => {
    localStorage.removeItem('nt_token');
    localStorage.removeItem('nt_username');
    setToken(null);
    setUsername(null);
    leaveJamRoom();
  };

  // Local Playback Actions
  const playTrack = (track: Track) => {
    setActiveTrack(track);
    setIsPlaying(true);
    
    // Save to history on backend
    if (token) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      fetch(`${apiUrl}/api/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          songName: track.title,
          source: track.source || 'youtube',
          mood: emotion
        })
      }).catch(err => console.error('Failed to log track history:', err));
    }

    // Broadcast to jam room if inside one
    if (jamRoom.code && socketRef.current && !isSyncingRef.current) {
      socketRef.current.emit('playback_control', {
        roomCode: jamRoom.code,
        action: 'play',
        activeSong: track,
        currentOffset: 0
      });
    }
  };

  const addToQueue = (track: Track) => {
    setPlayQueue(prev => {
      if (prev.find(item => item.videoId === track.videoId)) return prev;
      return [...prev, track];
    });
  };

  const removeFromQueue = (videoId: string) => {
    setPlayQueue(prev => prev.filter(item => item.videoId !== videoId));
  };

  // Jam Room Operations
  const createJamRoom = () => {
    if (socketRef.current && username) {
      socketRef.current.emit('create_room', { username });
    }
  };

  const joinJamRoom = (code: string) => {
    if (socketRef.current && username) {
      socketRef.current.emit('join_room', { roomCode: code, username });
    }
  };

  const leaveJamRoom = () => {
    if (socketRef.current && jamRoom.code && username) {
      socketRef.current.emit('leave_room', { roomCode: jamRoom.code, username });
      localStorage.removeItem('nt_jam_room_code');
      setJamRoom({
        code: null,
        host: null,
        members: [],
        queue: [],
        activeSong: null,
        isPlaying: false,
        currentOffset: 0,
        reactions: { likes: [], dislikes: [] }
      });
    }
  };

  const addSongToJam = (track: Track) => {
    if (socketRef.current && jamRoom.code && username) {
      socketRef.current.emit('add_song', {
        roomCode: jamRoom.code,
        song: track,
        username
      });
    }
  };

  const nextJamSong = () => {
    if (socketRef.current && jamRoom.code && username) {
      socketRef.current.emit('next_song', { roomCode: jamRoom.code, username });
    }
  };

  const sendJamPlayback = (action: 'play' | 'pause' | 'seek', offset?: number) => {
    if (socketRef.current && jamRoom.code && !isSyncingRef.current) {
      socketRef.current.emit('playback_control', {
        roomCode: jamRoom.code,
        action,
        activeSong: activeTrack,
        currentOffset: offset || 0
      });
    }
  };

  const sendJamReaction = (reactionType: 'like' | 'dislike') => {
    if (socketRef.current && jamRoom.code && username) {
      socketRef.current.emit('jam_reaction', {
        roomCode: jamRoom.code,
        username,
        reactionType
      });
    }
  };

  return (
    <VibeContext.Provider value={{
      emotion,
      setEmotion,
      activeTrack,
      playTrack,
      isPlaying,
      setIsPlaying,
      playQueue,
      setPlayQueue,
      addToQueue,
      removeFromQueue,
      token,
      username,
      loginUser,
      logoutUser,
      jamRoom,
      createJamRoom,
      joinJamRoom,
      leaveJamRoom,
      addSongToJam,
      nextJamSong,
      sendJamPlayback,
      sendJamReaction,
      errorMsg,
      setErrorMsg
    }}>
      {children}
    </VibeContext.Provider>
  );
};

export const useVibe = () => {
  const context = useContext(VibeContext);
  if (context === undefined) {
    throw new Error('useVibe must be used within a VibeProvider');
  }
  return context;
};
