"use client";
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

// Phase 7.3: Native WebSockets Connection resolving state arrays symmetrically
export function useRealtime(triggerLiveUpdate: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const callbackRef = useRef(triggerLiveUpdate);

  useEffect(() => {
    callbackRef.current = triggerLiveUpdate;
  }, [triggerLiveUpdate]);

  useEffect(() => {
    // 1. Establish Native WebSocket Handshake with NestJS Hub
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const socket = io(API_URL);

    socket.on('connect', () => {
      setIsConnected(true);
      setLastSync(Date.now());
      console.log("[useRealtime] WebSocket connected natively to backend authority.");
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log("[useRealtime] WebSocket channel disconnected.");
    });

    socket.on('schedule_mutation', () => {
       console.log("[useRealtime] Intercepted Live Mutation broadcast!");
       callbackRef.current();
       setLastSync(Date.now());
    });

    // 2. Local ticking enabling "On-Duty" dashboard elements to refresh visually
    const aliveInterval = setInterval(() => {
      setLastSync(Date.now());
      // Re-trigger visual tick if desired, but date constraints will auto-calculate 
      // off the `lastSync` clock anyway!
    }, 15000);

    return () => {
       socket.disconnect();
       clearInterval(aliveInterval);
    };
  }, []);

  return { isConnected, lastSync };
}
