import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

export type Role = 'Host' | 'Moderator' | 'Participant';

export interface Participant {
  id: string;
  username: string;
  role: Role;
}

export interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface VideoState {
  videoId: string;
  playState: 'playing' | 'paused';
  currentTime: number;
  lastUpdateTime: number;
}

interface SocketContextContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  backendUrl: string;
  roomId: string | null;
  currentUser: Participant | null;
  participants: Participant[];
  messages: ChatMessage[];
  videoState: VideoState;
  
  // Methods
  joinRoom: (roomId: string, username: string) => void;
  leaveRoom: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekVideo: (time: number) => void;
  changeVideo: (videoId: string) => void;
  sendMessage: (message: string) => void;
  assignRole: (userId: string, role: Role) => void;
  transferHost: (userId: string) => void;
  kickParticipant: (userId: string) => void;
}

const SocketContext = createContext<SocketContextContextType | null>(null);

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const pendingJoinRef = useRef<{ roomId: string; username: string } | null>(null);
  const [videoState, setVideoState] = useState<VideoState>({
    videoId: '',
    playState: 'paused',
    currentTime: 0,
    lastUpdateTime: Date.now()
  });

  useEffect(() => {
    console.log('[SocketProvider] Initializing new socket connection');
    const newSocket = io(SOCKET_URL, {
      autoConnect: false, // We connect manually when joining
      reconnection: true,
      reconnectionAttempts: Infinity
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
    });
    newSocket.on('disconnect', () => {
        setIsConnected(false);
        // Keep last error (if any) so UI can display it
        setRoomId(null);
        setParticipants([]);
        setMessages([]);
        setCurrentUser(null);
    });
    newSocket.on('connect_error', (err) => {
        const msg = err?.message || String(err);
        console.error('[socket] connect_error', msg);
        setIsConnected(false);
        setConnectionError(msg);
    });

    newSocket.on('user_joined', ({ username, userId, role, participants: newParticipants }) => {
        setParticipants(newParticipants);
        if (userId === newSocket.id) {
            setCurrentUser({ id: userId, username, role });
        }
    });

    newSocket.on('user_left', ({ participants: newParticipants }) => {
        setParticipants(newParticipants);
    });

    newSocket.on('sync_state', (state: VideoState) => {
        setVideoState(state);
    });

    newSocket.on('role_assigned', ({ userId, role, participants: newParticipants }) => {
        setParticipants(newParticipants);
        if (userId === newSocket.id) {
            setCurrentUser(prev => prev ? { ...prev, role } : null);
        }
    });

    newSocket.on('participant_removed', ({ participants: newParticipants }) => {
        setParticipants(newParticipants);
    });

    newSocket.on('chat_message', (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
    });

    newSocket.on('kicked', () => {
        alert("You have been removed from the room by the Host.");
        newSocket.disconnect();
        window.location.href = '/';
    });
    
    newSocket.on('error_message', ({ message }) => {
        alert(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((newRoomId: string, username: string) => {
    console.log('[joinRoom] called for roomId:', newRoomId, 'username:', username, 'socket exists:', !!socket);
    if (!socket) return;

    pendingJoinRef.current = { roomId: newRoomId, username };
    setRoomId(newRoomId);

    const emitJoin = () => {
        const pending = pendingJoinRef.current;
        if (!pending) return;
        console.log('[joinRoom] emitting join_room event after connect');
        socket.emit('join_room', { roomId: pending.roomId, username: pending.username });
    };

    if (!socket.connected) {
        console.log('[joinRoom] manually calling socket.connect()');
        socket.connect();
        socket.once('connect', emitJoin);
        return;
    }

    emitJoin();
  }, [socket]);

  const leaveRoom = useCallback(() => {
    console.log('[leaveRoom] called. socket exists:', !!socket);
    if (socket) {
      if (roomId) {
        socket.emit('leave_room', { roomId });
      }
      console.log('[leaveRoom] disconnecting socket');
      socket.disconnect();
      setRoomId(null);
      setParticipants([]);
      setMessages([]);
      setCurrentUser(null);
    }
  }, [socket, roomId]);

  const playVideo = () => socket?.emit('play', {});
  const pauseVideo = () => socket?.emit('pause', {});
  const seekVideo = (time: number) => socket?.emit('seek', { time });
  const changeVideo = (videoId: string) => socket?.emit('change_video', { videoId });
  const sendMessage = (message: string) => socket?.emit('chat_message', { message });
  
  const assignRole = (userId: string, role: Role) => socket?.emit('assign_role', { userId, role });
  const transferHost = (userId: string) => socket?.emit('transfer_host', { userId });
  const kickParticipant = (userId: string) => socket?.emit('remove_participant', { userId });

  const value = {
    socket,
    isConnected,
    connectionError,
    backendUrl: SOCKET_URL,
    roomId,
    currentUser,
    participants,
    messages,
    videoState,
    joinRoom,
    leaveRoom,
    playVideo,
    pauseVideo,
    seekVideo,
    changeVideo,
    sendMessage,
    assignRole,
    transferHost,
    kickParticipant
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
