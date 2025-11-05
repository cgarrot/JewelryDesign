"use client";

import { Material } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Globe, Save, Sparkles, X } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";

interface ImageToMaterialModalProps {
  projectId?: string | null;
  onClose: () => void;
  onSave: (material: Material) => void;
}

const CATEGORIES = [
  "Material",
  "Type",
  "Style",
  "Shape",
  "Gemstone",
  "Technique",
  "Pattern",
  "Finish",
  "Other",
];

export function ImageToMaterialModal({
  projectId,
  onClose,
  onSave,
}: ImageToMaterialModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // base64 string
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Material");
  const [prompt, setPrompt] = useState("");
  const [isGlobal, setIsGlobal] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toastError("Please select a valid image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toastError("Image file size must be less than 10MB");
      return;
    }

    setImageFile(file);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
    };
    reader.onerror = () => {
      toastError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if modal is open and user hasn't already selected an image
      if (!selectedImage && e.clipboardData) {
        const items = Array.from(e.clipboardData.items);

        // Find image in clipboard
        const imageItem = items.find((item) => item.type.startsWith("image/"));

        if (imageItem) {
          e.preventDefault();

          // Get the image file from clipboard
          const file = imageItem.getAsFile();
          if (file) {
            handleFileSelect(file);
            toastSuccess("Image pasted from clipboard");
          }
        }
      }
    };

    // Add paste event listener to window
    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [selectedImage, handleFileSelect]);

  const handleClose = () => {
    // Reset all state when closing
    setSelectedImage(null);
    setImageFile(null);
    setName("");
    setCategory("Material");
    setPrompt("");
    setIsGlobal(true);
    setHasAnalyzed(false);
    if (promptRef.current) {
      promptRef.current.innerHTML = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) {
      toastError("Please select an image first");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/materials/create-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: selectedImage,
          category: category !== "Material" ? category : undefined, // Only send if user changed from default
          name: name || undefined, // Only send if user provided
          preview: true, // Get suggestions without creating material
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze image");
      }

      const data = await response.json();
      const suggestions = data.suggestions;

      // Update form with AI-generated values
      if (!name) {
        setName(suggestions.name);
      }
      if (category === "Material") {
        setCategory(suggestions.category);
      }

      // Update contenteditable with prompt first
      if (promptRef.current) {
        promptRef.current.innerHTML = suggestions.prompt;
      }
      // Then update state to match
      setPrompt(suggestions.prompt);
      setHasAnalyzed(true);

      toastSuccess(
        "Image analyzed successfully! Review and edit the details before saving."
      );

      // Focus on name input for editing
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to analyze image"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedImage) {
      toastError("Please select an image first");
      return;
    }

    // Read the current prompt from the contentEditable element
    const currentPrompt = promptRef.current?.innerHTML || prompt || "";

    if (!name.trim() || !currentPrompt.trim()) {
      toastError("Name and prompt are required");
      return;
    }

    if (!hasAnalyzed) {
      toastError("Please analyze the image first");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/materials/create-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: selectedImage,
          category,
          name: name.trim(),
          prompt: currentPrompt.trim(),
          isGlobal,
          projectId: isGlobal ? undefined : projectId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create material");
      }

      const data = await response.json();
      toastSuccess("Material created successfully");
      onSave(data.material);
      handleClose();
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to create material"
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePromptChange = () => {
    if (promptRef.current) {
      setPrompt(promptRef.current.innerHTML);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    setHasAnalyzed(false);
    setName("");
    setCategory("Material");
    setPrompt("");
    if (promptRef.current) {
      promptRef.current.innerHTML = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <SidePanel
      isOpen={true}
      onClose={handleClose}
      title="Create Material from Image"
      width="640px"
    >
      <div className="flex flex-col h-full">
        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">
            {/* Image Upload Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Upload Image <span className="text-red-500">*</span>
              </label>

              {!selectedImage ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Drop an image here, click to browse, or paste (Ctrl+V /
                    Cmd+V)
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPEG, or WEBP (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                    <img
                      src={selectedImage}
                      alt="Selected image"
                      className="w-full h-64 object-contain"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Button
                    onClick={handleAnalyzeImage}
                    disabled={isAnalyzing}
                    className="w-full mt-3"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Analyzing Image...
                      </>
                    ) : (
                      <>
                        <Sparkles
                          className="h-4 w-4 mr-2"
                          style={{ stroke: "url(#sparklesGradient)" }}
                        />
                        Analyze Image
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Only show form fields after analysis */}
            {hasAnalyzed && (
              <>
                {/* Divider */}
                <div className="border-t border-gray-200" />

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
                      placeholder="e.g., Rose Gold with Diamond Accents"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      AI-suggested name (you can edit it)
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
                      AI-suggested category (you can change it)
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Prompt Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Prompt / Description <span className="text-red-500">*</span>
                  </label>

                  <div className="flex items-center gap-1 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand("bold", false);
                        promptRef.current?.focus();
                      }}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title="Bold"
                    >
                      <strong className="text-gray-600 text-sm">B</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand("italic", false);
                        promptRef.current?.focus();
                      }}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title="Italic"
                    >
                      <em className="text-gray-600 text-sm">I</em>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.execCommand("insertUnorderedList", false);
                        promptRef.current?.focus();
                      }}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title="Bullet List"
                    >
                      <span className="text-gray-600 text-sm">• List</span>
                    </button>
                  </div>

                  <div
                    ref={promptRef}
                    contentEditable
                    onInput={handlePromptChange}
                    className="w-full min-h-[180px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 text-sm leading-relaxed"
                    style={{ whiteSpace: "pre-wrap" }}
                    data-placeholder="AI-generated prompt will appear here..."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    AI-generated description (you can edit it)
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
                          When enabled, this material will be available in all
                          projects. Otherwise, it will only be available in the
                          current project.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <Button onClick={handleClose} variant="outline" size="sm">
            Cancel
          </Button>
          {hasAnalyzed && (
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
                  Create Material
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
