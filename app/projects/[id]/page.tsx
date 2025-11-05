"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Sparkles,
  FileDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ImageCanvas } from "@/components/canvas/ImageCanvas";
import { MultiViewCanvas } from "@/components/canvas/MultiViewCanvas";
import { Project, GeneratedImage, ReferenceImage } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";
import { PriceDisplay } from "@/components/ui/PriceDisplay";

// Lazy load heavy components
const DrawingCanvas = dynamic(
  () =>
    import("@/components/canvas/DrawingCanvas").then((mod) => ({
      default: mod.DrawingCanvas,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Sparkles
            className="h-8 w-8 mx-auto mb-2 animate-pulse"
            style={{ stroke: "url(#sparklesGradient)" }}
          />
          <p className="text-gray-600">Loading drawing canvas...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

const ReferenceImageManager = dynamic(
  () =>
    import("@/components/canvas/ReferenceImageManager").then((mod) => ({
      default: mod.ReferenceImageManager,
    })),
  {
    loading: () => (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"images" | "views" | "drawing">(
    "images"
  );
  const [selectedReferenceImageIds, setSelectedReferenceImageIds] = useState<
    string[]
  >([]);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const [chatWidth, setChatWidth] = useState(400); // Default width in pixels
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProject = async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch project");
      }
      const data = await response.json();
      setProject(data.project);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to fetch project"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectName = async () => {
    if (!project || !editedName.trim()) {
      setIsEditingName(false);
      setEditedName("");
      return;
    }

    if (editedName.trim() === project.name) {
      setIsEditingName(false);
      setEditedName("");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update project name");
      }

      await fetchProject();
      setIsEditingName(false);
      setEditedName("");
      toastSuccess("Project name updated successfully");
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to update project name"
      );
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const handleStartEditName = () => {
    if (project) {
      setEditedName(project.name);
      setIsEditingName(true);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!project) return;

    setChatLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }
      const data = await response.json();

      // Refresh project to get updated messages
      await fetchProject();

      // Automatically trigger image generation if auto-regenerate is enabled or LLM indicates it should
      if (autoRegenerate || data.shouldGenerateImage) {
        // Ensure we have the latest project state before generating
        await fetchProject();
        await handleGenerateImage();
      }
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!project || !project.messages) return;

    setImageLoading(true);
    try {
      // Create a prompt from the recent conversation
      // Note: The API will automatically extract design specs from JSON messages if available
      // This text prompt serves as a fallback or additional context
      const recentMessages = project.messages.slice(-5);
      const prompt = recentMessages.map((msg) => msg.content).join(" ");

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt,
          referenceImageIds:
            selectedReferenceImageIds.length > 0
              ? selectedReferenceImageIds
              : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate image");
      }
      await response.json();

      // Refresh project to get updated images
      await fetchProject();
      toastSuccess("Image generated successfully");
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to generate image"
      );
    } finally {
      setImageLoading(false);
    }
  };

  const handleExportProject = async () => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/export`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to export project");
      }
      const data = await response.json();

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project-${project.name.replace(
        /[^a-z0-9]/gi,
        "-"
      )}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toastSuccess("Project exported successfully");
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to export project"
      );
    }
  };

  const handleSaveReferenceImage = async (imageData: string) => {
    if (!project) return;

    try {
      const response = await fetch(
        `/api/projects/${project.id}/reference-images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceImage: imageData }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save reference image");
      }
      await response.json();
      // Refresh project to get updated reference image
      await fetchProject();
      toastSuccess("Reference image saved successfully");
    } catch (error) {
      toastError(
        error instanceof Error
          ? error.message
          : "Failed to save reference image"
      );
    }
  };

  const handleSaveAnnotatedImage = async (
    annotatedImageData: string,
    annotations: string,
    colorDescriptions?: Record<string, string>
  ) => {
    if (!project) return;

    try {
      // Save the annotated image as a new reference image
      const refResponse = await fetch(
        `/api/projects/${project.id}/reference-images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceImage: annotatedImageData,
            colorDescriptions: colorDescriptions,
          }),
        }
      );
      if (!refResponse.ok) {
        const data = await refResponse.json();
        throw new Error(data.error || "Failed to save annotated image");
      }
      await refResponse.json();

      // Send a message to the chat with the annotations
      const message = `I've annotated the generated image with the following modifications: ${annotations}. Please generate a new version incorporating these changes.`;

      setChatLoading(true);
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message }),
      });
      if (!chatResponse.ok) {
        const data = await chatResponse.json();
        throw new Error(data.error || "Failed to send message");
      }
      await chatResponse.json();

      // Refresh project
      await fetchProject();

      // Automatically trigger image generation
      setImageLoading(true);
      const imageResponse = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt: `Based on the annotated image and these modifications: ${annotations}`,
        }),
      });
      if (!imageResponse.ok) {
        const data = await imageResponse.json();
        throw new Error(data.error || "Failed to generate image");
      }
      await imageResponse.json();

      // Final refresh
      await fetchProject();
      toastSuccess("Image regenerated with annotations");
    } catch (error) {
      toastError(
        error instanceof Error
          ? error.message
          : "Failed to process annotated image"
      );
    } finally {
      setChatLoading(false);
      setImageLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + G to generate image
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        if (
          !imageLoading &&
          !chatLoading &&
          project &&
          project.messages &&
          project.messages.length > 0
        ) {
          handleGenerateImage();
        }
      }
      // Ctrl/Cmd + E to export
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        handleExportProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, imageLoading, chatLoading]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Sparkles
            className="h-12 w-12 mx-auto mb-4 animate-pulse"
            style={{ stroke: "url(#sparklesGradient)" }}
          />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Project not found</p>
          <Button onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-5 w-5"
              style={{ stroke: "url(#sparklesGradient)" }}
            />
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUpdateProjectName();
                    } else if (e.key === "Escape") {
                      handleCancelEditName();
                    }
                  }}
                  className="text-lg font-semibold h-8 px-2 py-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUpdateProjectName}
                  className="h-8 w-8 p-0"
                  title="Save"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEditName}
                  className="h-8 w-8 p-0"
                  title="Cancel"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-gray-700 flex items-center gap-2 group"
                onClick={handleStartEditName}
                title="Click to edit project name"
              >
                <span>{project.name}</span>
                <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
            {project.imageFormat && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                {project.imageFormat}
              </span>
            )}
            {project.imageAspectRatio && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                {project.imageAspectRatio === "SQUARE" && "□"}
                {project.imageAspectRatio === "HORIZONTAL" && "▭"}
                {project.imageAspectRatio === "VERTICAL" && "▯"}{" "}
                {project.imageAspectRatio}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <PriceDisplay
              totalCost={project.totalCost || 0}
              totalInputTokens={project.totalInputTokens || 0}
              totalOutputTokens={project.totalOutputTokens || 0}
              totalImagesGenerated={project.totalImagesGenerated || 0}
              compact={false}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProject}
            className="flex items-center gap-2"
            title="Export project (Ctrl/Cmd + E)"
          >
            <FileDown className="h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Sidebar */}
        {chatCollapsed ? (
          <div className="w-12 border-r border-gray-200 bg-white flex flex-col items-center py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatCollapsed(false)}
              className="flex flex-col items-center gap-1 h-auto p-2"
              title="Expand chat"
            >
              <ChevronRight className="h-5 w-5" />
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="flex flex-col relative"
            style={{
              width: `${chatWidth}px`,
              minWidth: "300px",
              maxWidth: "60%",
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatCollapsed(true)}
              className="absolute top-2 right-2 z-10 h-8 w-8 p-0"
              title="Collapse chat"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <ChatSidebar
              messages={project.messages || []}
              onSendMessage={handleSendMessage}
              loading={chatLoading}
              projectId={project.id}
              onAutoRegenerateChange={setAutoRegenerate}
            />
            {/* Resize handle */}
            <div
              className="absolute top-0 bottom-0 right-0 hover:bg-gray-300 cursor-ew-resize z-20 transition-colors touch-none"
              style={{ width: "8px", marginRight: "-4px" }}
              title="Drag to resize chat"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = chatWidth;

                const handleMove = (moveEvent: MouseEvent) => {
                  const diff = moveEvent.clientX - startX;
                  const newWidth = Math.max(
                    300,
                    Math.min(window.innerWidth * 0.6, startWidth + diff)
                  );
                  setChatWidth(newWidth);
                };

                const handleUp = () => {
                  document.removeEventListener("mousemove", handleMove);
                  document.removeEventListener("mouseup", handleUp);
                  document.body.style.cursor = "";
                  document.body.style.userSelect = "";
                };

                document.body.style.cursor = "ew-resize";
                document.body.style.userSelect = "none";
                document.addEventListener("mousemove", handleMove);
                document.addEventListener("mouseup", handleUp);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const startX = touch.clientX;
                const startWidth = chatWidth;

                const handleMove = (moveEvent: TouchEvent) => {
                  moveEvent.preventDefault();
                  const touch = moveEvent.touches[0];
                  if (!touch) return;
                  const diff = touch.clientX - startX;
                  const newWidth = Math.max(
                    300,
                    Math.min(window.innerWidth * 0.6, startWidth + diff)
                  );
                  setChatWidth(newWidth);
                };

                const handleEnd = (e: TouchEvent) => {
                  e.preventDefault();
                  document.removeEventListener("touchmove", handleMove);
                  document.removeEventListener("touchend", handleEnd);
                };

                document.addEventListener("touchmove", handleMove, {
                  passive: false,
                });
                document.addEventListener("touchend", handleEnd, {
                  passive: false,
                });
              }}
            />
          </div>
        )}

        {/* Image Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white px-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("images")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "images"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Generated Images
              </button>
              <button
                onClick={() => setActiveTab("views")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "views"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                4 Views
              </button>
              <button
                onClick={() => setActiveTab("drawing")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "drawing"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Reference Drawing
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "images" && (
              <ImageCanvas
                images={project.images || []}
                onGenerateImage={handleGenerateImage}
                onSaveAnnotatedImage={handleSaveAnnotatedImage}
                loading={imageLoading}
                disabled={
                  chatLoading ||
                  !project.messages ||
                  project.messages.length === 0
                }
              />
            )}
            {activeTab === "views" && (
              <MultiViewCanvas
                projectId={project.id}
                images={project.images || []}
                onViewsChange={fetchProject}
                loading={imageLoading}
                disabled={
                  chatLoading ||
                  !project.messages ||
                  project.messages.length === 0
                }
              />
            )}
            {activeTab === "drawing" && (
              <div className="h-full overflow-y-auto p-6 bg-gray-50 space-y-6">
                <ReferenceImageManager
                  projectId={project.id}
                  referenceImages={project.referenceImages || []}
                  selectedImageIds={selectedReferenceImageIds}
                  onImagesChange={fetchProject}
                  onSelectionChange={setSelectedReferenceImageIds}
                  onSaveDrawing={async (imageData) => {
                    // Upload drawn image as reference image
                    const response = await fetch(
                      `/api/projects/${project.id}/reference-images`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ referenceImage: imageData }),
                      }
                    );
                    if (response.ok) {
                      await fetchProject();
                    }
                  }}
                />
                <DrawingCanvas
                  onSave={async (imageData, colorDescriptions) => {
                    // Upload as new reference image with color descriptions
                    const response = await fetch(
                      `/api/projects/${project.id}/reference-images`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          referenceImage: imageData,
                          colorDescriptions: colorDescriptions || undefined,
                        }),
                      }
                    );
                    if (response.ok) {
                      await fetchProject();
                      toastSuccess("Drawing saved successfully");
                    } else {
                      const data = await response.json();
                      toastError(data.error || "Failed to save drawing");
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
