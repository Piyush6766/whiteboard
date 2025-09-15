// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ✅ Allowed Origins (both local + production)
const allowedOrigins = [
  "http://localhost:5173",
  "https://whiteboard-sand-mu.vercel.app" // ✅ Your Vercel frontend
];

// ✅ Global Middleware
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

// ✅ MongoDB Setup
const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  drawingData: { type: Array, default: [] },
  activeUsers: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", RoomSchema);

const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("✅ MongoDB connected successfully");
    } else {
      console.log("⚠️  No MongoDB URI provided - running in memory mode");
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.log("⚠️  Continuing without database - data will not persist");
  }
};

connectDB();

// ✅ Socket.IO Setup with correct CORS for Render
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// ✅ In-Memory Data Structures
const rooms = new Map();
const userSessions = new Map();
const roomDrawings = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join-room", async ({ roomId, userId }) => {
    try {
      const normalizedRoomId = roomId.toUpperCase().trim();

      // Leave previous room if any
      const prevSession = userSessions.get(socket.id);
      if (prevSession) await leaveRoom(socket, prevSession.roomId);

      // Join new room
      socket.join(normalizedRoomId);
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
        roomDrawings.set(normalizedRoomId, []);
      }

      rooms.get(normalizedRoomId).add(socket.id);
      userSessions.set(socket.id, {
        roomId: normalizedRoomId,
        userId: userId || `user-${Date.now()}`,
      });

      const userCount = rooms.get(normalizedRoomId).size;

      // Send existing drawings to new user
      socket.emit("drawing-data", {
        drawingData: roomDrawings.get(normalizedRoomId) || [],
      });

      // Notify others
      io.to(normalizedRoomId).emit("room-joined", {
        roomId: normalizedRoomId,
        userCount,
      });

      io.to(normalizedRoomId).emit("user-count-update", { count: userCount });

      console.log(`👤 User joined room ${normalizedRoomId} (${userCount} users)`);

      // Update DB if available
      if (mongoose.connection.readyState === 1) {
        await Room.findOneAndUpdate(
          { roomId: normalizedRoomId },
          { activeUsers: userCount, lastActivity: new Date() },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("cursor-move", (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;
    socket.to(session.roomId).emit("cursor-update", {
      userId: session.userId,
      socketId: socket.id,
      x: data.x,
      y: data.y,
      timestamp: Date.now(),
    });
  });

  socket.on("draw-start", (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;
    socket.to(session.roomId).emit("draw-start", {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now(),
    });
  });

  socket.on("draw-move", (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;
    socket.to(session.roomId).emit("draw-move", {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now(),
    });
  });

  socket.on("draw-end", async (data) => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    const drawData = {
      ...data,
      userId: session.userId,
      socketId: socket.id,
      timestamp: Date.now(),
      type: "stroke",
    };

    if (!roomDrawings.has(session.roomId)) {
      roomDrawings.set(session.roomId, []);
    }
    roomDrawings.get(session.roomId).push(drawData);

    socket.to(session.roomId).emit("draw-end", drawData);

    if (mongoose.connection.readyState === 1) {
      await Room.findOneAndUpdate(
        { roomId: session.roomId },
        { $push: { drawingData: drawData }, lastActivity: new Date() },
        { upsert: true }
      );
    }
  });

  socket.on("clear-canvas", async () => {
    const session = userSessions.get(socket.id);
    if (!session) return;

    roomDrawings.set(session.roomId, []);
    io.to(session.roomId).emit("clear-canvas", {
      userId: session.userId,
      timestamp: Date.now(),
    });

    if (mongoose.connection.readyState === 1) {
      await Room.findOneAndUpdate(
        { roomId: session.roomId },
        { drawingData: [], lastActivity: new Date() },
        { upsert: true }
      );
    }
  });

  socket.on("leave-room", () => {
    const session = userSessions.get(socket.id);
    if (session) leaveRoom(socket, session.roomId);
  });

  socket.on("disconnect", () => {
    const session = userSessions.get(socket.id);
    if (session) leaveRoom(socket, session.roomId);
    console.log("🔌 Socket disconnected:", socket.id);
  });
});

async function leaveRoom(socket, roomId) {
  if (!roomId || !rooms.has(roomId)) return;
  const roomUsers = rooms.get(roomId);
  roomUsers.delete(socket.id);
  socket.leave(roomId);

  const userCount = roomUsers.size;
  if (userCount === 0) {
    rooms.delete(roomId);
    setTimeout(() => {
      if (!rooms.has(roomId)) roomDrawings.delete(roomId);
    }, 5 * 60 * 1000);
  }

  io.to(roomId).emit("user-count-update", { count: userCount });

  if (mongoose.connection.readyState === 1) {
    await Room.findOneAndUpdate(
      { roomId },
      { activeUsers: userCount, lastActivity: new Date() }
    );
  }

  userSessions.delete(socket.id);
}

// ✅ REST APIs
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    activeRooms: rooms.size,
    totalUsers: userSessions.size,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/rooms/join", async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: "Room ID required" });

    const normalizedRoomId = roomId.toUpperCase().trim();
    if (!/^[A-Z0-9]{6,8}$/.test(normalizedRoomId)) {
      return res.status(400).json({ error: "Room ID must be 6-8 alphanumeric" });
    }

    let drawingData = roomDrawings.get(normalizedRoomId) || [];

    if (!drawingData.length && mongoose.connection.readyState === 1) {
      const room = await Room.findOne({ roomId: normalizedRoomId });
      if (room) {
        drawingData = room.drawingData;
        roomDrawings.set(normalizedRoomId, drawingData);
      }
    }

    const activeUsers = rooms.get(normalizedRoomId)?.size || 0;
    res.json({
      success: true,
      roomId: normalizedRoomId,
      drawingData,
      activeUsers,
      message: drawingData.length ? "Joined existing room" : "New room created",
    });
  } catch (err) {
    console.error("Error in room join API:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
});
