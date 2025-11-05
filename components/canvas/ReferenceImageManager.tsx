'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, Trash2, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReferenceImage } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';

interface ReferenceImageManagerProps {
  projectId: string;
  referenceImages: ReferenceImage[];
  selectedImageIds: string[];
  onImagesChange: () => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onSaveDrawing?: (imageData: string) => void;
}

export function ReferenceImageManager({
  projectId,
  referenceImages: initialImages,
  selectedImageIds,
  onImagesChange,
  onSelectionChange,
  onSaveDrawing,
}: ReferenceImageManagerProps) {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initialImages);

  // Update images when initialImages change
  useEffect(() => {
    setReferenceImages(initialImages);
  }, [initialImages]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) return;

        const response = await fetch(`/api/projects/${projectId}/reference-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: base64Data }),
        });

        if (response.ok) {
          const data = await response.json();
          setReferenceImages((prev) => [data.referenceImage, ...prev]);
          onImagesChange();
          toastSuccess('Image uploaded successfully');
        } else {
          const data = await response.json();
          toastError(data.error || 'Failed to upload image');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }, [projectId, onImagesChange]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          await handleImageUpload(blob);
        }
        break;
      }
    }
  }, [handleImageUpload]);

  const handleDelete = useCallback(async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this reference image?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/reference-images/${imageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReferenceImages((prev) => prev.filter((img) => img.id !== imageId));
        onSelectionChange(selectedImageIds.filter((id) => id !== imageId));
        onImagesChange();
        toastSuccess('Image deleted successfully');
      } else {
        const data = await response.json();
        toastError(data.error || 'Failed to delete image');
      }
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to delete image');
    }
  }, [projectId, selectedImageIds, onSelectionChange, onImagesChange]);

  const toggleSelection = useCallback((imageId: string) => {
    const isSelected = selectedImageIds.includes(imageId);
    if (isSelected) {
      onSelectionChange(selectedImageIds.filter((id) => id !== imageId));
    } else {
      onSelectionChange([...selectedImageIds, imageId]);
    }
  }, [selectedImageIds, onSelectionChange]);

  // Helper function to parse color descriptions from name field
  const parseColorDescriptions = (name: string | null | undefined): { colorDescriptions?: Record<string, string>; displayName?: string } | null => {
    if (!name) return null;
    try {
      const parsed = JSON.parse(name);
      if (parsed.colorDescriptions && typeof parsed.colorDescriptions === 'object') {
        return {
          colorDescriptions: parsed.colorDescriptions,
          displayName: parsed.name || null,
        };
      }
      // If name is not JSON, return as display name
      return { displayName: name };
    } catch {
      // If parsing fails, name is not JSON, return as display name
      return { displayName: name };
    }
  };

  // Add paste event listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      handlePaste(e);
    };
    window.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePaste]);

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Reference Images</h3>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => handleImageUpload(file));
              }}
              className="hidden"
              id="reference-image-upload"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          💡 Tip: Paste images with Ctrl/Cmd+V or click Upload. Select images to use for generation.
        </p>

        {/* Image Grid */}
        {referenceImages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No reference images yet</p>
            <p className="text-xs">Upload or paste images to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {referenceImages.map((image) => {
              const isSelected = selectedImageIds.includes(image.id);
              const parsedData = parseColorDescriptions(image.name);
              const colorDescriptions = parsedData?.colorDescriptions;
              const displayName = parsedData?.displayName;
              
              return (
                <div
                  key={image.id}
                  className={`relative group border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleSelection(image.id)}
                >
                  <img
                    src={image.imageUrl}
                    alt={displayName || 'Reference image'}
                    className="w-full h-32 object-cover"
                  />
                  
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.id);
                    }}
                    className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity touch-manipulation"
                    onTouchStart={(e) => {
                      // Show button on touch devices
                      e.stopPropagation();
                      const target = e.currentTarget as HTMLElement;
                      target.style.opacity = '1';
                    }}
                    onTouchEnd={(e) => {
                      // Keep visible briefly on touch devices
                      e.stopPropagation();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>

                  {/* Color Descriptions Overlay */}
                  {colorDescriptions && Object.keys(colorDescriptions).length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/70 to-transparent p-2">
                      <div className="space-y-1">
                        {Object.entries(colorDescriptions).map(([color, description]) => (
                          <div key={color} className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded border border-white/50 flex-shrink-0"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                            <span className="text-white text-xs leading-tight">{description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Image Name Overlay (only if no color descriptions) */}
                  {displayName && !colorDescriptions && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                      {displayName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Selection Info */}
        {selectedImageIds.length > 0 && (
          <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            {selectedImageIds.length} image(s) selected for generation
          </div>
        )}
      </div>
    </div>
  );
}

