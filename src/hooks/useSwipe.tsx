import { useState, useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp }: SwipeHandlers) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    setIsDragging(true);
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    setDragX(clientX - startX.current);
    setDragY(clientY - startY.current);
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    const threshold = 100;
    const velocityThreshold = 50;

    if (dragX > threshold) {
      onSwipeRight?.();
    } else if (dragX < -threshold) {
      onSwipeLeft?.();
    } else if (dragY < -threshold && Math.abs(dragX) < velocityThreshold) {
      onSwipeUp?.();
    }

    setDragX(0);
    setDragY(0);
    setIsDragging(false);
  }, [isDragging, dragX, dragY, onSwipeLeft, onSwipeRight, onSwipeUp]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const rotation = dragX * 0.1;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 300);

  return {
    dragX,
    dragY,
    isDragging,
    rotation,
    opacity,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleEnd,
      onMouseLeave: handleEnd,
    },
  };
}
