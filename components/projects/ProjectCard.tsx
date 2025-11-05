'use client';

import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

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

  return (
    <div
      onClick={() => onClick(project.id)}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">{project.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
      
      <div className="flex gap-4 text-sm text-gray-600 mb-2">
        <div className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          <span>{project._count?.messages || 0} messages</span>
        </div>
        <div className="flex items-center gap-1">
          <ImageIcon className="h-4 w-4" />
          <span>{project._count?.images || 0} images</span>
        </div>
      </div>
      
      {project.totalCost !== undefined && (
        <div className="mb-2">
          <PriceDisplay
            totalCost={project.totalCost || 0}
            totalInputTokens={project.totalInputTokens || 0}
            totalOutputTokens={project.totalOutputTokens || 0}
            totalImagesGenerated={project.totalImagesGenerated || 0}
            compact
          />
        </div>
      )}
      
      <p className="text-xs text-gray-500">
        Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
      </p>
    </div>
  );
}

