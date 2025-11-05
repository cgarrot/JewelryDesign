'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectCard } from './ProjectCard';
import { Project, ImageFormat, ImageAspectRatio } from '@/lib/types';
import { ProjectCardSkeleton } from '@/components/ui/skeleton';

interface ProjectListProps {
  projects: Project[];
  onCreateProject: (name: string, imageFormat: ImageFormat, imageAspectRatio: ImageAspectRatio) => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (id: string) => void;
  loading?: boolean;
}

export function ProjectList({
  projects,
  onCreateProject,
  onDeleteProject,
  onSelectProject,
  loading = false,
}: ProjectListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>('PNG');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<ImageAspectRatio>('SQUARE');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), selectedFormat, selectedAspectRatio);
      setNewProjectName('');
      setSelectedFormat('PNG');
      setSelectedAspectRatio('SQUARE');
      setIsCreating(false);
    }
  };

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Your Projects</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Projects</h2>
        <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto h-9 sm:h-10 px-3 sm:px-4">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Project</span>
        </Button>
      </div>

      {/* Search Bar */}
      {projects.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {isCreating && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Project name (e.g., Wedding Ring Design)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              autoFocus
              className="h-9 sm:h-10 text-sm sm:text-base"
            />
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Image Format (used for all generated images)
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {(['PNG', 'JPEG', 'WEBP'] as ImageFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setSelectedFormat(format)}
                  className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md border transition-colors h-9 sm:h-10 ${
                    selectedFormat === format
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 sm:mt-2">
              {selectedFormat === 'PNG' && 'Lossless quality, larger file size'}
              {selectedFormat === 'JPEG' && 'Good quality, smaller file size'}
              {selectedFormat === 'WEBP' && 'Modern format, excellent compression'}
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Image Aspect Ratio (used for all generated images)
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {(['SQUARE', 'HORIZONTAL', 'VERTICAL'] as ImageAspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setSelectedAspectRatio(ratio)}
                  className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md border transition-colors h-9 sm:h-10 ${
                    selectedAspectRatio === ratio
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {ratio === 'SQUARE' && '□ Square'}
                  {ratio === 'HORIZONTAL' && '▭ Horizontal'}
                  {ratio === 'VERTICAL' && '▯ Vertical'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 sm:mt-2">
              {selectedAspectRatio === 'SQUARE' && '1:1 ratio (square format)'}
              {selectedAspectRatio === 'HORIZONTAL' && 'Landscape orientation (wider than tall)'}
              {selectedAspectRatio === 'VERTICAL' && 'Portrait orientation (taller than wide)'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} size="sm" className="h-9 sm:h-10 px-3 sm:px-4 flex-1 sm:flex-initial">
              <span className="text-sm sm:text-base">Create</span>
            </Button>
            <Button
              onClick={() => {
                setIsCreating(false);
                setNewProjectName('');
                setSelectedFormat('PNG');
                setSelectedAspectRatio('SQUARE');
              }}
              variant="outline"
              size="sm"
              className="h-9 sm:h-10 px-3 sm:px-4 flex-1 sm:flex-initial"
            >
              <span className="text-sm sm:text-base">Cancel</span>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={onDeleteProject}
            onClick={onSelectProject}
          />
        ))}
      </div>

      {projects.length === 0 && !isCreating && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create your first jewelry design project to get started</p>
        </div>
      )}

      {projects.length > 0 && filteredProjects.length === 0 && searchQuery && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No projects found</p>
          <p className="text-sm">Try adjusting your search query</p>
        </div>
      )}

      {searchQuery && filteredProjects.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      )}
    </div>
  );
}

