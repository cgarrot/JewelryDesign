'use client';

import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageControlsProps {
  imageData?: string;
  onGenerateImage: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ImageControls({
  imageData,
  onGenerateImage,
  loading,
  disabled,
}: ImageControlsProps) {
  const handleDownload = () => {
    if (!imageData) return;

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `jewelry-design-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={onGenerateImage}
        disabled={disabled || loading}
        className="flex-1"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Image'
        )}
      </Button>
      {imageData && (
        <Button
          onClick={handleDownload}
          variant="outline"
          disabled={loading}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

