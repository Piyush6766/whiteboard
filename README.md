# Collaborative Whiteboard Application

A real-time collaborative whiteboard built with the MERN stack, featuring live drawing synchronization and cursor tracking.

## 🚀 Features

- **Real-time Collaboration**: Draw with multiple users simultaneously
- **Live Cursor Tracking**: See other users' cursor positions in real-time
- **Room-based Sessions**: Join rooms with simple 6-8 character codes
- **Drawing Tools**: Pen tool with adjustable stroke width and colors
- **Canvas Management**: Clear canvas functionality
- **Responsive Design**: Works on desktop and tablet devices
- **No Authentication Required**: Jump straight into collaboration

## 🛠️ Technology Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose
- **Real-time Communication**: Socket.IO
- **Styling**: Tailwind CSS

## 📁 Project Structure

```
collaborative-whiteboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── RoomJoin.jsx
│   │   │   ├── Whiteboard.jsx
│   │   │   ├── DrawingCanvas.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   └── UserCursors.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── server/                 # Node.js backend
│   ├── models/
│   │   └── Room.js
│   ├── routes/
│   │   └── rooms.js
│   ├── socket/
│   │   └── socketHandlers.js
│   ├── server.js
│   └── package.json
└── README.md
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-whiteboard
   ```

2. **Set up the server**
   ```bash
   # Navigate to server directory
   cd server
   
   # Install dependencies
   npm install
   
   # Create .env file
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

3. **Configure environment variables** (server/.env)
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/collaborative-whiteboard
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   ```

4. **Set up the client**
   ```bash
   # Navigate to client directory (from project root)
   cd client
   
   # Install dependencies
   npm install
   ```

5. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod --dbpath /path/to/your/db
   
   # Or use MongoDB Atlas (update MONGODB_URI in .env)
   ```

6. **Run the application**
   
   **Option 1: Run both client and server together (recommended)**
   ```bash
   # From server directory
   cd server
   npm run both
   ```
   
   **Option 2: Run separately**
   ```bash
   # Terminal 1 - Server
   cd server
   npm run dev
   
   # Terminal 2 - Client
   cd client
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/api/health

## 🎯 Usage Guide

### Joining a Room

1. **Create a new room**:
   - Click "Generate Random Room Code"
   - Share the generated code with others

2. **Join an existing room**:
   - Enter the 6-8 character room code
   - Click "Join Room"

### Drawing Features

- **Pen Tool**: Click and drag to draw
- **Colors**: Choose from 6 predefined colors
- **Stroke Width**: Adjust with predefined sizes or custom slider
- **Clear Canvas**: Clear the entire canvas (affects all users)

### Collaboration Features

- **Real-time Drawing**: See others draw as they create strokes
- **Live Cursors**: View other users' cursor positions
- **User Count**: See how many people are in the room
- **Persistent Canvas**: Drawing data is saved and restored when joining

## 🔧 API Documentation

### REST Endpoints

#### POST /api/rooms/join
Join or create a room.

**Request:**
```json
{
  "roomId": "ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "roomId": "ABC123",
  "drawingData": [],
  "activeUsers": 1,
  "message": "New room created"
}
```

#### GET /api/rooms/:roomId
Get room information.

**Response:**
```json
{
  "success": true,
  "roomId": "ABC123",
  "drawingData": [...],
  "activeUsers": 2,
  "createdAt": "2025-09-13T...",
  "lastActivity": "2025-09-13T..."
}
```

### Socket.IO Events

#### Client → Server
- `join-room`: Join a room
- `leave-room`: Leave current room
- `cursor-move`: Send cursor position
- `draw-start`: Start drawing stroke
- `draw-move`: Drawing movement data
- `draw-end`: Complete drawing stroke
- `clear-canvas`: Clear the canvas

#### Server → Client
- `room-joined`: Confirm room join
- `user-count-update`: User count changed
- `drawing-data`: Initial canvas data
- `cursor-update`: Other user's cursor position
- `draw-start`: Other user started drawing
- `draw-move`: Other user's drawing movement
- `draw-end`: Other user's complete stroke
- `clear-canvas`: Canvas was cleared
- `user-joined`: New user joined
- `user-left`: User left room

## 🏗️ Architecture Overview

### Frontend Architecture
- **React Components**: Modular component structure
- **Socket.IO Client**: Real-time communication
- **Canvas API**: HTML5 Canvas for drawing
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast development and build tool

### Backend Architecture
- **Express.js**: RESTful API server
- **Socket.IO Server**: WebSocket communication
- **MongoDB**: Document-based data storage
- **Mongoose**: ODM for MongoDB

### Data Flow
1. User joins room via REST API
2. Socket connection established
3. Drawing events broadcast via WebSocket
4. Canvas data persisted to MongoDB
5. Real-time updates to all connected clients

## 🚀 Deployment Guide

### Development Deployment

1. **Local Development**:
   ```bash
   # Server
   cd server && npm run dev
   
   # Client
   cd client && npm run dev
   ```

### Production Deployment

1. **Build the client**:
   ```bash
   cd client
   npm run build
   ```

2. **Environment Setup**:
   ```env
   # Production .env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/whiteboard
   CLIENT_URL=https://your-frontend-domain.com
   ```

3. **Deploy Options**:
   - **Heroku**: Use provided Procfile
   - **Vercel/Netlify**: For client deployment
   - **DigitalOcean/AWS**: For full-stack deployment
   - **Docker**: Use provided Dockerfile

### Docker Deployment (Optional)

1. **Create Dockerfile** (server):
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

2. **Build and run**:
   ```bash
   docker build -t whiteboard-server .
   docker run -p 5000:5000 --env-file .env whiteboard-server
   ```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Room creation and joining
- [ ] Real-time drawing synchronization
- [ ] Cursor tracking between users
- [ ] Canvas clearing functionality
- [ ] User connection/disconnection handling
- [ ] Mobile responsiveness
- [ ] Error handling and recovery

### Automated Testing (Future Enhancement)

```bash
# Add testing framework
npm install --save-dev jest @testing-library/react
npm install --save-dev supertest # for API testing
```

## 🔒 Security Considerations

- **Input Validation**: Room IDs are sanitized
- **Rate Limiting**: Cursor updates throttled
- **CORS**: Configured for specific origins
- **Data Sanitization**: Drawing data validated
- **Memory Management**: Old rooms cleaned up automatically

## 🛠️ Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   ```
   Solution: Check MongoDB service and connection string
   ```

2. **Socket Connection Failed**:
   ```
   Solution: Verify server is running and CORS settings
   ```

3. **Canvas Not Updating**:
   ```
   Solution: Check browser console for JavaScript errors
   ```

4. **Build Errors**:
   ```
   Solution: Clear node_modules and reinstall dependencies
   ```

### Debug Mode

Enable debug logging:
```bash
# Server
DEBUG=socket.io:* npm run dev

# Client
# Open browser dev tools and check console
```

## 📈 Performance Optimizations

- **Cursor Throttling**: 60fps limit for cursor updates
- **Drawing Batching**: Efficient path data transmission
- **Memory Cleanup**: Automatic old room deletion
- **Canvas Optimization**: Proper context management
- **Socket Optimization**: Event listener cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Socket.IO team for real-time communication
- React team for the frontend framework
- MongoDB team for the database solution
- Tailwind CSS for styling utilities

---

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

**Happy Collaborating! 🎨**