import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Singleton socket instance
let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<Socket>(getSocket());
  const [isConnected, setIsConnected] = useState(socketRef.current.connected);

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // If already connected, update state
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const joinScan = useCallback((scanId: string) => {
    const socket = socketRef.current;
    console.log('[Socket] Joining scan room:', scanId);
    socket.emit('scan:join', scanId);
  }, []);

  const leaveScan = useCallback((scanId: string) => {
    const socket = socketRef.current;
    console.log('[Socket] Leaving scan room:', scanId);
    socket.emit('scan:leave', scanId);
  }, []);

  const onEvent = useCallback(<T>(event: string, callback: (data: T) => void) => {
    const socket = socketRef.current;
    console.log('[Socket] Subscribing to:', event);

    const wrappedCallback = (data: T) => {
      console.log('[Socket] Event received:', event, data);
      callback(data);
    };

    socket.on(event, wrappedCallback);
    return () => {
      socket.off(event, wrappedCallback);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinScan,
    leaveScan,
    onEvent,
  };
}
