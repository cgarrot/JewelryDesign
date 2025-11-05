'use client';

import { Material } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidePanel } from '@/components/ui/side-panel';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Image as ImageIcon, Bold, Italic, List, Globe, Save } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';

interface MaterialEditorProps {
  material?: Material | null;
  projectId?: string | null;
  onClose: () => void;
  onSave: (material: Material) => void;
}

const CATEGORIES = [
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

export function MaterialEditor({ material, projectId, onClose, onSave }: MaterialEditorProps) {
  const [name, setName] = useState(material?.name || '');
  const [prompt, setPrompt] = useState(material?.prompt || '');
  const [category, setCategory] = useState(material?.category || 'Material');
  const [isGlobal, setIsGlobal] = useState(material?.isGlobal ?? true);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(material?.imageUrl || '');

  const promptRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize contenteditable with existing prompt
    if (promptRef.current && material?.prompt) {
      promptRef.current.innerHTML = material.prompt;
    }
    // Reset state when material changes
    if (material) {
      setName(material.name || '');
      setPrompt(material.prompt || '');
      setCategory(material.category || 'Material');
      setIsGlobal(material.isGlobal ?? true);
      setPreviewImageUrl(material.imageUrl || '');
    } else {
      // Reset for new material
      setName('');
      setPrompt('');
      setCategory('Material');
      setIsGlobal(true);
      setPreviewImageUrl('');
    }
  }, [material]);

  const handleFormatting = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    promptRef.current?.focus();
  };

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) {
      toastError('Name and prompt are required');
      return;
    }

    setSaving(true);
    try {
      const url = material ? '/api/materials' : '/api/materials';
      const method = material ? 'PATCH' : 'POST';

      const body: any = {
        name: name.trim(),
        prompt: prompt.trim(),
        category,
        isGlobal,
      };

      if (material) {
        body.id = material.id;
      } else if (!isGlobal && projectId) {
        body.projectId = projectId;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save material');
      }

      const data = await response.json();
      toastSuccess(material ? 'Material updated' : 'Material created');
      onSave(data.material);
      onClose();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!material?.id) {
      toastError('Please save the material first before generating a preview');
      return;
    }

    setGeneratingPreview(true);
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
      setPreviewImageUrl(data.imageUrl);
      toastSuccess('Preview generated successfully');
      onSave(data.material);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handlePromptChange = () => {
    if (promptRef.current) {
      setPrompt(promptRef.current.innerHTML);
    }
  };

  const panelTitle = material ? 'Edit Material' : 'New Material';

  return (
    <SidePanel
      isOpen={true}
      onClose={onClose}
      title={panelTitle}
      width="640px"
    >
      <div className="flex flex-col h-full">
        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
          <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
            </label>
            <Input
                  ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Gold, Ring, Art Deco"
                  className="w-full"
            />
                <p className="text-xs text-gray-500 mt-1.5">
                  A short, descriptive name for this material or style
                </p>
          </div>

          {/* Category */}
          <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Categorize this material for better organization
                </p>
              </div>
          </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Description Section */}
          <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Prompt / Description <span className="text-red-500">*</span>
            </label>
            
              {/* Enhanced Formatting toolbar */}
              <div className="flex items-center gap-1 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => handleFormatting('bold')}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Bold"
              >
                  <Bold className="h-4 w-4 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('italic')}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Italic"
              >
                  <Italic className="h-4 w-4 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('insertUnorderedList')}
                  className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Bullet List"
              >
                  <List className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            <div
              ref={promptRef}
              contentEditable
              onInput={handlePromptChange}
                className="w-full min-h-[180px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 text-sm leading-relaxed material-editor-placeholder"
                style={{ whiteSpace: 'pre-wrap' }}
                data-placeholder="Describe this material, type, or style in detail. This will be used to enrich image generation..."
            />
              <p className="text-xs text-gray-500 mt-2">
              Describe this material, type, or style in detail. This will be used to enrich image generation.
            </p>
          </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Settings Section */}
            <div className="space-y-4">
          <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Visibility
                </label>
                <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">
                Global (available to all projects)
              </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      When enabled, this material will be available in all projects. Otherwise, it will only be available in the current project.
                    </p>
                  </div>
            </label>
              </div>
          </div>

            {/* Preview Image Section */}
          {material && (
              <>
                <div className="border-t border-gray-200" />
            <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                Preview Image
              </label>
              {previewImageUrl ? (
                    <div className="space-y-3">
                      <div className="relative group rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                  <img
                    src={previewImageUrl}
                    alt="Material preview"
                          className="w-full h-64 object-cover"
                  />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      </div>
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={generatingPreview}
                    variant="outline"
                    size="sm"
                        className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" style={{ stroke: 'url(#sparklesGradient)' }} />
                        {generatingPreview ? 'Regenerating Preview...' : 'Regenerate Preview'}
                  </Button>
                </div>
              ) : (
                    <div className="space-y-3">
                      <div className="w-full h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500 font-medium">No preview image</p>
                        <p className="text-xs text-gray-400 mt-1">Generate a preview to visualize this material</p>
                  </div>
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={generatingPreview}
                    variant="outline"
                    size="sm"
                        className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" style={{ stroke: 'url(#sparklesGradient)' }} />
                        {generatingPreview ? 'Generating Preview...' : 'Generate Preview'}
                  </Button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    A visual preview helps identify materials quickly in the library
                  </p>
                </div>
              </>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <Button onClick={onClose} variant="outline" size="sm">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !name.trim() || !prompt.trim()}
            size="sm"
            className="min-w-[100px]"
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {material ? 'Update' : 'Create'}
              </>
            )}
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}

