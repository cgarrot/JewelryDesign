'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message, Material } from '@/lib/types';

interface StreamingMessage {
  id: string;
  role: "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
  streamingMessage?: StreamingMessage | null;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  projectId?: string;
}

// Function to parse @ mentions and return an array of text parts and mention parts
// Handles material names with spaces like "@Rose Gold"
function parseMessageContent(content: string) {
  const parts: Array<{ type: 'text' | 'mention'; content: string }> = [];
  let lastIndex = 0;
  let index = 0;

  // Find all @ symbols and extract mentions (handles names with spaces)
  while ((index = content.indexOf('@', index)) !== -1) {
    // Check if @ is at start or preceded by whitespace/@
    const isCompleteWord = index === 0 || /[\s@]/.test(content[index - 1]);
    
    if (isCompleteWord) {
      // Add text before the mention
      if (index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, index),
        });
      }

      // Extract the mention - capture the material name after @
      // Stop at the first space that's followed by a common word (in, and, or, for, etc.) or punctuation
      // This handles names like "Rose Gold" (with internal space) but stops before words like "in", "and"
      let mentionStart = index + 1;
      let mentionEnd = mentionStart;
      
      // Common short words that should not be part of material names
      const stopWords = new Set(['in', 'and', 'or', 'for', 'with', 'to', 'of', 'the', 'a', 'an', 'at', 'on', 'by']);
      
      while (mentionEnd < content.length) {
        const char = content[mentionEnd];
        
        if (char === ' ') {
          // Found a space - check what comes after
          let nextWordStart = mentionEnd + 1;
          let nextWordEnd = nextWordStart;
          
          // Extract the next word after the space
          while (nextWordEnd < content.length && /[\w-]/.test(content[nextWordEnd])) {
            nextWordEnd++;
          }
          
          const nextWord = content.substring(nextWordStart, nextWordEnd).toLowerCase();
          
          // If the next word is a stop word, stop before this space
          // Otherwise, if it looks like part of a material name (starts with capital or is a word), continue
          if (stopWords.has(nextWord) || nextWord.length === 0) {
            // Stop before this space
            break;
          }
          
          // Check if we've already found a space (for names like "Rose Gold")
          // If yes, and the next word doesn't look like a material name continuation, stop
          const hasPreviousSpace = content.substring(mentionStart, mentionEnd).includes(' ');
          if (hasPreviousSpace && nextWord.length < 3) {
            // Probably a stop word, stop before this space
            break;
          }
          
          // This space is part of the material name (e.g., "Rose Gold")
          mentionEnd++;
        } else if (/[\w-]/.test(char)) {
          // Word character, continue
          mentionEnd++;
        } else {
          // Non-word, non-space character (punctuation, etc.) - stop
          break;
        }
      }

      // Extract the mention name (without @ and without trailing space)
      const mentionName = content.substring(mentionStart, mentionEnd).trim();
      
      if (mentionName.length > 0) {
        parts.push({
          type: 'mention',
          content: mentionName,
        });
        
        // Set lastIndex to after the @ symbol and mention name
        // This preserves any trailing space that was in the original text
        lastIndex = mentionEnd;
        index = mentionEnd;
      } else {
        // If no valid mention found, skip this @
        index++;
      }
    } else {
      index++;
    }
  }

  // Add any remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  // If no parts were created, return the whole content as text
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: content,
    });
  }

  return parts;
}

