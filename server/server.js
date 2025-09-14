// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// ✅ Allowed Origins - Local + Production
const allowedOrigins = [
  "http://localhost:5173",
  "https://whiteboard-eta-one.vercel.app" // 🔑 Replace with your Vercel Frontend URL
];

// ✅ CORS setup for Express
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

// ✅ JSON parsing middleware
app.use(express.json());

// ✅ Health check route (important for Render)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running ✅" });
});

// ✅ Socket.IO Setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("draw", (data) => {
    // Broadcast drawing data to all clients except sender
    socket.broadcast.emit("draw", data);
  });

  socket.on("clear", () => {
    socket.broadcast.emit("clear");
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ User disconnected: ${socket.id} (${reason})`);
  });
});

// ✅ Server listen
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Client should connect to: ${allowedOrigins.join(", ")}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
