'use client';

import { Material } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon } from 'lucide-react';
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

  useEffect(() => {
    // Initialize contenteditable with existing prompt
    if (promptRef.current && material?.prompt) {
      promptRef.current.innerHTML = material.prompt;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {material ? 'Edit Material' : 'New Material'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Gold, Ring, Art Deco"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt with rich text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt / Description
            </label>
            
            {/* Formatting toolbar */}
            <div className="flex gap-1 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
              <button
                type="button"
                onClick={() => handleFormatting('bold')}
                className="px-3 py-1 text-sm hover:bg-gray-200 rounded font-bold"
                title="Bold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('italic')}
                className="px-3 py-1 text-sm hover:bg-gray-200 rounded italic"
                title="Italic"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('insertUnorderedList')}
                className="px-3 py-1 text-sm hover:bg-gray-200 rounded"
                title="Bullet List"
              >
                • List
              </button>
            </div>

            <div
              ref={promptRef}
              contentEditable
              onInput={handlePromptChange}
              className="w-full min-h-[150px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              style={{ whiteSpace: 'pre-wrap', color: '#111827' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Describe this material, type, or style in detail. This will be used to enrich image generation.
            </p>
          </div>

          {/* Scope */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Global (available to all projects)
              </span>
            </label>
          </div>

          {/* Preview Image */}
          {material && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Image
              </label>
              {previewImageUrl ? (
                <div className="relative">
                  <img
                    src={previewImageUrl}
                    alt="Material preview"
                    className="w-full h-48 object-cover rounded border"
                  />
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={generatingPreview}
                    className="mt-2"
                    variant="outline"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generatingPreview ? 'Regenerating...' : 'Regenerate Preview'}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="w-full h-48 bg-gray-100 rounded border flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-300" />
                  </div>
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={generatingPreview}
                    className="mt-2"
                    variant="outline"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generatingPreview ? 'Generating...' : 'Generate Preview'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : material ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