export function MessageList({ messages, loading, streamingMessage, onEdit, onDelete, onCopy, projectId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const initialTooltipPositionRef = useRef({ top: 0, left: 0 });

  // Fetch materials on mount
  useEffect(() => {
    if (projectId) {
      fetchMaterials();
    }
  }, [projectId]);

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

  const handleMaterialHover = (materialName: string, event: React.MouseEvent | React.TouchEvent) => {
    const material = materials.find((m) => m.name.toLowerCase() === materialName.toLowerCase());
    if (material) {
      setHoveredMaterial(material);
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        top: rect.bottom + 8,
        left: rect.left,
      };
      initialTooltipPositionRef.current = position;
      setTooltipPosition(position);
    }
  };

  const handleMaterialLeave = () => {
    setHoveredMaterial(null);
  };

  const handleMaterialTap = (materialName: string, event: React.TouchEvent) => {
    // Toggle tooltip on tap for touch devices
    const material = materials.find((m) => m.name.toLowerCase() === materialName.toLowerCase());
    if (material) {
      if (hoveredMaterial?.id === material.id) {
        // If already showing, hide it
        setHoveredMaterial(null);
      } else {
        // Show tooltip
        handleMaterialHover(materialName, event);
      }
    }
  };

  // Update tooltip position on scroll
  useEffect(() => {
    if (!hoveredMaterial) return;

    const updateTooltipPosition = () => {
      if (tooltipRef.current) {
        const tooltip = tooltipRef.current;
        const rect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let { top, left } = initialTooltipPositionRef.current;

        // Adjust if tooltip goes off right edge
        if (left + rect.width > viewportWidth) {
          left = viewportWidth - rect.width - 8;
        }

        // Adjust if tooltip goes off bottom edge
        if (top + rect.height > viewportHeight) {
          top = initialTooltipPositionRef.current.top - rect.height - 16;
        }

        setTooltipPosition({ top, left });
      }
    };

    updateTooltipPosition();
    window.addEventListener('scroll', updateTooltipPosition, true);
    window.addEventListener('resize', updateTooltipPosition);

    // Close tooltip on click/touch outside (for touch devices)
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        // Check if click is on a material mention
        const materialMention = (target as HTMLElement).closest('[data-material-mention]');
        if (!materialMention) {
          setHoveredMaterial(null);
        }
      }
    };

    // Use a small delay to avoid immediate close on touch
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }, 100);

    return () => {
      window.removeEventListener('scroll', updateTooltipPosition, true);
      window.removeEventListener('resize', updateTooltipPosition);
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [hoveredMaterial]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Combine messages with streaming message if it exists
  const allMessages = streamingMessage 
    ? [...messages, { ...streamingMessage, createdAt: new Date() } as Message]
    : messages;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {allMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Start Your Jewelry Design</p>
            <p className="text-sm">Describe the jewelry piece you&apos;d like to create</p>
          </div>
        </div>
      ) : (
        allMessages.map((message) => {
          const isStreaming = streamingMessage && message.id === streamingMessage.id;
          // Use content field for display (same as before)
          // contentJson is available for internal processing but not needed here since
          // we always store the formatted message text in content field
          const contentParts = parseMessageContent(message.content);
          
          return (
          <div
            key={message.id}
            className={cn(
              'flex flex-col',
              message.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-3',
                message.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-900',
                isStreaming && 'relative'
              )}
            >
              {isStreaming && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
              <div className={cn(
                "text-sm whitespace-pre-wrap inline-flex flex-wrap items-baseline gap-1",
                message.role === 'user'
                  ? 'text-white leading-tight'
                  : 'text-gray-900 leading-snug'
              )}>
                  {contentParts.map((part, index) => {
                  if (part.type === 'mention') {
                    const material = materials.find((m) => m.name.toLowerCase() === part.content.toLowerCase());
                    return (
                      <span
                        key={index}
                        data-material-mention
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-help relative',
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800'
                        )}
                        onMouseEnter={(e) => handleMaterialHover(part.content, e)}
                        onMouseLeave={handleMaterialLeave}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleMaterialTap(part.content, e);
                        }}
                      >
                        @{part.content}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={index}
                      className={cn(
                        'inline',
                        message.role === 'user'
                          ? '[&_*]:text-white [&_strong]:text-white [&_em]:text-white [&_code]:bg-gray-800 [&_code]:text-gray-100'
                          : '[&_*]:text-gray-900 [&_strong]:text-gray-900 [&_em]:text-gray-900 [&_code]:bg-gray-200 [&_code]:text-gray-900'
                      )}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                        p: ({ children }) => <span className="inline">{children}</span>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children, className }) => {
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code className={cn(
                                'px-1 py-0.5 rounded text-xs font-mono',
                                message.role === 'user'
                                  ? 'bg-gray-800 text-gray-100'
                                  : 'bg-gray-200 text-gray-900'
                              )}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code className={cn(
                              'block px-2 py-1 rounded text-xs font-mono my-1',
                              message.role === 'user'
                                ? 'bg-gray-800 text-gray-100'
                                : 'bg-gray-200 text-gray-900'
                            )}>
                              {children}
                            </code>
                          );
                        },
                        ul: ({ children }) => <ul className="list-disc list-inside my-1 space-y-0.5 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside my-1 space-y-0.5 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="ml-4 mb-0.5 leading-snug">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                        br: () => <br />,
                        }}
                      >
                        {part.content}
                      </ReactMarkdown>
                    </span>
                  );
                })}
              </div>
            </div>
            {/* Action buttons below the bubble - always visible, but not for streaming messages */}
            {(onEdit || onDelete || onCopy) && !isStreaming && (
              <div className={cn(
                'flex gap-1 mt-1.5',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                {onCopy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCopy(message.content);
                    }}
                    className="h-9 w-9 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title="Copy message"
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(message);
                    }}
                    className="h-9 w-9 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title="Edit message"
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(message.id);
                    }}
                    className="h-9 w-9 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete message"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          );
        })
      )}
      {/* Show loading indicator only if not streaming (streaming message replaces it) */}
      {loading && !streamingMessage && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      
      {/* Material Tooltip */}
      {hoveredMaterial && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="space-y-2">
            <div>
              <h3 className="font-semibold text-sm text-gray-900">{hoveredMaterial.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{hoveredMaterial.category}</p>
            </div>
            
            {hoveredMaterial.imageUrl && (
              <div className="w-full h-32 rounded overflow-hidden border border-gray-200">
                <img
                  src={hoveredMaterial.imageUrl}
                  alt={hoveredMaterial.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide image if it fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">
              {hoveredMaterial.prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

