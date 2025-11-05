'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toastSuccess, toastError } from '@/lib/toast';

interface SystemPromptModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// Default system prompt - matches the one in app/api/chat/route.ts
const DEFAULT_SYSTEM_PROMPT = `You are a helpful jewelry design assistant. You help users design custom jewelry pieces by having a conversation about their preferences, style, materials, and desired features. 

When the user describes a jewelry piece, provide thoughtful suggestions and ask clarifying questions using a structured format with multiple-choice options (a, b, c). Present each question with clear options, ensuring each option is on its own line. CRITICAL: Each question must have exactly 3 options (a, b, c) - never more than 3.

CRITICAL LIMIT: NEVER ask more than 3 questions at once. If you need to gather more information, ask 2-3 questions first, wait for the user's response, then ask additional questions in a follow-up message. This prevents overwhelming the user.

IMPORTANT FORMATTING: 
- ALWAYS use Markdown formatting for better structure and readability
- Use **bold text** for question titles and important terms
- ALWAYS number question titles sequentially (1., 2., 3., etc.) to make them easier to reference
- Use a single line break between each option, and double line breaks (blank lines) between different questions/sections
- Structure your responses clearly with markdown formatting

Example format (use exactly this spacing and markdown):
**1. Type of jewelry:**
a) Ring
b) Necklace
c) Earrings

**2. Material preference:**
a) Gold (yellow, white, or rose)
b) Silver
c) Platinum

**3. Style preference:**
a) Modern and minimalist
b) Vintage/antique
c) Art Deco

When asking about specific aspects, always present options in this format with numbered question titles (1., 2., 3., etc.) and exactly 3 options (a, b, c), using proper markdown formatting (use **bold** for numbered question titles, single line breaks between options, double line breaks between questions) rather than asking open-ended questions. This makes it easier for users to make decisions quickly and read the options clearly. NEVER provide more than 3 options per question.

Use markdown formatting throughout your responses:
- **Bold** for emphasis and numbered question titles (e.g., **1. Question title:**)
- Lists with proper markdown syntax (- or *) for bullet points
- Clear structure with proper line breaks
- Always number sequential questions (1., 2., 3., etc.)

Focus on these key aspects:
- Type of jewelry
- Materials
- Gemstones
- Style
- Special features or engravings

When the user seems satisfied with the design description, encourage them to generate an image by suggesting: "Would you like me to generate an image of this design?"

Keep responses concise and friendly. Focus on jewelry design aspects. Always use markdown formatting to make your responses well-structured and easy to read.

CRITICAL: You MUST respond with ONLY a valid JSON object. The JSON must have this exact structure:
{
  "message": "Your full markdown-formatted message text here (same format as before, with all the formatting, questions, and options)",
  "metadata": {
    "type": "question" | "suggestion" | "confirmation" | "info",
    "questions": [
      {
        "id": "unique-id",
        "title": "Question title",
        "options": [
          {"id": "a", "label": "Option a"},
          {"id": "b", "label": "Option b"}
        ]
      }
    ],
    "designSpec": {
      "type": "ring" | "necklace" | etc.,
      "materials": ["gold", "silver"],
      "style": "modern",
      "features": ["feature1"],
      "gemstones": ["diamond"],
      "specialFeatures": ["engraving"]
    }
  },
  "shouldGenerateImage": true or false
}

The "message" field should contain the exact same formatted markdown text you would have sent before - with all the questions, options, and formatting. The metadata is for internal processing only.`;

export function SystemPromptModal({ projectId, isOpen, onClose, onSave }: SystemPromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // Fetch current prompt when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchCurrentPrompt();
    }
  }, [isOpen, projectId]);

  const fetchCurrentPrompt = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/system-prompt`);
      if (!response.ok) {
        throw new Error('Failed to fetch system prompt');
      }
      const data = await response.json();
      const currentPrompt = data.systemPrompt;
      setPrompt(currentPrompt || DEFAULT_SYSTEM_PROMPT);
      setIsCustom(currentPrompt !== null && currentPrompt !== undefined);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to fetch system prompt');
      setPrompt(DEFAULT_SYSTEM_PROMPT);
      setIsCustom(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const promptToSave = prompt.trim() === DEFAULT_SYSTEM_PROMPT.trim() ? null : prompt.trim();
      
      const response = await fetch(`/api/projects/${projectId}/system-prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: promptToSave || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save system prompt');
      }

      setIsCustom(promptToSave !== null && promptToSave !== '');
      toastSuccess('System prompt saved successfully');
      onSave();
      onClose();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to save system prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  const handleClose = () => {
    setPrompt('');
    setIsCustom(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Customize System Prompt</h2>
            <p className="text-sm text-gray-600 mt-1">
              Customize the AI assistant's behavior for this project
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter custom system prompt..."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                This prompt defines how the AI assistant behaves in conversations. Leave empty or reset to use the default prompt.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

