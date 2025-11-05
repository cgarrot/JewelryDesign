'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectList } from '@/components/projects/ProjectList';
import { Sparkles, Library } from 'lucide-react';
import { Project, ImageFormat, ImageAspectRatio } from '@/lib/types';
import { toastError } from '@/lib/toast';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (name: string, imageFormat: ImageFormat, imageAspectRatio: ImageAspectRatio) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, imageFormat, imageAspectRatio }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }
      const data = await response.json();
      router.push(`/projects/${data.project.id}`);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to create project');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }
      setProjects(projects.filter((p) => p.id !== id));
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const handleSelectProject = (id: string) => {
    router.push(`/projects/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 animate-pulse" style={{ stroke: 'url(#sparklesGradient)' }} />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" style={{ stroke: 'url(#sparklesGradient)' }} />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Jewelry Design Studio</h1>
          </div>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
            Create stunning jewelry designs with AI-powered image generation
          </p>
          <div className="mt-3 sm:mt-4">
            <Link
              href="/materials"
              className="inline-flex items-center gap-1.5 sm:gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base"
            >
              <Library className="h-4 w-4 sm:h-5 sm:w-5" />
              Materials Library
            </Link>
          </div>
        </div>

        <ProjectList
          projects={projects}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onSelectProject={handleSelectProject}
          loading={loading}
        />
      </div>
    </div>
  );
}
