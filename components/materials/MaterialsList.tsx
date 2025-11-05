"use client";

import { Material } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Image } from "lucide-react";
import { useState } from "react";

export type DisplayMode = "grid" | "simple-grid" | "list";

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
  displayMode = "grid",
  currentGeneratingMaterial = null,
}: MaterialsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this material?")) {
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
        <p className="text-sm mt-2">
          Create your first material to get started
        </p>
      </div>
    );
  }

  // Simple Grid View - Only images and title
  if (displayMode === "simple-grid") {
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
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="h-8 w-8 text-gray-300" />
                </div>
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
  if (displayMode === "list") {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {filteredMaterials.map((material, index) => (
          <div
            key={material.id}
            className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
              index !== filteredMaterials.length - 1
                ? "border-b border-gray-200"
                : ""
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
                    e.currentTarget.style.display = "none";
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
                <h3 className="font-semibold text-gray-900 truncate">
                  {material.name}
                </h3>
                <span className="inline-block text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                  {material.category}
                </span>
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
      {filteredMaterials.map((material) => {
        const hasImage = material.imageUrl;
        const isGenerating = currentGeneratingMaterial === material.name;

        return (
          <div
            key={material.id}
            className="relative group rounded-xl overflow-hidden bg-gray-100 hover:shadow-xl hover:scale-[1.02] hover:ring-2 hover:ring-white/50 transition-all duration-300 cursor-pointer h-64"
            onClick={() => onEdit(material)}
          >
            {/* Background image with zoom effect on hover */}
            {hasImage && (
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: `url(${material.imageUrl})`,
                }}
              />
            )}

            {/* Hover overlay for better feedback */}
            {hasImage && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 z-[1]" />
            )}

            {/* Delete button - top right */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(material.id);
              }}
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
              disabled={deletingId === material.id}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            {/* Edit button - appears on hover */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(material);
              }}
              className="absolute top-2 right-12 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <Edit className="h-4 w-4" />
            </Button>

            {/* Text at bottom with backdrop blur - becomes transparent on hover */}
            <div className="absolute inset-x-0 bottom-0 px-4 py-3 z-[2]">
              <div className="backdrop-blur-sm bg-black/20 group-hover:backdrop-blur-0 group-hover:bg-transparent rounded-lg px-3 py-2 transition-all duration-300">
                <h3 className="font-semibold text-base text-white mb-1.5 line-clamp-1 drop-shadow-lg">
                  {material.name}
                </h3>

                <div className="flex items-center gap-2 text-xs text-white drop-shadow-md mb-1">
                  <span className="inline-block bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-white/90">
                    {material.category}
                  </span>
                </div>

                <div
                  className="text-xs text-white/90 drop-shadow-md line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: material.prompt }}
                />
              </div>
            </div>

            {/* Fallback for no image */}
            {!hasImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 z-[1]">
                <div className="text-center">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="text-xs text-gray-500">
                        Generating...
                      </span>
                    </div>
                  ) : (
                    <>
                      <Image className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 font-medium">
                        {material.name}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
