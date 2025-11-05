'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message } from '@/lib/types';

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
}

// Function to parse @ mentions and return an array of text parts and mention parts
function parseMessageContent(content: string) {
  const parts: Array<{ type: 'text' | 'mention'; content: string }> = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      });
    }

    // Add the mention
    parts.push({
      type: 'mention',
      content: match[1], // The material name without @
    });

    lastIndex = regex.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  return parts;
}

export function MessageList({ messages, loading, streamingMessage, onEdit, onDelete, onCopy }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
                "text-sm leading-snug whitespace-pre-wrap",
                message.role === 'user'
                  ? 'text-white'
                  : 'text-gray-900'
              )}>
                {contentParts.map((part, index) => {
                  if (part.type === 'mention') {
                    return (
                      <span
                        key={index}
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mx-0.5',
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800'
                        )}
                      >
                        @{part.content}
                      </span>
                    );
                  }
                  return (
                    <div
                      key={index}
                      className={cn(
                        'block',
                        message.role === 'user'
                          ? '[&_*]:text-white [&_strong]:text-white [&_em]:text-white [&_code]:bg-gray-800 [&_code]:text-gray-100'
                          : '[&_*]:text-gray-900 [&_strong]:text-gray-900 [&_em]:text-gray-900 [&_code]:bg-gray-200 [&_code]:text-gray-900'
                      )}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
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
                    </div>
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
    </div>
  );
}

