import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { SOCKET_URL } from '../constants/api'; 

// Singleton pattern ensures we only create ONE socket connection for the whole app
let globalSocket: Socket | null = null;

export const useSocket = () => {
  const { user } = useAuth();
  // Always return the same socket instance so we don't disconnect/reconnect on every screen change
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket'], // Forces WebSocket for faster, real-time connection
      });
    }
    
    socketRef.current = globalSocket;

    // Route users to their appropriate base rooms
    if (user.role === 'driver') {
      socketRef.current.emit('join_driver_room');
      socketRef.current.emit('join_driver', user.id);
    } else {
      socketRef.current.emit('join', user.id);
    }

  }, [user]);

  return socketRef.current || globalSocket;
};