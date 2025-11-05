'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MaterialAutocomplete } from './MaterialAutocomplete';
import { Material } from '@/lib/types';

interface EditingMessage {
  id: string;
  content: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  projectId?: string;
  onAutoRegenerateChange?: (autoRegenerate: boolean) => void;
  editingMessage?: EditingMessage | null;
  onEditCancel?: () => void;
  onEditSubmit?: (messageId: string, content: string) => void;
}

export function ChatInput({ 
  onSend, 
  disabled, 
  projectId, 
  onAutoRegenerateChange,
  editingMessage,
  onEditCancel,
  onEditSubmit,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync message with editingMessage when in edit mode
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      // Focus textarea when entering edit mode
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          editingMessage.content.length,
          editingMessage.content.length
        );
      }, 0);
    } else {
      setMessage('');
    }
  }, [editingMessage]);

  // Fetch materials on mount
  useEffect(() => {
    fetchMaterials();
  }, [projectId]);

  // Ensure selected index stays within bounds when filtered list changes
  useEffect(() => {
    if (showAutocomplete) {
      const filteredMaterials = materials.filter((m) =>
        m.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
      );
      const visibleCount = filteredMaterials.length;
      setSelectedMaterialIndex((prev) => {
        if (prev >= visibleCount && visibleCount > 0) {
          return visibleCount - 1;
        } else if (visibleCount === 0) {
          return 0;
        }
        return prev;
      });
    }
  }, [autocompleteQuery, materials, showAutocomplete]);

  // Update dropdown position when scrolling
  useEffect(() => {
    if (!showAutocomplete || !textareaRef.current) return;

    const updatePosition = () => {
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        const dropdownWidth = 280; // minWidth from MaterialAutocomplete
        const dropdownHeight = 256; // max-h-64 = 16rem = 256px
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate position, ensuring dropdown stays within viewport
        let left = rect.left;
        let top = rect.bottom + 4;

        // Adjust if dropdown would go off right edge
        if (left + dropdownWidth > viewportWidth) {
          left = Math.max(0, viewportWidth - dropdownWidth - 8);
        }

        // Adjust if dropdown would go off bottom edge (show above instead)
        if (top + dropdownHeight > viewportHeight && rect.top > dropdownHeight) {
          top = rect.top - dropdownHeight - 4;
        }

        setAutocompletePosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showAutocomplete, message]);

  const fetchMaterials = async () => {
    try {
      const url = projectId ? `/api/materials?projectId=${projectId}` : '/api/materials';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      if (editingMessage && onEditSubmit) {
        // In edit mode, call onEditSubmit
        onEditSubmit(editingMessage.id, message.trim());
      } else {
        // Normal mode, send new message
        onSend(message.trim());
        setMessage('');
      }
      setShowAutocomplete(false);
    }
  };

  const handleCancelEdit = () => {
    if (onEditCancel) {
      onEditCancel();
    }
    setMessage('');
    setShowAutocomplete(false);
  };

  // Parse message to extract mentions - only return exact matches with materials
  const extractMentions = (text: string): string[] => {
    const regex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const mentionName = match[1];
      // Only include if it's a complete word (not part of a longer word) 
      // and matches an existing material exactly
      const isCompleteWord = 
        match.index === 0 || 
        /[\s@]/.test(text[match.index - 1]);
      
      const afterMatch = text[match.index + match[0].length];
      const isWordEnd = 
        afterMatch === undefined || 
        /[\s\n]/.test(afterMatch);
      
      if (isCompleteWord && isWordEnd) {
        // Check if this mention exactly matches a material name
        const material = materials.find((m) => 
          m.name.toLowerCase() === mentionName.toLowerCase()
        );
        if (material) {
          mentions.push(material.name); // Use the exact material name (with correct casing)
        }
      }
    }
    
    return [...new Set(mentions)]; // Remove duplicates
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setMessage(value);

    // Check for @ mentions
    const beforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const afterAt = beforeCursor.slice(lastAtIndex + 1);
      const hasSpace = afterAt.includes(' ') || afterAt.includes('\n');
      
      if (!hasSpace) {
        // Show autocomplete
        setMentionStartIndex(lastAtIndex);
        setAutocompleteQuery(afterAt);
        setShowAutocomplete(true);
        setSelectedMaterialIndex(0);
        
        // Calculate position for autocomplete
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setAutocompletePosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleMaterialSelect = (material: Material) => {
    if (mentionStartIndex !== -1 && textareaRef.current) {
      const before = message.slice(0, mentionStartIndex);
      const cursorPos = textareaRef.current.selectionStart || 0;
      const after = message.slice(cursorPos);
      const newMessage = `${before}@${material.name} ${after}`;
      setMessage(newMessage);
      setShowAutocomplete(false);
      
      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursorPos = mentionStartIndex + material.name.length + 2;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      const filteredMaterials = materials.filter((m) =>
        m.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
      );
      const visibleCount = filteredMaterials.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMaterialIndex((prev) => 
          Math.min(prev + 1, visibleCount - 1)
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMaterialIndex((prev) => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter' && filteredMaterials.length > 0) {
        e.preventDefault();
        const safeIndex = Math.min(selectedMaterialIndex, visibleCount - 1);
        handleMaterialSelect(filteredMaterials[safeIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const mentions = extractMentions(message);

  const isEditing = !!editingMessage;

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 sm:p-4 relative h-full flex flex-col pt-4 sm:pt-5">
      {/* Edit mode indicator */}
      {isEditing && (
        <div className="mb-2 flex items-center gap-1.5 px-2 py-0.5 flex-shrink-0">
          <span className="text-xs text-blue-600">Editing message</span>
          {onEditCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              className="h-4 w-4 p-0 ml-auto text-blue-600 hover:text-blue-900 hover:bg-transparent"
              title="Cancel edit"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Mentions tags display */}
      {mentions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 sm:gap-2 flex-shrink-0">
          {mentions.map((mentionName) => {
            const material = materials.find((m) => m.name === mentionName);
            return (
              <span
                key={mentionName}
                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
              >
                @{mentionName}
              </span>
            );
          })}
        </div>
      )}
      
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        {!isEditing && (
          <div className="flex items-center gap-1.5 mb-1 flex-shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
              <input
                type="checkbox"
                checked={autoRegenerate}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAutoRegenerate(checked);
                  onAutoRegenerateChange?.(checked);
                }}
                className="w-4 h-4 sm:w-3.5 sm:h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer"
                disabled={disabled}
              />
              <span className="select-none text-xs sm:text-xs">Auto-regenerate</span>
            </label>
          </div>
        )}
        <div className="flex gap-2 flex-1 min-h-0">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isEditing ? "Edit your message..." : "Describe your jewelry design... (use @ to mention materials)"}
            className="resize-none text-sm flex-1 min-h-0 overflow-y-auto"
            disabled={disabled}
          />
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isEditing && onEditCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={disabled}
                className="h-9 sm:h-10 px-2 sm:px-3"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="submit"
              disabled={disabled || !message.trim()}
              className="h-9 sm:h-10 w-9 sm:w-auto px-2 sm:px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {showAutocomplete && (
        <MaterialAutocomplete
          materials={materials}
          searchQuery={autocompleteQuery}
          position={autocompletePosition}
          onSelect={handleMaterialSelect}
          selectedIndex={selectedMaterialIndex}
        />
      )}
    </form>
  );
}

