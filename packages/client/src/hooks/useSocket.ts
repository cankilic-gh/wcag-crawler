import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { socketJoinPayloadForScan } from '../lib/access-headers';
import { SocketRoomRegistry } from '../lib/socket-room-registry';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://wcag-crawler-server.onrender.com';

// Singleton socket instance
let socketInstance: Socket | null = null;
const roomRegistry = new SocketRoomRegistry(socketJoinPayloadForScan);

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 120000,
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
      roomRegistry.rejoin(socket);
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
    if (!socket.connected) socket.connect();
    roomRegistry.join(socket, scanId);
  }, []);

  const leaveScan = useCallback((scanId: string) => {
    const socket = socketRef.current;
    console.log('[Socket] Leaving scan room:', scanId);
    roomRegistry.leave(socket, scanId);
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

export function resetSocketSession(): void {
  if (socketInstance) roomRegistry.clear(socketInstance);
}
