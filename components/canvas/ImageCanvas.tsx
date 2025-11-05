"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Pencil,
  Save,
  X,
  Undo as UndoIcon,
  GitCompare,
  Trash2,
} from "lucide-react";
import { ImageControls } from "./ImageControls";
import { ImageComparison } from "./ImageComparison";
import { Button } from "@/components/ui/button";
import { ColorPicker, saveRecentColor } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { GeneratedImage } from "@/lib/types";

interface ImageCanvasProps {
  images: GeneratedImage[];
  onGenerateImage: () => void;
  onSaveAnnotatedImage: (
    imageData: string,
    annotations: string,
    colorDescriptions?: Record<string, string>
  ) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ImageCanvas({
  images,
  onGenerateImage,
  onSaveAnnotatedImage,
  loading,
  disabled,
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [penColor, setPenColor] = useState("#FF0000");
  const [annotations, setAnnotations] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<string>>(new Set());
  const [colorDescriptions, setColorDescriptions] = useState<
    Record<string, string>
  >({});
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const usedColorsRef = useRef<Set<string>>(new Set());
  const [colorUpdateTrigger, setColorUpdateTrigger] = useState(0);

  // Filter out view images (only show regular generated images)
  const regularImages = images.filter((img) => !img.viewType);

  // Get the currently selected image
  const selectedImage = regularImages[selectedImageIndex];

  // Reset to latest image when new image is generated
  const prevImagesLengthRef = useRef(regularImages.length);
  useEffect(() => {
    if (regularImages.length > prevImagesLengthRef.current) {
      // New image was added, select it (index 0)
      setSelectedImageIndex(0);
    }
    // Ensure selected index is valid
    if (
      selectedImageIndex >= regularImages.length &&
      regularImages.length > 0
    ) {
      setSelectedImageIndex(0);
    }
    prevImagesLengthRef.current = regularImages.length;
  }, [regularImages.length, selectedImageIndex]);

  // Load image onto canvas when entering edit mode
  const loadImageToCanvas = useCallback(() => {
    if (!selectedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      // Initialize history with base image
      historyRef.current = [canvas.toDataURL()];
      historyIndexRef.current = 0;
      setCanUndo(false);
    };
    img.src = selectedImage.imageData;
  }, [selectedImage]);

  useEffect(() => {
    if (isEditing) {
      loadImageToCanvas();
    }
  }, [isEditing, loadImageToCanvas]);

  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
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
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );
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
  const checkColorsStillPresent = useCallback((colorsToCheck: Set<string>) => {
    const canvas = canvasRef.current;
    if (!canvas || colorsToCheck.size === 0) return new Set<string>();

    const ctx = canvas.getContext("2d");
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
    const stillPresent = new Set<string>();
    colorPresenceMap.forEach((count, color) => {
      if (count >= 10) {
        stillPresent.add(color);
      }
    });

    return stillPresent;
  }, []);

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
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [colorUpdateTrigger, checkColorsStillPresent]);

