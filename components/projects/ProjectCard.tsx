'use client';

import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCost } from '@/lib/pricing';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalImagesGenerated?: number;
    totalCost?: number;
    _count?: {
      messages: number;
      images: number;
    };
    lastImageUrl?: string | null;
  };
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
}

export function ProjectCard({ project, onDelete, onClick }: ProjectCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      onDelete(project.id);
    }
  };

  const hasImage = project.lastImageUrl;

  return (
    <div
      onClick={() => onClick(project.id)}
      className="relative group rounded-xl overflow-hidden bg-gray-100 hover:shadow-xl hover:scale-[1.02] hover:ring-2 hover:ring-white/50 transition-all duration-300 cursor-pointer h-64"
    >
      {/* Background image with zoom effect on hover */}
      {hasImage && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
          style={{
            backgroundImage: `url(${project.lastImageUrl})`,
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
        onClick={handleDelete}
        className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Text at bottom with backdrop blur - becomes transparent on hover */}
      <div className="absolute inset-x-0 bottom-0 px-4 py-3 z-[2]">
        <div className="backdrop-blur-sm bg-black/20 group-hover:backdrop-blur-0 group-hover:bg-transparent rounded-lg px-3 py-2 transition-all duration-300">
          <h3 className="font-semibold text-base text-white mb-1.5 line-clamp-1 drop-shadow-lg">
            {project.name}
          </h3>
          
          <div className="flex items-center gap-3 text-xs text-white drop-shadow-md mb-1">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{project._count?.messages || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              <span>{project._count?.images || 0}</span>
            </div>
            {project.totalCost !== undefined && project.totalCost > 0 && (
              <span className="text-white/90 ml-1">
                {formatCost(project.totalCost || 0)}
              </span>
            )}
          </div>
          
          <p className="text-xs text-white/90 drop-shadow-md">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Fallback for no image */}
      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 z-[1]">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">{project.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

