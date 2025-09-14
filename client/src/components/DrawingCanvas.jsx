import React, { useRef, useEffect, useState, useCallback } from "react";

const DrawingCanvas = ({
  socket,
  roomId,
  tool,
  strokeWidth,
  color,
  onCursorUpdate,
  onUserLeft,
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const lastCursorEmit = useRef(0);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";

      // Set drawing properties
      context.lineCap = "round";
      context.lineJoin = "round";
      context.imageSmoothingEnabled = true;
    };

    resizeCanvas();
    contextRef.current = context;

    // Handle window resize
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleDrawingData = (data) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);

      data.drawingData.forEach((command) => {
        if (command.type === "clear") {
          context.clearRect(0, 0, canvas.width, canvas.height);
        } else if (
          command.type === "stroke" &&
          command.data.type === "complete"
        ) {
          drawPath(context, command.data);
        }
      });
    };

    const handleDrawEnd = (data) => {
      const context = contextRef.current;
      if (!context) return;
      drawPath(context, data);
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("drawing-data", handleDrawingData);
    socket.on("draw-end", handleDrawEnd);
    socket.on("clear-canvas", handleClearCanvas);
    socket.on("cursor-update", onCursorUpdate);
    socket.on("user-left", onUserLeft);

    return () => {
      socket.off("drawing-data", handleDrawingData);
      socket.off("draw-end", handleDrawEnd);
      socket.off("clear-canvas", handleClearCanvas);
      socket.off("cursor-update", onCursorUpdate);
      socket.off("user-left", onUserLeft);
    };
  }, [socket, onCursorUpdate, onUserLeft]);

  // Helper function to draw a complete path
  const drawPath = useCallback((context, pathData) => {
    if (!pathData.path || pathData.path.length < 2) return;

    context.beginPath();
    context.lineWidth = pathData.strokeWidth || 3;

    // 🔑 Eraser support for received paths
    if (pathData.tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0,0,0,1)";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = pathData.color || "#000000";
    }

    const [firstPoint, ...restPoints] = pathData.path;
    context.moveTo(firstPoint.x, firstPoint.y);
    restPoints.forEach((point) => context.lineTo(point.x, point.y));

    context.stroke();
    context.globalCompositeOperation = "source-over"; 
  }, []);

  // Get coordinates relative to canvas
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: ((clientX - rect.left) * scaleX) / window.devicePixelRatio,
      y: ((clientY - rect.top) * scaleY) / window.devicePixelRatio,
    };
  }, []);

  // Throttled cursor position emit
  const emitCursorPosition = useCallback(
    (x, y) => {
      const now = Date.now();
      if (now - lastCursorEmit.current > 16) {
        socket?.emit("cursor-move", { x, y });
        lastCursorEmit.current = now;
      }
    },
    [socket]
  );

  // Mouse/Touch event handlers
  const startDrawing = useCallback(
    (e) => {
      e.preventDefault();
      const coords = getCoordinates(e);

      setIsDrawing(true);
      setCurrentPath([coords]);

      const context = contextRef.current;
      if (!context) return;

      context.beginPath();
      context.moveTo(coords.x, coords.y);
      context.lineWidth = strokeWidth;

      // 🔑 Eraser logic here
      if (tool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        context.strokeStyle = "rgba(0,0,0,1)";
      } else {
        context.globalCompositeOperation = "source-over";
        context.strokeStyle = color;
      }

      socket?.emit("draw-start", {
        x: coords.x,
        y: coords.y,
        color,
        strokeWidth,
        tool,
      });
    },
    [getCoordinates, color, strokeWidth, socket, tool]
  );

  const draw = useCallback(
    (e) => {
      e.preventDefault();
      const coords = getCoordinates(e);
      emitCursorPosition(coords.x, coords.y);
      if (!isDrawing) return;

      const context = contextRef.current;
      if (!context) return;

      setCurrentPath((prev) => [...prev, coords]);

      context.lineTo(coords.x, coords.y);
      context.stroke();

      socket?.emit("draw-move", { x: coords.x, y: coords.y });
    },
    [getCoordinates, emitCursorPosition, isDrawing, socket]
  );

  const stopDrawing = useCallback(
    (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      setIsDrawing(false);

      socket?.emit("draw-end", {
        path: currentPath,
        color,
        strokeWidth,
        tool,
      });

      setCurrentPath([]);

      // Reset blend mode after erasing
      const context = contextRef.current;
      if (context) context.globalCompositeOperation = "source-over";
    },
    [isDrawing, currentPath, color, strokeWidth, tool, socket]
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none"
      style={{ minHeight: "600px" }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
};

export default DrawingCanvas;
