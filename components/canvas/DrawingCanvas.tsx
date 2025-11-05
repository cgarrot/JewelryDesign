'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, Pencil, Undo, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorPicker, saveRecentColor } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';

interface DrawingCanvasProps {
  onSave: (imageData: string, colorDescriptions?: Record<string, string>) => void;
  initialImage?: string;
}

export function DrawingCanvas({ onSave, initialImage }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [penColor, setPenColor] = useState('#000000');
  const [hasDrawing, setHasDrawing] = useState(!!initialImage);
  const [canUndo, setCanUndo] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<string>>(new Set());
  const [colorDescriptions, setColorDescriptions] = useState<Record<string, string>>({});
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    // Scale coordinates to match canvas internal size vs displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = canvas.toDataURL();
    // Remove any future states if we're undoing and then drawing
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(state);
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    // Limit history to 50 states to prevent memory issues
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  }, []);

  // Check if a specific color is still present on the canvas
  // Only checks for colors we know were used (from usedColors)
  const checkColorsStillPresent = useCallback((colorsToCheck: Set<string>) => {
    const canvas = canvasRef.current;
    if (!canvas || colorsToCheck.size === 0) return new Set<string>();

    const ctx = canvas.getContext('2d');
    if (!ctx) return new Set<string>();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const colorPresenceMap = new Map<string, number>(); // color -> pixel count

    // Convert hex colors to RGB for comparison
    const colorRgbMap = new Map<string, { r: number; g: number; b: number }>();
    colorsToCheck.forEach((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      colorRgbMap.set(hex, { r, g, b });
    });

    // Sample pixels (check every Nth pixel to avoid performance issues)
    const sampleRate = 6; // Check every 6th pixel
    for (let i = 0; i < data.length; i += 4 * sampleRate) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent/white pixels (background)
      if (a < 200 || (r === 255 && g === 255 && b === 255)) {
        continue;
      }

      // Check if this pixel matches any of our known colors
      // Use tolerance of ±5 for anti-aliasing
      for (const [hex, targetRgb] of colorRgbMap) {
        const dr = Math.abs(r - targetRgb.r);
        const dg = Math.abs(g - targetRgb.g);
        const db = Math.abs(b - targetRgb.b);
        
        // If within tolerance, count it
        if (dr <= 5 && dg <= 5 && db <= 5) {
          colorPresenceMap.set(hex, (colorPresenceMap.get(hex) || 0) + 1);
          break; // Found a match, no need to check other colors
        }
      }
    }

    // Only include colors that appear frequently enough (at least 10 pixels)
    // This filters out noise from anti-aliasing and ensures the color is actually present
    const stillPresent = new Set<string>();
    colorPresenceMap.forEach((count, color) => {
      if (count >= 10) {
        stillPresent.add(color);
      }
    });

    return stillPresent;
  }, []);

  // State to trigger color update after restore
  const [colorUpdateTrigger, setColorUpdateTrigger] = useState(0);
  // Ref to track colors at the time of undo (to avoid stale closure issues)
  const usedColorsRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    usedColorsRef.current = usedColors;
  }, [usedColors]);

  // Update color tags after undo/restore operations
  useEffect(() => {
    if (colorUpdateTrigger > 0) {
      // Small delay to ensure canvas is fully rendered
      const timer = setTimeout(() => {
        // Only check colors that we know were used at the time of undo
        const colorsToCheck = usedColorsRef.current;
        const stillPresent = checkColorsStillPresent(colorsToCheck);
        setUsedColors(stillPresent);
        
        // Don't remove descriptions - keep them for when colors are redrawn
        // Descriptions will be preserved even if color is temporarily removed
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [colorUpdateTrigger, checkColorsStillPresent]);

  const restoreState = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || index < 0 || index >= historyRef.current.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      // Trigger color update after restore
      setColorUpdateTrigger((prev) => prev + 1);
    };
    img.src = historyRef.current[index];
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    // Save state before starting to draw
    saveState();

    // Save the color to recent colors when actually drawing
    saveRecentColor(penColor);

    // Track color used for drawing
    // If color was previously used, any existing description will be preserved
    setUsedColors((prev) => {
      const newSet = new Set(prev);
      newSet.add(penColor);
      return newSet;
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawing(true);
  }, [getCoordinates, saveState, penColor]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [isDrawing, brushSize, penColor, getCoordinates]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Touch event handlers
  const startDrawingTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    if (!touch) return;

    const coords = getCoordinates(touch.clientX, touch.clientY);
    if (!coords) return;

    // Save state before starting to draw
    saveState();

    // Save the color to recent colors when actually drawing
    saveRecentColor(penColor);

    // Track color used for drawing
    // If color was previously used, any existing description will be preserved
    setUsedColors((prev) => {
      const newSet = new Set(prev);
      newSet.add(penColor);
      return newSet;
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawing(true);
  }, [getCoordinates, saveState, penColor]);

  const drawTouch = useCallback((e: TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 0) return;
    const touch = e.touches[0];

    const coords = getCoordinates(touch.clientX, touch.clientY);
    if (!coords) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [isDrawing, brushSize, penColor, getCoordinates]);

  const stopDrawingTouch = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      restoreState(historyIndexRef.current);
      setHasDrawing(historyIndexRef.current > 0 || !!initialImage);
      setCanUndo(historyIndexRef.current > 0);
      // Color update will be handled by the useEffect after restoreState completes
    }
  }, [restoreState, initialImage]);

  // Keyboard shortcut for undo (Ctrl+Z or Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
      // Only prevent default if we're actually able to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, handleUndo]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    saveState();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    // Clear used colors when clearing canvas, but preserve descriptions
    // so they can be restored if colors are redrawn
    setUsedColors(new Set());
    // Don't clear colorDescriptions - keep them for when colors are redrawn
  }, [saveState]);

  const removeColorTag = useCallback((color: string) => {
    setUsedColors((prev) => {
      const newSet = new Set(prev);
      newSet.delete(color);
      return newSet;
    });
    setColorDescriptions((prev) => {
      const newDescriptions = { ...prev };
      delete newDescriptions[color];
      return newDescriptions;
    });
  }, []);

  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');
    // Filter out empty descriptions
    const descriptionsWithContent = Object.fromEntries(
      Object.entries(colorDescriptions).filter(([_, desc]) => desc.trim() !== '')
    );
    onSave(imageData, Object.keys(descriptionsWithContent).length > 0 ? descriptionsWithContent : undefined);
  }, [onSave, colorDescriptions]);

  const drawImageOnCanvas = useCallback((imageData: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image to fit canvas
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      setHasDrawing(true);
      saveCanvas();
    };
    img.src = imageData;
  }, [saveCanvas]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      if (imageData) {
        drawImageOnCanvas(imageData);
      }
    };
    reader.readAsDataURL(file);
  }, [drawImageOnCanvas]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            if (imageData) {
              drawImageOnCanvas(imageData);
            }
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  }, [drawImageOnCanvas]);

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `jewelry-sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initialize history with blank canvas
    historyRef.current = [canvas.toDataURL()];
    historyIndexRef.current = 0;
    setCanUndo(false);

    // Load initial image if provided
    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        setHasDrawing(true);
        // Save initial state to history
        historyRef.current = [canvas.toDataURL()];
        historyIndexRef.current = 0;
        setCanUndo(false);
      };
      img.src = initialImage;
    }
  }, [initialImage]);

  // Add paste event listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      handlePaste(e);
    };

    // Add event listener to window
    window.addEventListener('paste', handlePasteEvent);

    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePaste]);

  // Add document-level touchmove listener for drawing
  useEffect(() => {
    if (isDrawing) {
      document.addEventListener('touchmove', drawTouch, { passive: false });
      return () => {
        document.removeEventListener('touchmove', drawTouch);
      };
    }
  }, [isDrawing, drawTouch]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Reference Drawing</h3>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCanvas}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={clearCanvas}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b">
          <Button
            variant="default"
            size="sm"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Pen
          </Button>
          <ColorPicker color={penColor} onChange={setPenColor} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo className="h-4 w-4 mr-1" />
            Undo
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-gray-600">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-8">{brushSize}px</span>
          </div>
        </div>
        <div className="mb-4 text-xs text-gray-500 text-center">
          💡 Tip: Paste an image from clipboard with Ctrl/Cmd+V
        </div>

        {/* Canvas */}
        <div 
          className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex justify-center items-center relative"
          tabIndex={0}
          onFocus={() => {}}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawingTouch}
            onTouchEnd={stopDrawingTouch}
            onTouchCancel={stopDrawingTouch}
            className="cursor-crosshair touch-none"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
          {!hasDrawing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-400 bg-white/80 px-4 py-2 rounded">
                Draw, upload, or paste (Ctrl/Cmd+V) an image
              </p>
            </div>
          )}
        </div>

        {/* Color Tags Section */}
        {usedColors.size > 0 && (
          <div className="mt-4 border-t pt-4">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Color Tags (optional descriptions)
            </label>
            <div className="flex flex-wrap gap-3">
              {Array.from(usedColors).map((color) => (
                <div
                  key={color}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div
                    className="w-8 h-8 rounded border-2 border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                  <Input
                    type="text"
                    placeholder="e.g., neck, clip, band..."
                    value={colorDescriptions[color] || ''}
                    onChange={(e) => {
                      setColorDescriptions((prev) => ({
                        ...prev,
                        [color]: e.target.value,
                      }));
                    }}
                    className="w-40 text-sm text-gray-900 bg-white"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeColorTag(color)}
                    className="flex-shrink-0 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={saveCanvas} disabled={!hasDrawing}>
            Save Reference Image
          </Button>
        </div>
      </div>
    </div>
  );
}

