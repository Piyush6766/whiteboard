// client/src/components/Toolbar.jsx
import React, { useState } from 'react';

const Toolbar = ({
  tool,
  setTool,
  strokeWidth,
  setStrokeWidth,
  color,
  setColor,
  onClearCanvas,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const colors = [
    { name: 'Black', value: '#000000' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Orange', value: '#f97316' },
  ];

  const strokeWidths = [
    { label: 'Thin', value: 2 },
    { label: 'Medium', value: 5 },
    { label: 'Thick', value: 10 },
    { label: 'Extra Thick', value: 15 },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 px-4">
      {/* Tool Selection */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">Tool:</span>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {/* Pen Tool */}
          <button
            onClick={() => setTool('pen')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ✏️ Pen
          </button>

          {/* Eraser Tool */}
          <button
            onClick={() => setTool('eraser')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tool === 'eraser'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🩹 Eraser
          </button>
        </div>
      </div>

      {/* Color Selection (Disabled in Eraser Mode) */}
      <div className="flex items-center space-x-2 opacity-100">
        <span className="text-sm font-medium text-gray-700">Color:</span>
        <div className="flex space-x-1">
          {colors.map((colorOption) => (
            <button
              key={colorOption.value}
              onClick={() => setColor(colorOption.value)}
              disabled={tool === 'eraser'}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                color === colorOption.value
                  ? 'border-gray-400 scale-110'
                  : 'border-gray-200 hover:border-gray-300 hover:scale-105'
              } ${tool === 'eraser' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: colorOption.value }}
              title={colorOption.name}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">
          {tool === 'eraser' ? 'Eraser Size:' : 'Size:'}
        </span>
        <div className="flex space-x-1">
          {strokeWidths.map((width) => (
            <button
              key={width.value}
              onClick={() => setStrokeWidth(width.value)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                strokeWidth === width.value
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={width.label}
            >
              <div className="flex items-center justify-center">
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: `${Math.min(width.value, 12)}px`,
                    height: `${Math.min(width.value, 12)}px`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Clear Canvas */}
      <div className="flex items-center">
        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-medium transition-colors"
          >
            🗑 Clear
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-red-700 font-medium">Clear all?</span>
            <button
              onClick={() => {
                onClearCanvas();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded text-sm font-medium transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 bg-gray-300 text-gray-700 hover:bg-gray-400 rounded text-sm font-medium transition-colors"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
