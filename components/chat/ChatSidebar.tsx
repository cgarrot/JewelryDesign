'use client';

import { useState, useEffect } from 'react';
import { Settings, Sliders } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SystemPromptModal } from './SystemPromptModal';
import { LLMParametersModal } from './LLMParametersModal';
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
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
  const [isLLMParametersModalOpen, setIsLLMParametersModalOpen] = useState(false);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [hasCustomLLMParams, setHasCustomLLMParams] = useState(false);

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

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {projectId && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSystemPromptModalOpen(true)}
                className="h-10 w-10 p-0 flex-shrink-0"
                title="Customize system prompt"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLLMParametersModalOpen(true)}
                className="h-10 w-10 p-0 flex-shrink-0"
                title="Configure LLM parameters (temperature, topP, etc.)"
              >
                <Sliders className="h-5 w-5" />
              </Button>
            </>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Design Chat</h2>
              {hasCustomPrompt && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Custom Prompt
                </span>
              )}
              {hasCustomLLMParams && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Custom Params
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

