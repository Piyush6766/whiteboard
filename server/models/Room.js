// server/models/Room.js
import mongoose from 'mongoose';

const DrawingCommandSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['stroke', 'clear'],
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  drawingData: [DrawingCommandSchema],
  activeUsers: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient querying
RoomSchema.index({ lastActivity: 1 });

// Static method to generate room ID
RoomSchema.statics.generateRoomId = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Method to add drawing command
RoomSchema.methods.addDrawingCommand = function(command) {
  this.drawingData.push(command);
  this.lastActivity = new Date();
  return this.save();
};

// Method to clear canvas
RoomSchema.methods.clearCanvas = function() {
  this.drawingData = [{
    type: 'clear',
    data: {},
    timestamp: new Date()
  }];
  this.lastActivity = new Date();
  return this.save();
};

// Clean up old rooms (older than 24 hours with no activity)
RoomSchema.statics.cleanupOldRooms = async function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const result = await this.deleteMany({
      lastActivity: { $lt: oneDayAgo },
      activeUsers: 0
    });
    console.log(`Cleaned up ${result.deletedCount} old rooms`);
    return result;
  } catch (error) {
    console.error('Error cleaning up old rooms:', error);
  }
};

export default mongoose.model('Room', RoomSchema);