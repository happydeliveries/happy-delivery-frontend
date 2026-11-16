import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { SOCKET_URL } from '../constants/api';
import { useDriverAlertStore } from '../store/driverAlertStore';

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
      activeSocket.emit('join', user.id);
      if (user.role === 'driver') {
        activeSocket.emit('join_driver', user.id);
        if (useDriverAlertStore.getState().isOnline) {
          activeSocket.emit('join_driver_room');
        } else {
          activeSocket.emit('leave_driver_room');
        }
      } else if (user.role === 'restaurant_manager') {
        activeSocket.emit('join_manager', user.id);
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

export const useSocketStatus = (): boolean => {
  const socket = useSocket();
  const [connected, setConnected] = useState<boolean>(Boolean(socket?.connected));

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }

    setConnected(Boolean(socket.connected));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return connected;
};