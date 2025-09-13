// server/socket/socketHandlers.js
import Room from '../models/Room.js';

// Store user sessions in memory
const userSessions = new Map();
const roomUsers = new Map(); // roomId -> Set of socketIds

export const handleSocketConnection = (io, socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userId } = data;
      const normalizedRoomId = roomId.toUpperCase().trim();

      // Leave any previous room
      if (userSessions.has(socket.id)) {
        const prevRoom = userSessions.get(socket.id).roomId;
        await handleLeaveRoom(io, socket, prevRoom);
      }

      // Join the new room
      socket.join(normalizedRoomId);
      
      // Store user session
      userSessions.set(socket.id, {
        roomId: normalizedRoomId,
        userId: userId || socket.id,
        joinedAt: new Date()
      });

      // Update room users tracking
      if (!roomUsers.has(normalizedRoomId)) {
        roomUsers.set(normalizedRoomId, new Set());
      }
      roomUsers.get(normalizedRoomId).add(socket.id);

      // Update database
      const room = await Room.findOne({ roomId: normalizedRoomId });
      if (room) {
        room.activeUsers = roomUsers.get(normalizedRoomId).size;
        room.lastActivity = new Date();
        await room.save();

        // Send current drawing data to the new user
        socket.emit('drawing-data', {
          drawingData: room.drawingData
        });
      }

      // Notify all users in the room about user count update
      io.to(normalizedRoomId).emit('user-count-update', {
        count: roomUsers.get(normalizedRoomId).size
      });

      // Notify others about new user joining
      socket.to(normalizedRoomId).emit('user-joined', {
        userId: userId || socket.id,
        message: 'A user joined the room'
      });

      // Confirm join to the user
      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        userId: userId || socket.id,
        userCount: roomUsers.get(normalizedRoomId).size
      });

      console.log(`User ${socket.id} joined room ${normalizedRoomId}`);

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle cursor movement
  socket.on('cursor-move', (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    const { x, y } = data;
    
    // Broadcast cursor position to other users in the room
    socket.to(userSession.roomId).emit('cursor-update', {
      userId: userSession.userId,
      socketId: socket.id,
      x,
      y,
      timestamp: Date.now()
    });
  });

  // Handle drawing start
  socket.on('draw-start', async (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    const drawData = {
      ...data,
      userId: userSession.userId,
      socketId: socket.id,
      timestamp: Date.now()
    };

    // Broadcast to other users in the room
    socket.to(userSession.roomId).emit('draw-start', drawData);

    // Store drawing command in database
    try {
      const room = await Room.findOne({ roomId: userSession.roomId });
      if (room) {
        await room.addDrawingCommand({
          type: 'stroke',
          data: {
            type: 'start',
            ...data
          }
        });
      }
    } catch (error) {
      console.error('Error saving draw-start:', error);
    }
  });

  // Handle drawing movement
  socket.on('draw-move', async (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    const drawData = {
      ...data,
      userId: userSession.userId,
      socketId: socket.id,
      timestamp: Date.now()
    };

    // Broadcast to other users in the room
    socket.to(userSession.roomId).emit('draw-move', drawData);

    // Optionally store intermediate drawing points (be careful with performance)
    // For performance, we might want to throttle this or batch the points
  });

  // Handle drawing end
  socket.on('draw-end', async (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    const drawData = {
      ...data,
      userId: userSession.userId,
      socketId: socket.id,
      timestamp: Date.now()
    };

    // Broadcast to other users in the room
    socket.to(userSession.roomId).emit('draw-end', drawData);

    // Store final drawing command in database
    try {
      const room = await Room.findOne({ roomId: userSession.roomId });
      if (room) {
        await room.addDrawingCommand({
          type: 'stroke',
          data: {
            type: 'complete',
            ...data
          }
        });
      }
    } catch (error) {
      console.error('Error saving draw-end:', error);
    }
  });

  // Handle canvas clear
  socket.on('clear-canvas', async (data) => {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    try {
      // Clear canvas in database
      const room = await Room.findOne({ roomId: userSession.roomId });
      if (room) {
        await room.clearCanvas();
      }

      // Broadcast clear command to all users in the room
      io.to(userSession.roomId).emit('clear-canvas', {
        userId: userSession.userId,
        timestamp: Date.now()
      });

      console.log(`Canvas cleared in room ${userSession.roomId} by ${userSession.userId}`);

    } catch (error) {
      console.error('Error clearing canvas:', error);
      socket.emit('error', { message: 'Failed to clear canvas' });
    }
  });

  // Handle manual room leave
  socket.on('leave-room', async () => {
    const userSession = userSessions.get(socket.id);
    if (userSession) {
      await handleLeaveRoom(io, socket, userSession.roomId);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const userSession = userSessions.get(socket.id);
    if (userSession) {
      await handleLeaveRoom(io, socket, userSession.roomId);
    }
  });
};

// Helper function to handle leaving a room
const handleLeaveRoom = async (io, socket, roomId) => {
  if (!roomId) return;

  try {
    // Remove from room users tracking
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      
      // Clean up empty room tracking
      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
      }
    }

    // Update database
    const room = await Room.findOne({ roomId });
    if (room) {
      const currentUserCount = roomUsers.has(roomId) ? roomUsers.get(roomId).size : 0;
      room.activeUsers = currentUserCount;
      room.lastActivity = new Date();
      await room.save();

      // Notify remaining users about user count update
      io.to(roomId).emit('user-count-update', {
        count: currentUserCount
      });
    }

    // Remove user session
    const userSession = userSessions.get(socket.id);
    if (userSession) {
      // Notify others about user leaving
      socket.to(roomId).emit('user-left', {
        userId: userSession.userId,
        message: 'A user left the room'
      });
    }

    userSessions.delete(socket.id);
    socket.leave(roomId);

    console.log(`User ${socket.id} left room ${roomId}`);

  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

// Periodic cleanup of old rooms (run every hour)
setInterval(async () => {
  try {
    await Room.cleanupOldRooms();
  } catch (error) {
    console.error('Error during periodic cleanup:', error);
  }
}, 60 * 60 * 1000); // 1 hour