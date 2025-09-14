import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://whiteboard-eta-one.vercel.app" 
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// Simple Room Schema (if you want to use MongoDB)
const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  drawingData: { type: Array, default: [] },
  activeUsers: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', RoomSchema);

// MongoDB connection 
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected successfully');
    } else {
      console.log('⚠️  No MongoDB URI provided - running in memory mode');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Continuing without database - data will not persist');
  }
};

connectDB();

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling']
});

// In-memory room tracking
const rooms = new Map(); // roomId -> Set of socketIds
const userSessions = new Map(); // socketId -> { roomId, userId }
const roomDrawings = new Map(); // roomId -> Array of drawing commands

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // Handle room joining
  socket.on('join-room', async ({ roomId, userId }) => {
    try {
      const normalizedRoomId = roomId.toUpperCase().trim();
      
      // Leave any previous room
      const prevSession = userSessions.get(socket.id);
      if (prevSession) {
        await leaveRoom(socket, prevSession.roomId);
      }

      // Join new room
      socket.join(normalizedRoomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
        roomDrawings.set(normalizedRoomId, []);
      }
      
      rooms.get(normalizedRoomId).add(socket.id);
      userSessions.set(socket.id, { 
        roomId: normalizedRoomId, 
        userId: userId || `user-${Date.now()}` 
      });

      const userCount = rooms.get(normalizedRoomId).size;

      // Send existing drawing data to new user
      const drawingData = roomDrawings.get(normalizedRoomId) || [];
      socket.emit('drawing-data', { drawingData });

      // Notify all users in room
      io.to(normalizedRoomId).emit('room-joined', {
        roomId: normalizedRoomId,
        userCount
      });

      io.to(normalizedRoomId).emit('user-count-update', { count: userCount });

      console.log(`👤 User ${userId} joined room ${normalizedRoomId} (${userCount} users)`);

      // Update database if connected
      if (mongoose.connection.readyState === 1) {
        try {
          await Room.findOneAndUpdate(
            { roomId: normalizedRoomId },
            { activeUsers: userCount, lastActivity: new Date() },
            { upsert: true }
          );
        } catch (dbError) {
          console.log('Warning: Could not update database:', dbError.message);
        }
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle cursor movement
  socket.on('cursor-move', (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    socket.to(session.roomId).emit('cursor-update', {
      userId: session.userId,
      socketId: socket.id,
      x: data.x,
      y: data.y,
      timestamp: Date.now()
    });
  });

  // Handle drawing start
  socket.on('draw-start', (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    const drawData = {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now()
    };

    socket.to(session.roomId).emit('draw-start', drawData);
  });

  // Handle drawing movement
  socket.on('draw-move', (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    const drawData = {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now()
    };

    socket.to(session.roomId).emit('draw-move', drawData);
  });

  // Handle drawing end (save complete path)
  socket.on('draw-end', async (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    const drawData = {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now(),
      type: 'stroke'
    };

    // Save to in-memory storage
    if (!roomDrawings.has(session.roomId)) {
      roomDrawings.set(session.roomId, []);
    }
    roomDrawings.get(session.roomId).push(drawData);

    // Broadcast to other users
    socket.to(session.roomId).emit('draw-end', drawData);

    // Save to database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Room.findOneAndUpdate(
          { roomId: session.roomId },
          { 
            $push: { drawingData: drawData },
            lastActivity: new Date()
          },
          { upsert: true }
        );
      } catch (dbError) {
        console.log('Warning: Could not save to database:', dbError.message);
      }
    }

    console.log(`🎨 Drawing saved for room ${session.roomId}`);
  });

  // Handle canvas clear
  socket.on('clear-canvas', async (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    // Clear in-memory storage
    roomDrawings.set(session.roomId, []);

    // Broadcast to all users in room
    io.to(session.roomId).emit('clear-canvas', {
      userId: session.userId,
      timestamp: Date.now()
    });

    // Clear in database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Room.findOneAndUpdate(
          { roomId: session.roomId },
          { 
            drawingData: [],
            lastActivity: new Date()
          },
          { upsert: true }
        );
      } catch (dbError) {
        console.log('Warning: Could not clear database:', dbError.message);
      }
    }

    console.log(`🗑️ Canvas cleared for room ${session.roomId}`);
  });

  // Handle manual room leave
  socket.on('leave-room', () => {
    const session = userSessions.get(socket.id);
    if (session) {
      leaveRoom(socket, session.roomId);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const session = userSessions.get(socket.id);
    if (session) {
      leaveRoom(socket, session.roomId);
    }
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// Helper function to handle leaving rooms
async function leaveRoom(socket, roomId) {
  if (!roomId || !rooms.has(roomId)) return;

  const roomUsers = rooms.get(roomId);
  roomUsers.delete(socket.id);
  socket.leave(roomId);

  const userCount = roomUsers.size;

  // Clean up empty rooms
  if (userCount === 0) {
    rooms.delete(roomId);
    // Keep drawings for a while in case users rejoin
    setTimeout(() => {
      if (!rooms.has(roomId)) {
        roomDrawings.delete(roomId);
        console.log(`🗑️ Cleaned up empty room: ${roomId}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Update user count
  io.to(roomId).emit('user-count-update', { count: userCount });

  // Update database if connected
  if (mongoose.connection.readyState === 1) {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { activeUsers: userCount, lastActivity: new Date() }
      );
    } catch (dbError) {
      console.log('Warning: Could not update database:', dbError.message);
    }
  }

  userSessions.delete(socket.id);
  console.log(`👤 User left room ${roomId} (${userCount} users remaining)`);
}

// REST API Routes

// Health check with more info
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'OK',
    message: 'Server is running',
    database: dbStatus,
    activeRooms: rooms.size,
    totalUsers: userSessions.size,
    timestamp: new Date().toISOString()
  });
});

// Room join API
app.post('/api/rooms/join', async (req, res) => {
  try {
    const { roomId } = req.body;
    
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const normalizedRoomId = roomId.toUpperCase().trim();

    // Validate room ID format
    if (!/^[A-Z0-9]{6,8}$/.test(normalizedRoomId)) {
      return res.status(400).json({ 
        error: 'Room ID must be 6-8 alphanumeric characters' 
      });
    }

    // Get existing drawing data
    let drawingData = [];
    
    // First check in-memory
    if (roomDrawings.has(normalizedRoomId)) {
      drawingData = roomDrawings.get(normalizedRoomId);
    } 
    // Then check database if connected
    else if (mongoose.connection.readyState === 1) {
      try {
        const room = await Room.findOne({ roomId: normalizedRoomId });
        if (room) {
          drawingData = room.drawingData || [];
          // Load into memory for faster access
          roomDrawings.set(normalizedRoomId, drawingData);
        }
      } catch (dbError) {
        console.log('Warning: Could not fetch from database:', dbError.message);
      }
    }

    const activeUsers = rooms.get(normalizedRoomId)?.size || 0;

    res.json({
      success: true,
      roomId: normalizedRoomId,
      drawingData,
      activeUsers,
      message: drawingData.length === 0 ? 'New room created' : 'Joined existing room'
    });

  } catch (error) {
    console.error('Error in room join API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const activeUsers = rooms.get(roomId)?.size || 0;
  const drawingData = roomDrawings.get(roomId) || [];

  res.json({
    success: true,
    roomId,
    activeUsers,
    drawingCount: drawingData.length,
    exists: activeUsers > 0 || drawingData.length > 0
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Client should connect to: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📝 Make sure client connects to: http://localhost:5173`);
});

export default app;