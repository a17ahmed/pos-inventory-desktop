import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (serverUrl) => {
    if (socket?.connected) {
        return socket;
    }

    const baseUrl = serverUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000';

    socket = io(baseUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const getSocket = () => socket;

export const joinBusinessRoom = (businessId) => {
    if (socket && businessId) {
        socket.emit('joinBusiness', businessId);
    }
};

export const leaveBusinessRoom = (businessId) => {
    if (socket && businessId) {
        socket.emit('leaveBusiness', businessId);
    }
};

export default {
    connectSocket,
    disconnectSocket,
    getSocket,
    joinBusinessRoom,
    leaveBusinessRoom,
};
