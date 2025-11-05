'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GeneratedImage, ViewType } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';

interface MultiViewCanvasProps {
  projectId: string;
  images: GeneratedImage[]; // All project images, will filter for views
  onViewsChange: () => void; // Callback to refresh project data
  loading?: boolean;
  disabled?: boolean;
}

interface ViewImage {
  id: string;
  viewType: ViewType;
  imageUrl: string;
  viewSetId: string;
}

const VIEW_LABELS: Record<ViewType, string> = {
  FRONT: 'Front View',
  SIDE: 'Side View',
  TOP: 'Top View',
  BOTTOM: 'Bottom View',
};

const VIEW_ORDER: ViewType[] = ['FRONT', 'SIDE', 'TOP', 'BOTTOM'];

export function MultiViewCanvas({
  projectId,
  images,
  onViewsChange,
  loading: externalLoading,
  disabled,
}: MultiViewCanvasProps) {
  const [generating, setGenerating] = useState(false);
  const [views, setViews] = useState<ViewImage[]>([]);
  const [viewSetId, setViewSetId] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState<ViewType | null>(null);

  // Filter and organize views from images
  useEffect(() => {
    const viewImages = images
      .filter((img): img is GeneratedImage & { viewType: ViewType; viewSetId: string } => 
        img.viewType !== null && img.viewType !== undefined && img.viewSetId !== null
      )
      .map((img) => ({
        id: img.id,
        viewType: img.viewType as ViewType,
        imageUrl: img.imageData, // Already a URL from the API
        viewSetId: img.viewSetId!,
      }));

    // Group by viewSetId and get the most recent set
    const viewSets = viewImages.reduce((acc, view) => {
      if (!acc[view.viewSetId]) {
        acc[view.viewSetId] = [];
      }
      acc[view.viewSetId].push(view);
      return acc;
    }, {} as Record<string, ViewImage[]>);

    // Get the most recent view set (by checking if we have all 4 views)
    const latestSet = Object.values(viewSets)
      .filter(set => set.length === 4)
      .sort((a, b) => {
        // Sort by creation time (use first image's ID as proxy)
        return b[0].id.localeCompare(a[0].id);
      })[0];

    if (latestSet) {
      // Sort views by VIEW_ORDER
      const sortedViews = VIEW_ORDER.map(type => 
        latestSet.find(v => v.viewType === type)
      ).filter((v): v is ViewImage => v !== undefined);

      setViews(sortedViews);
      setViewSetId(sortedViews[0]?.viewSetId || null);
    } else {
      setViews([]);
      setViewSetId(null);
    }
  }, [images]);

  const handleGenerateViews = async () => {
    if (!projectId || generating || disabled) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/generate-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate views');
      }

      await response.json();
      
      // Refresh project data to get new views
      onViewsChange();
      toastSuccess('4 views generated successfully');
    } catch (error) {
      console.error('Failed to generate views:', error);
      toastError(error instanceof Error ? error.message : 'Failed to generate views');
    } finally {
      setGenerating(false);
    }
  };

  const isLoading = generating || externalLoading;
  const hasViews = views.length === 4;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">4 Views</h2>
            <p className="text-sm text-gray-600">
              Different perspectives of your jewelry design
            </p>
          </div>
          <Button
            onClick={handleGenerateViews}
            disabled={disabled || isLoading || !images.some(img => !img.viewType)}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" style={{ stroke: 'url(#sparklesGradient)' }} />
                Generate 4 Views
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!hasViews ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 max-w-md">
              <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ stroke: 'url(#sparklesGradient)' }} />
              <p className="text-lg font-medium mb-2">No Views Generated Yet</p>
              <p className="text-sm mb-4">
                Generate a design first, then create 4 different perspectives from the most recent image.
              </p>
              {!images.some(img => !img.viewType) && (
                <p className="text-xs text-gray-400 mt-2">
                  You need at least one generated image to create views.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              {VIEW_ORDER.map((viewType) => {
                const view = views.find(v => v.viewType === viewType);
                if (!view) return null;

                return (
                  <div
                    key={viewType}
                    className="bg-white rounded-lg shadow-lg overflow-hidden relative group"
                  >
                    <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm font-medium">
                      {VIEW_LABELS[viewType]}
                    </div>
                    <div className="relative aspect-square bg-gray-100">
                      <img
                        src={view.imageUrl}
                        alt={VIEW_LABELS[viewType]}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => setExpandedView(viewType)}
                      />
                      <button
                        onClick={() => setExpandedView(viewType)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70"
                        title="View full size"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Expanded View Modal */}
      {expandedView && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedView(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <div className="bg-white rounded-lg p-4 mb-2 text-center">
              <h3 className="text-lg font-semibold">{VIEW_LABELS[expandedView]}</h3>
            </div>
            <img
              src={views.find(v => v.viewType === expandedView)?.imageUrl || ''}
              alt={VIEW_LABELS[expandedView]}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setExpandedView(null)}
              className="absolute top-0 right-0 m-4 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-2"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

