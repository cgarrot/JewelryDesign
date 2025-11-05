'use client';

import { Material } from '@/lib/types';
import { useEffect, useRef } from 'react';

interface MaterialAutocompleteProps {
  materials: Material[];
  searchQuery: string;
  position: { top: number; left: number };
  onSelect: (material: Material) => void;
  selectedIndex: number;
}

export function MaterialAutocomplete({
  materials,
  searchQuery,
  position,
  onSelect,
  selectedIndex,
}: MaterialAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Filter materials based on search query
  const filteredMaterials = materials.filter((material) =>
    material.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show all filtered materials (dropdown is scrollable)
  const visibleMaterials = filteredMaterials;
  const safeSelectedIndex = Math.min(selectedIndex, visibleMaterials.length - 1);

  // Auto-scroll to selected item within the dropdown (not the page)
  useEffect(() => {
    if (selectedItemRef.current && safeSelectedIndex >= 0 && containerRef.current) {
      const container = containerRef.current;
      const selectedItem = selectedItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();
      
      // Only scroll within the dropdown container, not the page
      if (itemRect.top < containerRect.top) {
        container.scrollTop -= (containerRect.top - itemRect.top);
      } else if (itemRect.bottom > containerRect.bottom) {
        container.scrollTop += (itemRect.bottom - containerRect.bottom);
      }
    }
  }, [safeSelectedIndex]);

  if (visibleMaterials.length === 0) {
    return null;
  }

  // Calculate position with proper mobile handling
  const getPosition = () => {
    if (typeof window === 'undefined') {
      return { top: position.top, left: position.left, width: '280px', maxWidth: '400px' };
    }
    const maxWidth = Math.min(400, window.innerWidth - 16);
    const left = Math.max(8, Math.min(position.left, window.innerWidth - 280));
    const width = window.innerWidth < 640 ? 'calc(100vw - 16px)' : '280px';
    return { top: position.top, left, width, maxWidth: `${maxWidth}px` };
  };

  const style = getPosition();

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 sm:max-h-64 overflow-y-auto sm:max-w-[400px]"
      style={{
        top: `${style.top}px`,
        left: `${style.left}px`,
        minWidth: '280px',
        maxWidth: style.maxWidth,
        width: style.width,
      }}
    >
      {visibleMaterials.map((material, index) => (
        <div
          key={material.id}
          ref={index === safeSelectedIndex ? selectedItemRef : null}
          onClick={() => onSelect(material)}
          className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 cursor-pointer transition-colors min-h-[44px] ${
            index === safeSelectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
          }`}
        >
          {/* Preview Image */}
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded overflow-hidden">
            {material.imageUrl ? (
              <img
                src={material.imageUrl}
                alt={material.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No img
              </div>
            )}
          </div>

          {/* Material Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm sm:text-base text-gray-900">{material.name}</div>
            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1">
              <span className="inline-block bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded">
                {material.category}
              </span>
              {material.isGlobal && (
                <span className="inline-block bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded">
                  Global
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

