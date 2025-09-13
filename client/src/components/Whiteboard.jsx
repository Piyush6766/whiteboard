// client/src/components/Whiteboard.jsx
import React from 'react';
import { useState, useCallback } from 'react';
import DrawingCanvas from './DrawingCanvas';
import Toolbar from './Toolbar';
import UserCursors from './UserCursors';

const Whiteboard = ({ socket, roomId }) => {
  const [tool, setTool] = useState('pen');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [color, setColor] = useState('#000000');
  const [cursors, setCursors] = useState(new Map());

  // Handle cursor updates from other users
  const handleCursorUpdate = useCallback((data) => {
    setCursors(prev => {
      const newCursors = new Map(prev);
      newCursors.set(data.socketId, {
        x: data.x,
        y: data.y,
        userId: data.userId,
        timestamp: data.timestamp
      });
      return newCursors;
    });

    // Remove old cursors after 3 seconds of inactivity
    setTimeout(() => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        const cursor = newCursors.get(data.socketId);
        if (cursor && cursor.timestamp === data.timestamp) {
          newCursors.delete(data.socketId);
        }
        return newCursors;
      });
    }, 3000);
  }, []);

  // Handle user leaving (remove their cursor)
  const handleUserLeft = useCallback((data) => {
    setCursors(prev => {
      const newCursors = new Map(prev);
      // Find and remove cursor by userId
      for (const [socketId, cursor] of newCursors) {
        if (cursor.userId === data.userId) {
          newCursors.delete(socketId);
          break;
        }
      }
      return newCursors;
    });
  }, []);

  const handleClearCanvas = () => {
    if (socket) {
      socket.emit('clear-canvas');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white shadow-sm border-b mb-4">
        <div className="py-4">
          <Toolbar
            tool={tool}
            setTool={setTool}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            color={color}
            setColor={setColor}
            onClearCanvas={handleClearCanvas}
          />
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Drawing Canvas */}
        <DrawingCanvas
          socket={socket}
          roomId={roomId}
          tool={tool}
          strokeWidth={strokeWidth}
          color={color}
          onCursorUpdate={handleCursorUpdate}
          onUserLeft={handleUserLeft}
        />

        {/* User Cursors Overlay */}
        <UserCursors cursors={cursors} />

        {/* Canvas Info Overlay */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-md text-sm">
          <div className="flex items-center space-x-4">
            <span>Room: {roomId}</span>
            <span>•</span>
            <span>{cursors.size + 1} user{cursors.size !== 0 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;