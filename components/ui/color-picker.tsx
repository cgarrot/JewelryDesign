'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

// Helper functions to convert between hex and HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const STORAGE_KEY = 'recentColors';
const MAX_RECENT_COLORS = 12;

// Helper functions for localStorage
const getRecentColors = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveRecentColor = (color: string): void => {
  if (typeof window === 'undefined') return;
  try {
    let recent = getRecentColors();
    // Remove the color if it already exists
    recent = recent.filter((c) => c !== color);
    // Add to the beginning
    recent.unshift(color);
    // Keep only the last MAX_RECENT_COLORS
    recent = recent.slice(0, MAX_RECENT_COLORS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Ignore localStorage errors
  }
};

export const getRecentColorsList = getRecentColors;

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => getRecentColorsList());
  const pickerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Get current hue from color
  const getHue = (colorValue: string) => {
    try {
      return hexToHsl(colorValue).h;
    } catch {
      return 0;
    }
  };

  const [hue, setHue] = useState(() => getHue(color));

  // Update hue when color changes externally
  useEffect(() => {
    setHue(getHue(color));
  }, [color]);

  // Handle color change (don't save to recent colors here - only when drawing)
  const handleColorChange = useCallback((newColor: string) => {
    onChange(newColor);
  }, [onChange]);

  // Refresh recent colors when picker opens
  useEffect(() => {
    if (isOpen) {
      setRecentColors(getRecentColorsList());
    }
  }, [isOpen]);

  // Handle slider drag
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newHue = percentage * 360;
    setHue(newHue);
    
    // Get current saturation and lightness to preserve them
    const hsl = hexToHsl(color);
    const newColor = hslToHex(newHue, hsl.s, hsl.l);
    handleColorChange(newColor);
  }, [color, handleColorChange]);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleSliderMove(e.clientX);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleSliderMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleSliderMove]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen && !isDragging) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isDragging]);

  return (
    <div className="relative" ref={pickerRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        type="button"
      >
        <Palette className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Color</span>
        <div
          className="ml-2 w-4 h-4 rounded border border-gray-300"
          style={{ backgroundColor: color }}
        />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 min-w-[240px]">
          {/* Color Spectrum Slider */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Color Spectrum
            </label>
            <div
              ref={sliderRef}
              className="relative h-8 w-full rounded-lg cursor-pointer overflow-hidden border border-gray-300"
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ff8000 8.33%, #ffff00 16.66%, #80ff00 25%, #00ff00 33.33%, #00ff80 41.66%, #00ffff 50%, #0080ff 58.33%, #0000ff 66.66%, #8000ff 75%, #ff00ff 83.33%, #ff0080 91.66%, #ff0000 100%)'
              }}
              onMouseDown={handleSliderMouseDown}
              onTouchStart={handleSliderTouchStart}
            >
              {/* Slider indicator */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white border border-gray-400 shadow-md pointer-events-none"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              />
              {/* Slider handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-600 rounded-full shadow-lg pointer-events-none"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
          </div>

          {/* Recent Colors */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Last Used Colors
            </label>
            {recentColors.length > 0 ? (
              <div className="grid grid-cols-6 gap-1">
                {recentColors.map((recentColor) => (
                  <button
                    key={recentColor}
                    type="button"
                    onClick={() => {
                      handleColorChange(recentColor);
                      setIsOpen(false);
                    }}
                    className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                      color === recentColor
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: recentColor }}
                    title={recentColor}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">
                No colors used yet. Start drawing to save colors here.
              </p>
            )}
          </div>

          {/* Custom Color Picker */}
          <div className="mb-2">
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Custom Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-full h-8 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    handleColorChange(value);
                  }
                }}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="#000000"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

