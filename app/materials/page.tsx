'use client';

import { useEffect, useState } from 'react';
import { Material } from '@/lib/types';
import { MaterialsList } from '@/components/materials/MaterialsList';
import { MaterialEditor } from '@/components/materials/MaterialEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Sparkles, Grid3x3, List, LayoutGrid, ChevronRight, Home } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import Link from 'next/link';
import { DisplayMode } from '@/components/materials/MaterialsList';

const CATEGORIES = [
  'All',
  'Material',
  'Type',
  'Style',
  'Shape',
  'Gemstone',
  'Technique',
  'Pattern',
  'Finish',
  'Other',
];

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [generatingAllPreviews, setGeneratingAllPreviews] = useState(false);
  const [currentGeneratingMaterial, setCurrentGeneratingMaterial] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    // Filter materials based on search and category
    let filtered = materials;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.prompt.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query)
      );
    }

    setFilteredMaterials(filtered);
  }, [materials, selectedCategory, searchQuery]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch materials');
      }
      const data = await response.json();
      setMaterials(data.materials || []);
      setFilteredMaterials(data.materials || []);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to fetch materials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = () => {
    setEditingMaterial(null);
    setShowEditor(true);
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setShowEditor(true);
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      const response = await fetch(`/api/materials?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete material');
      }
      setMaterials(materials.filter((m) => m.id !== id));
      toastSuccess('Material deleted successfully');
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to delete material');
    }
  };

  const handleSaveMaterial = (material: Material) => {
    // Update or add material to list
    const index = materials.findIndex((m) => m.id === material.id);
    if (index !== -1) {
      const newMaterials = [...materials];
      newMaterials[index] = material;
      setMaterials(newMaterials);
    } else {
      setMaterials([material, ...materials]);
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingMaterial(null);
  };

  const handleGenerateAllPreviews = async () => {
    const materialsWithoutImages = materials.filter((m) => !m.imageUrl && !m.imageData);
    
    if (materialsWithoutImages.length === 0) {
      toastSuccess('All materials already have preview images');
      return;
    }

    if (!confirm(`Generate preview images for ${materialsWithoutImages.length} materials? This may take a few minutes.`)) {
      return;
    }

    setGeneratingAllPreviews(true);
    
    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Generate images one by one and update UI after each
    for (const material of materialsWithoutImages) {
      setCurrentGeneratingMaterial(material.name);
      
      try {
        const response = await fetch('/api/materials/generate-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialId: material.id }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate preview');
        }

        const data = await response.json();
        
        // Update the material in the list immediately with the image URL
        const updatedMaterial: Material = {
          ...data.material,
          imageUrl: data.imageUrl || data.material?.imageUrl,
        };
        
        setMaterials((prev) => {
          const index = prev.findIndex((m) => m.id === updatedMaterial.id);
          if (index !== -1) {
            const newMaterials = [...prev];
            newMaterials[index] = updatedMaterial;
            return newMaterials;
          }
          return prev;
        });

        generated++;
      } catch (error) {
        failed++;
        const errorMessage = `${material.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error(`Failed to generate preview for ${material.name}:`, error);
      } finally {
        setCurrentGeneratingMaterial(null);
        // Small delay between requests to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Show final summary
    if (errors.length > 0) {
      toastError(`Generated ${generated} images. ${failed} failed. Check console for details.`);
      console.error('Preview generation errors:', errors);
    } else {
      toastSuccess(`Successfully generated ${generated} preview images`);
    }

    setGeneratingAllPreviews(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 animate-pulse" style={{ stroke: 'url(#sparklesGradient)' }} />
          <p className="text-gray-600">Loading materials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2.5 text-sm">
            <li>
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 group"
              >
                <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Dashboard</span>
              </Link>
            </li>
            <li>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </li>
            <li className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
              <Sparkles className="h-4 w-4" style={{ stroke: 'url(#sparklesGradient)' }} />
              <span className="text-gray-900 font-semibold">Materials Library</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Materials Library</h1>
            </div>
            <Button onClick={handleCreateMaterial}>
              <Plus className="h-4 w-4 mr-2" />
              New Material
            </Button>
          </div>
          <p className="text-gray-600">
            Create reusable materials, styles, and patterns to standardize your jewelry designs
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search materials by name, prompt, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count, view toggle, and bulk actions */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('grid')}
                className={`p-2 rounded transition-colors ${
                  displayMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Grid View"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMode('simple-grid')}
                className={`p-2 rounded transition-colors ${
                  displayMode === 'simple-grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Simple Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`p-2 rounded transition-colors ${
                  displayMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          {(() => {
            const materialsWithoutImages = materials.filter((m) => !m.imageUrl && !m.imageData);
            if (materialsWithoutImages.length === 0) return null;
            
            return (
              <div className="flex items-center gap-2">
                {currentGeneratingMaterial && (
                  <span className="text-sm text-gray-600">
                    Generating: {currentGeneratingMaterial}...
                  </span>
                )}
                <Button
                  onClick={handleGenerateAllPreviews}
                  disabled={generatingAllPreviews}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" style={{ stroke: 'url(#sparklesGradient)' }} />
                  {generatingAllPreviews
                    ? 'Generating...'
                    : `Generate All Previews (${materialsWithoutImages.length})`}
                </Button>
              </div>
            );
          })()}
          </div>
        </div>

        {/* Materials List */}
        <MaterialsList
          materials={filteredMaterials}
          onEdit={handleEditMaterial}
          onDelete={handleDeleteMaterial}
          displayMode={displayMode}
          currentGeneratingMaterial={currentGeneratingMaterial}
        />

        {/* Material Editor Modal */}
        {showEditor && (
          <MaterialEditor
            material={editingMaterial}
            onClose={handleCloseEditor}
            onSave={handleSaveMaterial}
          />
        )}
      </div>
    </div>
  );
}

