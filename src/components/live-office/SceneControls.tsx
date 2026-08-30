'use client';

import React from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2, Minimize2, HelpCircle } from 'lucide-react';

interface SceneControlsProps {
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function SceneControls({
  onReset,
  onZoomIn,
  onZoomOut,
  isFullscreen,
  onToggleFullscreen,
}: SceneControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-[var(--bg-card)]/90 backdrop-blur-md border border-[var(--border-color)] p-1 rounded-xl shadow-md">
      <button
        onClick={onZoomIn}
        className="w-8 h-8 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <button
        onClick={onZoomOut}
        className="w-8 h-8 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
        title="Zoom Out (−)"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-[var(--border-color)] mx-0.5" />

      <button
        onClick={onReset}
        className="w-8 h-8 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
        title="Reset Camera (↻)"
        aria-label="Reset Camera"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onToggleFullscreen}
        className="w-8 h-8 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (⛶)'}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
