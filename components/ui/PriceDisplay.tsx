import { formatCost, getImageTokens } from '@/lib/pricing';

interface PriceDisplayProps {
  totalCost: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalImagesGenerated?: number;
  compact?: boolean;
}

export function PriceDisplay({
  totalCost,
  totalInputTokens = 0,
  totalOutputTokens = 0,
  totalImagesGenerated = 0,
  compact = false,
}: PriceDisplayProps) {
  if (compact) {
    return (
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{formatCost(totalCost)}</span>
        {totalImagesGenerated > 0 && (
          <span className="ml-2 text-gray-500">
            • {totalImagesGenerated} image{totalImagesGenerated !== 1 ? 's' : ''}
          </span>
        )}
        {totalCost === 0 && totalImagesGenerated === 0 && (
          <span className="ml-2 text-gray-400">No usage yet</span>
        )}
      </div>
    );
  }

  const imageTokens = getImageTokens(totalImagesGenerated);
  const totalTokens = totalInputTokens + totalOutputTokens + imageTokens;
  const hasUsage = totalCost > 0 || totalInputTokens > 0 || totalOutputTokens > 0 || totalImagesGenerated > 0;

  if (!hasUsage) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Cost:</span>
        <span className="text-sm text-gray-500">No usage yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-baseline gap-1">
        <span className="font-bold text-sm text-gray-900">{formatCost(totalCost)}</span>
      </div>
      <span className="text-gray-300">|</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">In:</span>
        <span className="font-medium text-gray-700">{totalInputTokens.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Out:</span>
        <span className="font-medium text-gray-700">{totalOutputTokens.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Img:</span>
        <span className="font-medium text-gray-700">{totalImagesGenerated}</span>
      </div>
      <span className="text-gray-300">|</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Total:</span>
        <span className="font-semibold text-gray-900">{totalTokens.toLocaleString()}</span>
      </div>
    </div>
  );
}

