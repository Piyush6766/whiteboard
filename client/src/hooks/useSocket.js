import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (serverUrl) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Prevent multiple connections in React StrictMode
    if (socketRef.current?.connected) {
      return;
    }

    // Create socket connection with better configuration
    socketRef.current = io(serverUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      timeout: 20000,
      forceNew: false, 
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    // Connection event listeners
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('⏳ Attempting to reconnect...', attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('💥 Failed to reconnect to server');
      setIsConnected(false);
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [serverUrl]);

  return { socket: socketRef.current, isConnected };
};