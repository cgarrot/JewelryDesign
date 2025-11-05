'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SystemPromptModal } from './SystemPromptModal';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loading?: boolean;
  projectId?: string;
  onAutoRegenerateChange?: (autoRegenerate: boolean) => void;
}

export function ChatSidebar({ messages, onSendMessage, loading, projectId, onAutoRegenerateChange }: ChatSidebarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);

  // Check if custom prompt exists when projectId changes
  useEffect(() => {
    if (projectId) {
      checkCustomPrompt();
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

  const handleModalSave = () => {
    // Refresh the custom prompt state after save
    checkCustomPrompt();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {projectId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-10 w-10 p-0 flex-shrink-0"
              title="Customize system prompt"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Design Chat</h2>
              {hasCustomPrompt && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Custom
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Describe your jewelry piece</p>
          </div>
        </div>
      </div>
      <MessageList messages={messages} loading={loading} />
      <ChatInput 
        onSend={onSendMessage} 
        disabled={loading} 
        projectId={projectId}
        onAutoRegenerateChange={onAutoRegenerateChange}
      />
      {projectId && (
        <SystemPromptModal
          projectId={projectId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}