  const restoreState = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || index < 0 || index >= historyRef.current.length) return;

    const ctx = canvas.getContext("2d");
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

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      // Save state before starting to draw
      saveState();

      // Save the color to recent colors when actually drawing
      saveRecentColor(penColor);

      // Track color used for drawing
      setUsedColors((prev) => {
        const newSet = new Set(prev);
        newSet.add(penColor);
        return newSet;
      });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      setIsDrawing(true);
    },
    [getCoordinates, saveState, penColor]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = penColor;

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    },
    [isDrawing, brushSize, penColor, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Touch event handlers
  const startDrawingTouch = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
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
      setUsedColors((prev) => {
        const newSet = new Set(prev);
        newSet.add(penColor);
        return newSet;
      });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      setIsDrawing(true);
    },
    [getCoordinates, saveState, penColor]
  );

  const drawTouch = useCallback(
    (e: TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (e.touches.length === 0) return;
      const touch = e.touches[0];

      const coords = getCoordinates(touch.clientX, touch.clientY);
      if (!coords) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = penColor;

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    },
    [isDrawing, brushSize, penColor, getCoordinates]
  );

  const stopDrawingTouch = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Add document-level touchmove listener for drawing
  useEffect(() => {
    if (isDrawing) {
      document.addEventListener("touchmove", drawTouch, { passive: false });
      return () => {
        document.removeEventListener("touchmove", drawTouch);
      };
    }
  }, [isDrawing, drawTouch]);

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

  const handleSaveAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const annotatedImageData = canvas.toDataURL("image/png");
    // Filter out empty descriptions
    const descriptionsWithContent = Object.fromEntries(
      Object.entries(colorDescriptions).filter(
        ([_, desc]) => desc.trim() !== ""
      )
    );
    onSaveAnnotatedImage(
      annotatedImageData,
      annotations,
      Object.keys(descriptionsWithContent).length > 0
        ? descriptionsWithContent
        : undefined
    );
    setIsEditing(false);
    setAnnotations("");
    setUsedColors(new Set());
    setColorDescriptions({});
  }, [annotations, colorDescriptions, onSaveAnnotatedImage]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setAnnotations("");
    setUsedColors(new Set());
    setColorDescriptions({});
  }, []);

  const handleResetCanvas = useCallback(() => {
    loadImageToCanvas();
    setUsedColors(new Set());
    // Don't clear colorDescriptions - keep them for when colors are redrawn
  }, [loadImageToCanvas]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      restoreState(historyIndexRef.current);
      setCanUndo(historyIndexRef.current > 0);
    }
  }, [restoreState]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Jewelry Preview
            </h2>
            <p className="text-sm text-gray-600">
              {isEditing
                ? "Draw modifications on the image"
                : "AI-generated design"}
            </p>
          </div>
          {selectedImage && !isEditing && (
            <div className="flex gap-2">
              {regularImages.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComparison(true)}
                  disabled={loading}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={loading}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Annotate
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedImage ? (
          <div className="space-y-4">
            {isEditing ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden p-4">
                {/* Annotation Toolbar */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                  <Button variant="default" size="sm">
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
                    <UndoIcon className="h-4 w-4 mr-1" />
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
                    <span className="text-sm text-gray-600 w-8">
                      {brushSize}px
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetCanvas}
                  >
                    <UndoIcon className="h-4 w-4" />
                  </Button>
                </div>

                {/* Canvas */}
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex justify-center items-center">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawingTouch}
                    onTouchEnd={stopDrawingTouch}
                    onTouchCancel={stopDrawingTouch}
                    className="cursor-crosshair max-w-full h-auto touch-none"
                  />
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
                            value={colorDescriptions[color] || ""}
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

                {/* Description */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe your modifications:
                  </label>
                  <textarea
                    value={annotations}
                    onChange={(e) => setAnnotations(e.target.value)}
                    placeholder="E.g., Make the pearl larger, adjust the flower petals, change the band width..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveAnnotations}
                    disabled={!annotations.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save & Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <img
                    src={selectedImage.imageData}
                    alt="Generated jewelry"
                    className="w-full h-auto object-contain"
                  />
                </div>
                {regularImages.length > 1 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">
                      All Designs
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {regularImages.slice(0, 9).map((image, index) => (
                        <div
                          key={image.id}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`bg-white rounded-lg overflow-hidden shadow cursor-pointer hover:shadow-md transition-all ${
                            index === selectedImageIndex
                              ? "ring-2 ring-blue-500 shadow-lg"
                              : ""
                          }`}
                        >
                          <img
                            src={image.imageData}
                            alt={
                              index === 0
                                ? "Latest design"
                                : `Previous design ${index}`
                            }
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    {regularImages.length > 9 && (
                      <p className="text-xs text-gray-500 text-center">
                        Showing 9 of {regularImages.length} designs
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Images Yet</p>
              <p className="text-sm">
                Chat about your design, then generate an image
              </p>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="border-t border-gray-200 p-4">
          <ImageControls
            imageData={selectedImage?.imageData}
            onGenerateImage={onGenerateImage}
            loading={loading}
            disabled={disabled}
          />
        </div>
      )}

      {showComparison && (
        <ImageComparison
          images={regularImages.map((img) => ({
            id: img.id,
            imageData: img.imageData,
            createdAt: img.createdAt,
          }))}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
