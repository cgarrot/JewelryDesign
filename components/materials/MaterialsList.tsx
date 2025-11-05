'use client';

import { Material } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Image } from 'lucide-react';
import { useState } from 'react';

export type DisplayMode = 'grid' | 'simple-grid' | 'list';

interface MaterialsListProps {
  materials: Material[];
  onEdit: (material: Material) => void;
  onDelete: (id: string) => void;
  selectedCategory?: string;
  displayMode?: DisplayMode;
  currentGeneratingMaterial?: string | null;
}

export function MaterialsList({ 
  materials, 
  onEdit, 
  onDelete, 
  selectedCategory,
  displayMode = 'grid',
  currentGeneratingMaterial = null
}: MaterialsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this material?')) {
      setDeletingId(id);
      await onDelete(id);
      setDeletingId(null);
    }
  };

  const filteredMaterials = selectedCategory
    ? materials.filter((m) => m.category === selectedCategory)
    : materials;

  if (filteredMaterials.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No materials found</p>
        <p className="text-sm mt-2">Create your first material to get started</p>
      </div>
    );
  }

  // Simple Grid View - Only images and title
  if (displayMode === 'simple-grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredMaterials.map((material) => (
          <div
            key={material.id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer group"
            onClick={() => onEdit(material)}
          >
            {/* Preview Image */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              {material.imageUrl ? (
                <img
                  src={material.imageUrl}
                  alt={material.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="h-8 w-8 text-gray-300" />
                </div>
              )}
              {material.isGlobal && (
                <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded z-10 shadow-sm">
                  Global
                </span>
              )}
            </div>

            {/* Title */}
            <div className="p-2">
              <h3 className="font-medium text-gray-900 text-sm text-center truncate group-hover:text-blue-600 transition-colors">
                {material.name}
              </h3>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // List View - Compact list format
  if (displayMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {filteredMaterials.map((material, index) => (
          <div
            key={material.id}
            className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
              index !== filteredMaterials.length - 1 ? 'border-b border-gray-200' : ''
            }`}
          >
            {/* Preview Image */}
            <div className="w-16 h-16 bg-gray-100 rounded relative overflow-hidden flex-shrink-0">
              {material.imageUrl ? (
                <img
                  src={material.imageUrl}
                  alt={material.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="h-6 w-6 text-gray-300" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{material.name}</h3>
                <span className="inline-block text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                  {material.category}
                </span>
                {material.isGlobal && (
                  <span className="inline-block text-xs bg-green-100 text-green-800 font-medium px-2 py-0.5 rounded">
                    Global
                  </span>
                )}
              </div>
              <div
                className="text-sm text-gray-600 line-clamp-1"
                dangerouslySetInnerHTML={{ __html: material.prompt }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(material);
                }}
                variant="outline"
                size="sm"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(material.id);
                }}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={deletingId === material.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default Grid View - Full card with all details
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredMaterials.map((material) => (
        <div
          key={material.id}
          className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
            {/* Preview Image */}
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
              {material.imageUrl ? (
                <img
                  src={material.imageUrl}
                  alt={material.name}
                  className="w-full h-full object-cover"
                  style={{ minHeight: '150px', display: 'block' }}
                  onError={(e) => {
                    // Hide broken images
                    e.currentTarget.style.display = 'none';
                  }}
                  key={material.imageUrl} // Force re-render when URL changes
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {currentGeneratingMaterial === material.name ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="text-xs text-gray-500">Generating...</span>
                    </div>
                  ) : (
                    <Image className="h-12 w-12 text-gray-300" />
                  )}
                </div>
              )}
              {material.isGlobal && (
                <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded z-10 shadow-sm">
                  Global
                </span>
              )}
            </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{material.name}</h3>
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded">
                  {material.category}
                </span>
              </div>
            </div>

            <div
              className="text-sm text-gray-900 mt-2 line-clamp-2"
              style={{ color: '#111827' }}
              dangerouslySetInnerHTML={{ __html: material.prompt }}
            />

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => onEdit(material)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                onClick={() => handleDelete(material.id)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={deletingId === material.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

