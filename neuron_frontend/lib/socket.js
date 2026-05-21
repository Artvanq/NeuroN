import { io } from 'socket.io-client';
import { getToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket = null;

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  if (typeof window === 'undefined') return null;

  const token = getToken();
  if (!token) {
    resetSocket();
    return null;
  }

  if (socket?.connected) {
    socket.auth = { token };
    return socket;
  }

  resetSocket();
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
  });

  return socket;
}

export function disconnectSocket() {
  resetSocket();
}
