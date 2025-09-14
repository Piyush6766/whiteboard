import React from 'react';
import { useState, useEffect } from 'react';
import RoomJoin from './components/RoomJoin';
import Whiteboard from './components/Whiteboard';
import { useSocket } from './hooks/useSocket';

function App() {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState(null);

  const { socket, isConnected: socketConnected } = useSocket('http://localhost:5000');

  useEffect(() => {
    if (!socket) return;

    // Update connection status based on socket hook
    setIsConnected(socketConnected);

    // Handle room join confirmation
    socket.on('room-joined', (data) => {
      setCurrentRoom(data.roomId);
      setUserCount(data.userCount);
      setError(null);
      console.log('Successfully joined room:', data.roomId);
    });

    // Handle user count updates
    socket.on('user-count-update', (data) => {
      setUserCount(data.count);
    });

    // Handle errors
    socket.on('error', (data) => {
      setError(data.message || 'An error occurred');
    });

    return () => {
      if (socket) {
        socket.off('room-joined');
        socket.off('user-count-update');
        socket.off('error');
      }
    };
  }, [socket, socketConnected]);

  const handleJoinRoom = async (roomId) => {
    if (!socket || !isConnected) {
      setError('Not connected to server. Please wait and try again.');
      return;
    }

    try {
      // First, validate room with API
      const response = await fetch(`http://localhost:5000/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: roomId.toUpperCase().trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room');
      }

      // If API call successful, join via socket
      socket.emit('join-room', {
        roomId: data.roomId,
        userId: `user-${Date.now()}`
      });

    } catch (err) {
      setError(err.message);
      console.error('Error joining room:', err);
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    setCurrentRoom(null);
    setUserCount(0);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Collaborative Whiteboard
              </h1>
              {currentRoom && (
                <div className="ml-6 flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    Room: <span className="font-mono font-semibold">{currentRoom}</span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Users: <span className="font-semibold">{userCount}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {currentRoom && (
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Leave Room
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-800">{error}</span>
                </div>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentRoom ? (
          <RoomJoin onJoinRoom={handleJoinRoom} isConnected={isConnected} />
        ) : (
          <Whiteboard socket={socket} roomId={currentRoom} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Collaborative Whiteboard - Real-time drawing with friends
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;