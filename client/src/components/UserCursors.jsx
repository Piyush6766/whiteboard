import React from 'react';
import { useMemo } from 'react';

const UserCursors = ({ cursors }) => {
  // Generate consistent colors for users
  const getUserColor = useMemo(() => {
    const colors = [
      '#ef4444', // red
      '#3b82f6', // blue
      '#10b981', // green
      '#f97316', // orange
      '#8b5cf6', // purple
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#ec4899', // pink
      '#f59e0b', // amber
      '#6366f1', // indigo
    ];
    
    return (userId) => {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return colors[Math.abs(hash) % colors.length];
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {Array.from(cursors.entries()).map(([socketId, cursor]) => (
        <div
          key={socketId}
          className="absolute transition-all duration-75 ease-out"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Cursor Dot */}
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse"
            style={{
              backgroundColor: getUserColor(cursor.userId),
            }}
          />
          
          {/* User Label */}
          <div
            className="absolute top-5 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap"
            style={{
              backgroundColor: getUserColor(cursor.userId),
            }}
          >
            {cursor.userId.split('-')[0] || 'User'}
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserCursors;