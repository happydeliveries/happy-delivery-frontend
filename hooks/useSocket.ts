import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { SOCKET_URL } from '../constants/api';

// Singleton pattern ensures we only create ONE socket connection for the whole app
let globalSocket: Socket | null = null;
let currentSocketToken: string | null = null;

export const useSocket = () => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);

  useEffect(() => {
    if (!user) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        currentSocketToken = null;
      }
      setSocket(null);
      return;
    }

    if (!globalSocket || (token && currentSocketToken !== token)) {
      if (globalSocket) {
        globalSocket.disconnect();
      }
      currentSocketToken = token || null;
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }

    const activeSocket = globalSocket;
    setSocket(activeSocket);

    const joinBaseRooms = () => {
      if (!activeSocket || !user) return;
      if (user.role === 'driver') {
        activeSocket.emit('join_driver_room');
        activeSocket.emit('join_driver', user.id);
      } else {
        activeSocket.emit('join', user.id);
      }
    };

    joinBaseRooms();
    activeSocket.on('connect', joinBaseRooms);

    return () => {
      activeSocket.off('connect', joinBaseRooms);
    };
  }, [user?.id, user?.role, token]);

  return socket || globalSocket;
};