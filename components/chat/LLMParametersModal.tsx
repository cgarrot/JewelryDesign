"use client";

import { useState, useEffect } from "react";
import { X, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastSuccess, toastError } from "@/lib/toast";

interface LLMParametersModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface LLMParameters {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

// Default LLM parameters
const DEFAULT_PARAMETERS: LLMParameters = {
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

export function LLMParametersModal({
  projectId,
  isOpen,
  onClose,
  onSave,
}: LLMParametersModalProps) {
  const [parameters, setParameters] = useState<LLMParameters>({});
  const [loading, setLoading] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  // Fetch current parameters when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchCurrentParameters();
    }
  }, [isOpen, projectId]);

  const fetchCurrentParameters = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/llm-parameters`);
      if (!response.ok) {
        throw new Error("Failed to fetch LLM parameters");
      }
      const data = await response.json();
      const currentParams = data.llmParameters;
      if (currentParams && typeof currentParams === "object") {
        setParameters(currentParams as LLMParameters);
        setIsCustom(true);
      } else {
        setParameters({});
        setIsCustom(false);
      }
    } catch (error) {
      toastError(
        error instanceof Error
          ? error.message
          : "Failed to fetch LLM parameters"
      );
      setParameters({});
      setIsCustom(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Filter out undefined values and check if any custom parameters remain
      const filteredParams: LLMParameters = {};
      Object.keys(parameters).forEach((key) => {
        const paramKey = key as keyof LLMParameters;
        const value = parameters[paramKey];
        if (value !== undefined && value !== null) {
          // Only include if it's different from default
          if (value !== DEFAULT_PARAMETERS[paramKey]) {
            filteredParams[paramKey] = value;
          }
        }
      });

      // If all parameters match defaults or are empty, save null
      const paramsToSave =
        Object.keys(filteredParams).length > 0 ? filteredParams : null;

      const response = await fetch(
        `/api/projects/${projectId}/llm-parameters`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ llmParameters: paramsToSave }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save LLM parameters");
      }

      setIsCustom(paramsToSave !== null && paramsToSave !== undefined);
      toastSuccess("LLM parameters saved successfully");
      onSave();
      onClose();
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to save LLM parameters"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParameters({});
  };

  const handleClose = () => {
    setParameters({});
    setIsCustom(false);
    setOpenTooltip(null);
    onClose();
  };

  // Close tooltips when clicking outside
  useEffect(() => {
    if (!isOpen || openTooltip === null) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside tooltip
      if (!target.closest('[data-info-tooltip]') && !target.closest('svg')) {
        setOpenTooltip(null);
      }
    };

    // Small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [isOpen, openTooltip]);

  const updateParameter = (key: keyof LLMParameters, value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    if (value === "" || (numValue !== undefined && !isNaN(numValue))) {
      setParameters((prev) => ({
        ...prev,
        [key]: numValue,
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">LLM Parameters</h2>
            <p className="text-sm text-gray-600 mt-1">
              Control the AI model's behavior and output characteristics
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
        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="space-y-6">
            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>Temperature</span>
                <span className="ml-2 text-xs text-gray-500">(0.0 - 2.0)</span>
                <div className="relative group" data-info-tooltip="temperature">
                  <Info 
                    className="h-4 w-4 text-gray-400 cursor-help touch-manipulation" 
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenTooltip(openTooltip === 'temperature' ? null : 'temperature');
                    }}
                  />
                  <div className={`absolute left-full top-0 ml-2 w-80 max-h-48 overflow-y-auto p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl transition-all duration-200 z-[9999] pointer-events-none ${
                    openTooltip === 'temperature' ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'
                  }`}>
                    <p className="font-semibold mb-2">
                      Temperature controls response creativity
                    </p>
                    <p className="mb-2">
                      <strong>Increase (1.5-2.0):</strong> The AI will suggest
                      more varied and creative jewelry designs. For example,
                      instead of "gold ring with diamond," it might suggest
                      "rose gold band with an asymmetrical arrangement of
                      emerald-cut diamonds and hidden sapphire accents."
                    </p>
                    <p>
                      <strong>Decrease (0.0-0.5):</strong> The AI will be more
                      predictable and consistent. It will stick closer to
                      standard jewelry descriptions like "white gold solitaire
                      ring with round diamond," avoiding unusual or creative
                      combinations.
                    </p>
                    <p className="mt-2 text-gray-300">
                      Default: 1.0 (balanced creativity)
                    </p>
                  </div>
                </div>
              </label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={parameters.temperature ?? DEFAULT_PARAMETERS.temperature}
                onChange={(e) => updateParameter("temperature", e.target.value)}
                placeholder={DEFAULT_PARAMETERS.temperature?.toString()}
                className="w-full"
              />
              <p className="mt-2 text-xs text-gray-500">
                <strong>Increase:</strong> More creative and varied design
                suggestions. <strong>Decrease:</strong> More predictable and
                consistent responses.
              </p>
            </div>

            {/* Top P */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>Top P (Nucleus Sampling)</span>
                <span className="ml-2 text-xs text-gray-500">(0.0 - 1.0)</span>
                <div className="relative group" data-info-tooltip="topP">
                  <Info 
                    className="h-4 w-4 text-gray-400 cursor-help touch-manipulation" 
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenTooltip(openTooltip === 'topP' ? null : 'topP');
                    }}
                  />
                  <div className={`absolute left-full top-0 ml-2 w-80 max-h-48 overflow-y-auto p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl transition-all duration-200 z-[9999] pointer-events-none ${
                    openTooltip === 'topP' ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'
                  }`}>
                    <p className="font-semibold mb-2">
                      Top P controls word selection diversity
                    </p>
                    <p className="mb-2">
                      <strong>Increase (0.95-1.0):</strong> The AI can choose
                      from a wider vocabulary. When describing a ring, it might
                      use varied terms like "platinum band," "elegant setting,"
                      "prong-mounted," or "bezel-set" instead of always using
                      the same words.
                    </p>
                    <p>
                      <strong>Decrease (0.5-0.7):</strong> The AI will use more
                      common, expected words. It will consistently use standard
                      jewelry terminology like "gold ring" and "diamond" rather
                      than exploring alternative descriptions.
                    </p>
                    <p className="mt-2 text-gray-300">
                      Default: 0.95 (balanced diversity)
                    </p>
                  </div>
                </div>
              </label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={parameters.topP ?? DEFAULT_PARAMETERS.topP}
                onChange={(e) => updateParameter("topP", e.target.value)}
                placeholder={DEFAULT_PARAMETERS.topP?.toString()}
                className="w-full"
              />
              <p className="mt-2 text-xs text-gray-500">
                <strong>Increase:</strong> More varied vocabulary and
                descriptions. <strong>Decrease:</strong> More consistent, common
                word choices.
              </p>
            </div>

            {/* Top K */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>Top K</span>
                <span className="ml-2 text-xs text-gray-500">(1+)</span>
                <div className="relative group" data-info-tooltip="topK">
                  <Info 
                    className="h-4 w-4 text-gray-400 cursor-help touch-manipulation" 
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenTooltip(openTooltip === 'topK' ? null : 'topK');
                    }}
                  />
                  <div className={`absolute left-full top-0 ml-2 w-80 max-h-48 overflow-y-auto p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl transition-all duration-200 z-[9999] pointer-events-none ${
                    openTooltip === 'topK' ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'
                  }`}>
                    <p className="font-semibold mb-2">
                      Top K limits word choice options
                    </p>
                    <p className="mb-2">
                      <strong>Increase (50-100):</strong> The AI can choose from
                      more possible words at each step. When asking about
                      materials, it might suggest less common options like
                      "palladium," "titanium," or "tungsten" alongside standard
                      choices.
                    </p>
                    <p>
                      <strong>Decrease (10-20):</strong> The AI will only use
                      the most likely words. It will stick to standard jewelry
                      terms like "gold," "silver," "platinum" and rarely suggest
                      unusual materials or styles.
                    </p>
                    <p className="mt-2 text-gray-300">
                      Default: 40 (moderate variety)
                    </p>
                  </div>
                </div>
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={parameters.topK ?? DEFAULT_PARAMETERS.topK}
                onChange={(e) => updateParameter("topK", e.target.value)}
                placeholder={DEFAULT_PARAMETERS.topK?.toString()}
                className="w-full"
              />
              <p className="mt-2 text-xs text-gray-500">
                <strong>Increase:</strong> More word options available
                (including less common terms). <strong>Decrease:</strong> Only
                the most likely words used.
              </p>
            </div>

            {/* Max Output Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>Max Output Tokens</span>
                <span className="ml-2 text-xs text-gray-500">(1 - 8192)</span>
                <div className="relative group" data-info-tooltip="maxOutputTokens">
                  <Info 
                    className="h-4 w-4 text-gray-400 cursor-help touch-manipulation" 
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenTooltip(openTooltip === 'maxOutputTokens' ? null : 'maxOutputTokens');
                    }}
                  />
                  <div className={`absolute left-full top-0 ml-2 -translate-y-1/2 w-80 max-h-64 overflow-y-auto p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl transition-all duration-200 z-[9999] pointer-events-none ${
                    openTooltip === 'maxOutputTokens' ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'
                  }`}>
                    <p className="font-semibold mb-2">
                      Max Output Tokens controls response length
                    </p>
                    <p className="mb-2">
                      <strong>Increase (4000-8192):</strong> The AI can provide
                      very detailed responses with extensive explanations,
                      multiple design options, and comprehensive suggestions. It
                      can describe a jewelry piece in great detail with all
                      features, materials, and style notes.
                    </p>
                    <p>
                      <strong>Decrease (1000-2000):</strong> The AI will keep
                      responses concise and focused. It will provide shorter
                      answers with just the essential information, like "gold
                      ring with diamond" without extensive elaboration.
                    </p>
                    <p className="mt-2 text-gray-300">
                      Default: 8192 (maximum length allowed)
                    </p>
                    <p className="mt-1 text-gray-400 text-xs">
                      Note: ~1 token ≈ 4 characters or 0.75 words
                    </p>
                  </div>
                </div>
              </label>
              <Input
                type="number"
                min="1"
                max="8192"
                step="1"
                value={
                  parameters.maxOutputTokens ??
                  DEFAULT_PARAMETERS.maxOutputTokens
                }
                onChange={(e) =>
                  updateParameter("maxOutputTokens", e.target.value)
                }
                placeholder={DEFAULT_PARAMETERS.maxOutputTokens?.toString()}
                className="w-full"
              />
              <p className="mt-2 text-xs text-gray-500">
                <strong>Increase:</strong> Allows longer, more detailed
                responses. <strong>Decrease:</strong> Forces shorter, more
                concise answers.
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
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
