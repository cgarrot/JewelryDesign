'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Sliders, Copy, X } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SystemPromptModal } from './SystemPromptModal';
import { LLMParametersModal } from './LLMParametersModal';
import { Button } from '@/components/ui/button';
import { toastSuccess, toastError } from '@/lib/toast';
import { Message, ReferenceImage, GeneratedImage } from '@/lib/types';

interface StreamingMessage {
  id: string;
  role: "assistant";
  content: string;
}

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loading?: boolean;
  projectId?: string;
  streamingMessage?: StreamingMessage | null;
  onAutoRegenerateChange?: (autoRegenerate: boolean) => void;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onCopyMessage?: (content: string) => void;
  editingMessage?: { id: string; content: string } | null;
  onEditCancel?: () => void;
  onEditSubmit?: (messageId: string, content: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  selectedReferenceImages?: ReferenceImage[];
  onReferenceImageDeselect?: (imageId: string) => void;
  selectedGeneratedImages?: GeneratedImage[];
  onGeneratedImageDeselect?: (imageId: string) => void;
}

export function ChatSidebar({ 
  messages, 
  onSendMessage, 
  loading, 
  projectId,
  streamingMessage,
  onAutoRegenerateChange,
  onEditMessage,
  onDeleteMessage,
  onCopyMessage,
  editingMessage,
  onEditCancel,
  onEditSubmit,
  onClose,
  isMobile = false,
  selectedReferenceImages = [],
  onReferenceImageDeselect,
  selectedGeneratedImages = [],
  onGeneratedImageDeselect,
}: ChatSidebarProps) {
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
  const [isLLMParametersModalOpen, setIsLLMParametersModalOpen] = useState(false);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [hasCustomLLMParams, setHasCustomLLMParams] = useState(false);
  const [inputHeight, setInputHeight] = useState<number | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Check if custom prompt and LLM parameters exist when projectId changes
  useEffect(() => {
    if (projectId) {
      checkCustomPrompt();
      checkCustomLLMParams();
    }
  }, [projectId]);

  const checkCustomPrompt = async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/system-prompt`);
      if (response.ok) {
        const data = await response.json();
        setHasCustomPrompt(data.systemPrompt !== null && data.systemPrompt !== undefined);
      }
    } catch (error) {
      // Silently fail - just assume no custom prompt
      setHasCustomPrompt(false);
    }
  };

  const checkCustomLLMParams = async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/llm-parameters`);
      if (response.ok) {
        const data = await response.json();
        setHasCustomLLMParams(data.llmParameters !== null && data.llmParameters !== undefined);
      }
    } catch (error) {
      // Silently fail - just assume no custom parameters
      setHasCustomLLMParams(false);
    }
  };

  const handleSystemPromptModalSave = () => {
    // Refresh the custom prompt state after save
    checkCustomPrompt();
  };

  const handleLLMParametersModalSave = () => {
    // Refresh the custom LLM parameters state after save
    checkCustomLLMParams();
  };

  // Handle resize from top
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !inputContainerRef.current) return;

      const deltaY = startYRef.current - e.clientY; // Positive when dragging up
      const newHeight = Math.max(80, Math.min(400, startHeightRef.current + deltaY));
      setInputHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizingRef.current || !inputContainerRef.current) return;
      e.preventDefault(); // Prevent scrolling while resizing

      const touch = e.touches[0];
      const deltaY = startYRef.current - touch.clientY; // Positive when dragging up
      const newHeight = Math.max(80, Math.min(400, startHeightRef.current + deltaY));
      setInputHeight(newHeight);
    };

    const handleTouchEnd = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [inputHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inputContainerRef.current) return;
    
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    const currentHeight = inputHeight || inputContainerRef.current.offsetHeight;
    startHeightRef.current = currentHeight;
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!inputContainerRef.current) return;
    
    isResizingRef.current = true;
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    const currentHeight = inputHeight || inputContainerRef.current.offsetHeight;
    startHeightRef.current = currentHeight;
    
    document.body.style.userSelect = 'none';
  };

  const handleCopyConversation = async () => {
    if (messages.length === 0) {
      toastError('No conversation to copy');
      return;
    }

    // Format messages as simple text conversation
    const formattedMessages = messages.map((message) => {
      // Remove markdown formatting and mentions, keep plain text
      let cleanContent = message.content;
      
      // Remove @ mentions (replace @material with material)
      cleanContent = cleanContent.replace(/@(\w+)/g, '$1');
      
      // Remove markdown formatting (basic cleanup)
      // Remove bold/italic markers
      cleanContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '$1');
      cleanContent = cleanContent.replace(/\*(.*?)\*/g, '$1');
      cleanContent = cleanContent.replace(/_(.*?)_/g, '$1');
      
      // Remove code blocks
      cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
      cleanContent = cleanContent.replace(/`([^`]+)`/g, '$1');
      
      // Remove links but keep text
      cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      
      // Clean up extra whitespace
      cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();
      
      const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
      return `${roleLabel}: ${cleanContent}`;
    }).join('\n\n');

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedMessages);
        toastSuccess('Conversation copied to clipboard');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = formattedMessages;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toastSuccess('Conversation copied to clipboard');
        } catch (err) {
          toastError('Failed to copy conversation');
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      toastError('Failed to copy conversation');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="border-b border-gray-200 p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {projectId && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSystemPromptModalOpen(true)}
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                title="Customize system prompt"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLLMParametersModalOpen(true)}
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                title="Configure LLM parameters (temperature, topP, etc.)"
              >
                <Sliders className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyConversation}
            disabled={messages.length === 0}
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
            title="Copy entire conversation"
          >
            <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Design Chat</h2>
              {hasCustomPrompt && (
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                  Custom Prompt
                </span>
              )}
              {hasCustomLLMParams && (
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 whitespace-nowrap">
                  Custom Params
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Describe your jewelry piece</p>
          </div>
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
              title="Close chat"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <MessageList 
          messages={messages} 
          loading={loading}
          streamingMessage={streamingMessage}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
          onCopy={onCopyMessage}
          projectId={projectId}
        />
      </div>
      <div 
        ref={inputContainerRef}
        className="flex-shrink-0 relative"
        style={{ height: inputHeight !== null ? `${inputHeight}px` : undefined }}
      >
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleTouchStart}
          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-blue-200/30 active:bg-blue-200/50 touch-manipulation transition-colors z-10 group flex items-center justify-center"
          title="Drag to resize input area"
          style={{ touchAction: 'none' }}
        >
          <div className="w-20 h-1 bg-gray-300 rounded-full group-hover:bg-blue-500 transition-colors" />
        </div>
        <ChatInput 
          onSend={onSendMessage} 
          disabled={loading} 
          projectId={projectId}
          onAutoRegenerateChange={onAutoRegenerateChange}
          editingMessage={editingMessage}
          onEditCancel={onEditCancel}
          onEditSubmit={onEditSubmit}
          selectedReferenceImages={selectedReferenceImages}
          onReferenceImageDeselect={onReferenceImageDeselect}
          selectedGeneratedImages={selectedGeneratedImages}
          onGeneratedImageDeselect={onGeneratedImageDeselect}
        />
      </div>
      {projectId && (
        <>
          <SystemPromptModal
            projectId={projectId}
            isOpen={isSystemPromptModalOpen}
            onClose={() => setIsSystemPromptModalOpen(false)}
            onSave={handleSystemPromptModalSave}
          />
          <LLMParametersModal
            projectId={projectId}
            isOpen={isLLMParametersModalOpen}
            onClose={() => setIsLLMParametersModalOpen(false)}
            onSave={handleLLMParametersModalSave}
          />
        </>
      )}
    </div>
  );
}

