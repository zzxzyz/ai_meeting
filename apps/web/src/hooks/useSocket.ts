import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenManager } from '../api/client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

export const useSocket = (): { socket: Socket | null; isConnected: boolean } => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const accessToken = tokenManager.getAccessToken();
    if (!accessToken) return;

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket'],
        autoConnect: true,
      });
    }

    socketRef.current = socketInstance;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      socketInstance?.off('connect', handleConnect);
      socketInstance?.off('disconnect', handleDisconnect);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
};
