// server/routes/rooms.js
import express from 'express';
import Room from '../models/Room.js';

const router = express.Router();

// POST /api/rooms/join - Join or create a room
router.post('/join', async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ 
        error: 'Room ID is required and must be a string' 
      });
    }

    const normalizedRoomId = roomId.toUpperCase().trim();

    // Validate room ID format (6-8 alphanumeric characters)
    if (!/^[A-Z0-9]{6,8}$/.test(normalizedRoomId)) {
      return res.status(400).json({ 
        error: 'Room ID must be 6-8 alphanumeric characters' 
      });
    }

    // Find existing room or create new one
    let room = await Room.findOne({ roomId: normalizedRoomId });

    if (!room) {
      // Create new room
      room = new Room({
        roomId: normalizedRoomId,
        drawingData: [],
        activeUsers: 0
      });
      await room.save();
      console.log(`Created new room: ${normalizedRoomId}`);
    } else {
      // Update last activity for existing room
      room.lastActivity = new Date();
      await room.save();
      console.log(`Joining existing room: ${normalizedRoomId}`);
    }

    res.json({
      success: true,
      roomId: normalizedRoomId,
      drawingData: room.drawingData,
      activeUsers: room.activeUsers,
      message: room.drawingData.length === 0 ? 'New room created' : 'Joined existing room'
    });

  } catch (error) {
    console.error('Error joining/creating room:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to join or create room'
    });
  }
});

// GET /api/rooms/:roomId - Get room information
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const normalizedRoomId = roomId.toUpperCase().trim();

    const room = await Room.findOne({ roomId: normalizedRoomId });

    if (!room) {
      return res.status(404).json({ 
        error: 'Room not found',
        message: 'The specified room does not exist'
      });
    }

    // Update last activity
    room.lastActivity = new Date();
    await room.save();

    res.json({
      success: true,
      roomId: room.roomId,
      drawingData: room.drawingData,
      activeUsers: room.activeUsers,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    });

  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch room information'
    });
  }
});

// GET /api/rooms - Get all active rooms (for admin/debugging)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find(
      { activeUsers: { $gt: 0 } },
      { roomId: 1, activeUsers: 1, createdAt: 1, lastActivity: 1 }
    ).sort({ lastActivity: -1 });

    res.json({
      success: true,
      rooms,
      count: rooms.length
    });

  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch rooms'
    });
  }
});

// DELETE /api/rooms/:roomId - Delete a room (for admin/cleanup)
router.delete('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const normalizedRoomId = roomId.toUpperCase().trim();

    const room = await Room.findOneAndDelete({ roomId: normalizedRoomId });

    if (!room) {
      return res.status(404).json({ 
        error: 'Room not found',
        message: 'The specified room does not exist'
      });
    }

    res.json({
      success: true,
      message: `Room ${normalizedRoomId} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete room'
    });
  }
});

export default router;