'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageComparisonProps {
  images: Array<{ id: string; imageData: string; createdAt: Date }>;
  onClose: () => void;
}

export function ImageComparison({ images, onClose }: ImageComparisonProps) {
  // Sort images by creation date (oldest first) for better comparison flow
  const sortedImages = [...images].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
  
  const [currentIndex, setCurrentIndex] = useState(sortedImages.length - 1); // Start with latest image
  const [comparisonMode, setComparisonMode] = useState<'slider' | 'side-by-side'>('slider');
  const [sliderPosition, setSliderPosition] = useState(50);

  if (sortedImages.length < 2) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-2">Not Enough Images</h2>
          <p className="text-gray-600 mb-4">You need at least 2 images to compare.</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const currentImage = sortedImages[currentIndex];
  const previousImage = currentIndex > 0 ? sortedImages[currentIndex - 1] : null;
  
  // Debug: Log to help diagnose issues
  if (typeof window !== 'undefined') {
    console.log('ImageComparison - Total images:', sortedImages.length);
    console.log('ImageComparison - Current index:', currentIndex);
    console.log('ImageComparison - Current image:', currentImage?.id, currentImage?.imageData?.substring(0, 50));
    console.log('ImageComparison - Previous image:', previousImage?.id, previousImage?.imageData?.substring(0, 50));
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
    setSliderPosition(50);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
    setSliderPosition(50);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Image Comparison</h2>
            <div className="flex items-center gap-2">
              <Button
                variant={comparisonMode === 'slider' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setComparisonMode('slider')}
              >
                Slider
              </Button>
              <Button
                variant={comparisonMode === 'side-by-side' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setComparisonMode('side-by-side')}
              >
                Side by Side
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {currentIndex + 1} of {sortedImages.length}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Comparison */}
        <div className="flex-1 relative overflow-hidden bg-gray-100 flex items-center justify-center">
          {comparisonMode === 'slider' && previousImage ? (
            <div 
              className="relative w-full h-full min-h-[400px]"
              onTouchStart={(e) => {
                // Allow dragging from anywhere on touch devices
                const rect = e.currentTarget.getBoundingClientRect();
                if (!rect) return;

                const touch = e.touches[0];
                const handleMove = (moveEvent: TouchEvent) => {
                  moveEvent.preventDefault();
                  if (moveEvent.touches.length === 0) return;
                  const touch = moveEvent.touches[0];
                  const x = touch.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                  setSliderPosition(percentage);
                };

                const handleEnd = () => {
                  document.removeEventListener('touchmove', handleMove);
                  document.removeEventListener('touchend', handleEnd);
                  document.removeEventListener('touchcancel', handleEnd);
                };

                // Set initial position
                const x = touch.clientX - rect.left;
                const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                setSliderPosition(percentage);

                document.addEventListener('touchmove', handleMove, { passive: false });
                document.addEventListener('touchend', handleEnd);
                document.addEventListener('touchcancel', handleEnd);
              }}
            >
              {/* Previous image (background) */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <img
                  src={previousImage.imageData}
                  alt="Previous version"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    console.error('Failed to load previous image:', previousImage.imageData);
                  }}
                />
              </div>
              
              {/* Current image (foreground) - clipped */}
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ 
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                  WebkitClipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
                }}
              >
                <img
                  src={currentImage.imageData}
                  alt="Current version"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    console.error('Failed to load current image:', currentImage.imageData);
                  }}
                />
              </div>

              {/* Slider control */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize z-10 hover:bg-blue-600 transition-colors touch-none"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!rect) return;

                  const handleMove = (moveEvent: MouseEvent) => {
                    const x = moveEvent.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                    setSliderPosition(percentage);
                  };

                  const handleUp = () => {
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleUp);
                    document.body.style.cursor = '';
                  };

                  document.body.style.cursor = 'ew-resize';
                  document.addEventListener('mousemove', handleMove);
                  document.addEventListener('mouseup', handleUp);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Prevent parent handler from also firing
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!rect) return;

                  const touch = e.touches[0];
                  const handleMove = (moveEvent: TouchEvent) => {
                    moveEvent.preventDefault();
                    if (moveEvent.touches.length === 0) return;
                    const touch = moveEvent.touches[0];
                    const x = touch.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                    setSliderPosition(percentage);
                  };

                  const handleEnd = () => {
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleEnd);
                    document.removeEventListener('touchcancel', handleEnd);
                  };

                  // Set initial position
                  const x = touch.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                  setSliderPosition(percentage);

                  document.addEventListener('touchmove', handleMove, { passive: false });
                  document.addEventListener('touchend', handleEnd);
                  document.addEventListener('touchcancel', handleEnd);
                }}
              >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          ) : comparisonMode === 'slider' && !previousImage ? (
            // First image - show it alone with message
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">First Image</p>
                <p className="text-sm mb-4">No previous version to compare</p>
                <div className="bg-white rounded-lg overflow-hidden max-w-2xl mx-auto">
                  <img
                    src={currentImage.imageData}
                    alt="Current version"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <p className="text-sm mt-4">Use Next to compare with later versions</p>
              </div>
            </div>
          ) : (
            // Side-by-side mode
            <div className="grid grid-cols-2 gap-4 p-4 w-full h-full">
              {previousImage ? (
                <div className="flex flex-col h-full">
                  <div className="text-sm text-gray-600 mb-2 font-medium">Previous Version</div>
                  <div className="flex-1 bg-white rounded-lg overflow-hidden flex items-center justify-center min-h-0">
                    <img
                      src={previousImage.imageData}
                      alt="Previous version"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        console.error('Failed to load previous image:', previousImage.imageData);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                  <p className="text-sm">No previous version</p>
                </div>
              )}
              <div className="flex flex-col h-full">
                <div className="text-sm text-gray-600 mb-2 font-medium">Current Version</div>
                <div className="flex-1 bg-white rounded-lg overflow-hidden flex items-center justify-center min-h-0">
                  <img
                    src={currentImage.imageData}
                    alt="Current version"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      console.error('Failed to load current image:', currentImage.imageData);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t">
          <Button
            variant="outline"
            onClick={prevImage}
            disabled={sortedImages.length < 2 || currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-1">
            {sortedImages.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setSliderPosition(50);
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={nextImage}
            disabled={sortedImages.length < 2 || currentIndex === sortedImages.length - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

