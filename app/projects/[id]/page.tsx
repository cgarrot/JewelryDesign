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
import { Project, GeneratedImage, ReferenceImage, Message } from "@/lib/types";
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

/**
 * Safely parses JSON from a response, handling SSE format (data: {...}) and regular JSON
 */
async function parseResponseJson<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  let jsonText = text.trim();

  // Handle SSE format (data: {...})
  if (jsonText.startsWith("data: ")) {
    jsonText = jsonText.slice(6); // Remove "data: " prefix
  }

  // Handle multiple SSE lines (take the last complete JSON object)
  const lines = jsonText.split("\n\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i].trim();
    if (line.startsWith("data: ")) {
      line = line.slice(6);
    }
    if (line.startsWith("{") || line.startsWith("[")) {
      try {
        return JSON.parse(line) as T;
      } catch {
        // Try next line
        continue;
      }
    }
  }

  // Try parsing the whole text as JSON
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // Try to extract JSON object from text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error("Failed to parse JSON from response");
  }
}

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
  const [selectedGeneratedImageIds, setSelectedGeneratedImageIds] = useState<
    string[]
  >([]);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const [chatWidth, setChatWidth] = useState(400); // Default width in pixels
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<{
    id: string;
    role: "assistant";
    content: string;
  } | null>(null);

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

    // Optimistically add user message to local state immediately
    // This ensures the message appears instantly before the API call completes
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const optimisticUserMessage: Message = {
      id: tempUserMessageId,
      projectId: project.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    };

    // Update project state with optimistic message
    // This makes the message appear immediately in the UI
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticUserMessage],
      };
    });

    // Create a temporary streaming message ID
    const streamingMessageId = `streaming-${Date.now()}`;
    setStreamingMessage({
      id: streamingMessageId,
      role: "assistant",
      content: "",
    });
    setChatLoading(true);

    try {
      // Use EventSource for Server-Sent Events (SSE)
      // Note: EventSource only supports GET, so we'll use fetch with ReadableStream instead
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message,
          referenceImageIds:
            selectedReferenceImageIds.length > 0
              ? selectedReferenceImageIds
              : undefined,
          generatedImageIds:
            selectedGeneratedImageIds.length > 0
              ? selectedGeneratedImageIds
              : undefined,
        }),
      });

      if (!response.ok) {
        // If response is not ok, try to parse as JSON error
        try {
          const data = await response.json();
          throw new Error(data.error || "Failed to send message");
        } catch {
          throw new Error("Failed to send message");
        }
      }

      // Check if response is streaming (text/event-stream)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          throw new Error("No response body");
        }

        let shouldGenerateImage = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "chunk") {
                  // Update streaming message with new chunk
                  setStreamingMessage((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      content: prev.content + data.text,
                    };
                  });
                } else if (data.type === "done") {
                  // Streaming complete
                  shouldGenerateImage = data.shouldGenerateImage || false;
                  // Clear streaming message - it will be replaced by the saved message
                  setStreamingMessage(null);
                } else if (data.type === "error") {
                  throw new Error(data.error || "Streaming error");
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        // Refresh project to get updated messages (including the saved user and assistant messages)
        // This replaces the optimistic user message with the real one from the database
        await fetchProject();

        // Automatically trigger image generation if auto-regenerate is enabled or LLM indicates it should
        if (autoRegenerate || shouldGenerateImage) {
          await fetchProject();
          await handleGenerateImage();
        }
      } else {
        // Fallback to non-streaming response (backward compatibility)
        const data = await response.json();
        // Refresh project to get updated messages (including the saved user message)
        await fetchProject();

        if (autoRegenerate || data.shouldGenerateImage) {
          await fetchProject();
          await handleGenerateImage();
        }
      }
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to send message"
      );
      setStreamingMessage(null);

      // On error, refresh to get the actual state (user message might still have been saved)
      await fetchProject();
    } finally {
      setChatLoading(false);
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage({ id: message.id, content: message.content });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleEditSubmit = async (messageId: string, content: string) => {
    if (!project) return;

    setChatLoading(true);
    try {
      // Get all messages to find the one being edited and subsequent ones
      const messages = project.messages || [];
      const editIndex = messages.findIndex((m) => m.id === messageId);
      const messageToEdit = messages[editIndex];

      if (editIndex === -1 || !messageToEdit) {
        throw new Error("Message not found");
      }

      // Delete all messages after the edited one
      const messagesToDelete = messages.slice(editIndex + 1);
      for (const msg of messagesToDelete) {
        const deleteResponse = await fetch(`/api/messages/${msg.id}`, {
          method: "DELETE",
        });
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json();
          throw new Error(data.error || "Failed to delete message");
        }
      }

      // Update the edited message
      const updateResponse = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!updateResponse.ok) {
        const data = await updateResponse.json();
        throw new Error(data.error || "Failed to update message");
      }

      // Refresh project to get updated messages
      await fetchProject();

      // If the edited message is a user message, resend to get assistant response
      // Note: The chat API will create a duplicate user message, so we'll need to handle that
      if (messageToEdit.role === "user") {
        const resendResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            message: content,
            referenceImageIds:
              selectedReferenceImageIds.length > 0
                ? selectedReferenceImageIds
                : undefined,
            generatedImageIds:
              selectedGeneratedImageIds.length > 0
                ? selectedGeneratedImageIds
                : undefined,
          }),
        });
        if (!resendResponse.ok) {
          const data = await resendResponse.json();
          throw new Error(data.error || "Failed to resend message");
        }
        const resendData = await resendResponse.json();

        // Refresh to get the new messages (including the duplicate user message)
        await fetchProject();

        // Get the updated project to find and delete the duplicate user message
        const refreshResponse = await fetch(`/api/projects/${project.id}`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const updatedMessages = refreshData.project?.messages || [];

          // Find the duplicate: it should be the last user message with the same content
          // and created after our update
          const duplicateIndex = updatedMessages.findIndex(
            (m: Message, idx: number) => {
              return (
                idx > editIndex &&
                m.role === "user" &&
                m.content === content &&
                m.id !== messageId
              );
            }
          );

          if (duplicateIndex !== -1) {
            const duplicateId = updatedMessages[duplicateIndex].id;
            await fetch(`/api/messages/${duplicateId}`, {
              method: "DELETE",
            });
          }
        }

        // Final refresh to get clean message list
        await fetchProject();

        // Clear edit mode
        setEditingMessage(null);

        // Automatically trigger image generation if auto-regenerate is enabled or LLM indicates it should
        if (autoRegenerate || resendData.shouldGenerateImage) {
          await fetchProject();
          await handleGenerateImage();
        }

        toastSuccess("Message updated and conversation regenerated");
      } else {
        // If editing assistant message, just update and refresh
        await fetchProject();
        setEditingMessage(null);
        toastSuccess("Message updated successfully");
      }
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to edit message"
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!project) return;

    setChatLoading(true);
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete message");
      }

      // Refresh project to get updated messages
      await fetchProject();
      toastSuccess("Message deleted successfully");
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Failed to delete message"
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        toastSuccess("Message copied to clipboard");
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          toastSuccess("Message copied to clipboard");
        } catch (err) {
          toastError("Failed to copy message");
        }
        document.body.removeChild(textArea);
      }
    } catch (error) {
      toastError("Failed to copy message");
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
          generatedImageIds:
            selectedGeneratedImageIds.length > 0
              ? selectedGeneratedImageIds
              : undefined,
        }),
      });

      // Parse response (read body once)
      let responseData: any = null;
      try {
        responseData = await parseResponseJson(response);
      } catch (parseError) {
        // If parsing fails, check if it was an error response
        if (!response.ok) {
          throw new Error("Failed to generate image");
        }
        console.error("Error parsing generate-image response:", parseError);
        // If parsing fails but response was ok, continue anyway
        // The image might have been generated successfully
      }

      if (!response.ok) {
        throw new Error(
          (responseData as any)?.error || "Failed to generate image"
        );
      }

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
        const data = await parseResponseJson(refResponse);
        throw new Error(
          (data as any).error || "Failed to save annotated image"
        );
      }
      await parseResponseJson(refResponse);

      // Send a message to the chat with the annotations
      const message = `I've annotated the generated image with the following modifications: ${annotations}. Please generate a new version incorporating these changes.`;

      setChatLoading(true);
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message }),
      });

      // Check content type before reading body
      const contentType = chatResponse.headers.get("content-type");

      if (!chatResponse.ok) {
        // Handle error response - try to parse as JSON if not streaming
        if (!contentType?.includes("text/event-stream")) {
          try {
            const data = await parseResponseJson(chatResponse);
            throw new Error((data as any).error || "Failed to send message");
          } catch (error) {
            if (
              error instanceof Error &&
              error.message !== "Failed to parse JSON from response"
            ) {
              throw error;
            }
            throw new Error("Failed to send message");
          }
        } else {
          // For streaming errors, just consume and throw generic error
          const reader = chatResponse.body?.getReader();
          if (reader) {
            while (true) {
              const { done } = await reader.read();
              if (done) break;
            }
          }
          throw new Error("Failed to send message");
        }
      }

      // Chat API returns streaming response, but we don't need to parse it
      // Just consume the stream to prevent errors
      if (contentType?.includes("text/event-stream")) {
        // Consume the stream
        const reader = chatResponse.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } else {
        // Non-streaming response - parse it
        await parseResponseJson(chatResponse);
      }

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

      // Parse response (read body once)
      let responseData: any = null;
      try {
        responseData = await parseResponseJson(imageResponse);
      } catch (parseError) {
        // If parsing fails, check if it was an error response
        if (!imageResponse.ok) {
          throw new Error("Failed to generate image");
        }
        console.error("Error parsing generate-image response:", parseError);
        // If parsing fails but response was ok, continue anyway
        // The image might have been generated successfully
      }

      if (!imageResponse.ok) {
        throw new Error(
          (responseData as any)?.error || "Failed to generate image"
        );
      }

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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 px-2 sm:px-3 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <Sparkles
              className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
              style={{ stroke: "url(#sparklesGradient)" }}
            />
            {isEditingName ? (
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
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
                  className="text-sm sm:text-lg font-semibold h-8 px-2 py-1 min-w-0 flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUpdateProjectName}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                  title="Save"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEditName}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                  title="Cancel"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-sm sm:text-lg font-semibold text-gray-900 cursor-pointer hover:text-gray-700 flex items-center gap-1 sm:gap-2 group min-w-0"
                onClick={handleStartEditName}
                title="Click to edit project name"
              >
                <span className="truncate">{project.name}</span>
                <Pencil className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </h1>
            )}
            <div className="hidden sm:flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {project.imageFormat && (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md whitespace-nowrap">
                  {project.imageFormat}
                </span>
              )}
              {project.imageAspectRatio && (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md whitespace-nowrap">
                  {project.imageAspectRatio === "SQUARE" && "□"}
                  {project.imageAspectRatio === "HORIZONTAL" && "▭"}
                  {project.imageAspectRatio === "VERTICAL" && "▯"}{" "}
                  {project.imageAspectRatio}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
          <div className="hidden md:block bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <PriceDisplay
              totalCost={project.totalCost || 0}
              totalInputTokens={project.totalInputTokens || 0}
              totalOutputTokens={project.totalOutputTokens || 0}
              totalImagesGenerated={project.totalImagesGenerated || 0}
              compact={false}
            />
          </div>
          <div className="md:hidden bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <PriceDisplay
              totalCost={project.totalCost || 0}
              totalInputTokens={project.totalInputTokens || 0}
              totalOutputTokens={project.totalOutputTokens || 0}
              totalImagesGenerated={project.totalImagesGenerated || 0}
              compact={true}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProject}
            className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 px-2 sm:px-3"
            title="Export project (Ctrl/Cmd + E)"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          {/* Mobile chat toggle button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
            className="md:hidden h-9 w-9 p-0 flex-shrink-0"
            title={isMobileChatOpen ? "Close chat" : "Open chat"}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Chat Overlay */}
        {isMobileChatOpen && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsMobileChatOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 right-0 md:hidden z-50 flex flex-col bg-white">
              <div className="flex-1 overflow-hidden">
                <ChatSidebar
                  messages={project.messages || []}
                  onSendMessage={handleSendMessage}
                  loading={chatLoading}
                  projectId={project.id}
                  streamingMessage={streamingMessage}
                  onAutoRegenerateChange={setAutoRegenerate}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onCopyMessage={handleCopyMessage}
                  editingMessage={editingMessage}
                  onEditCancel={handleCancelEdit}
                  onEditSubmit={handleEditSubmit}
                  onClose={() => setIsMobileChatOpen(false)}
                  isMobile={true}
                  selectedReferenceImages={(
                    project.referenceImages || []
                  ).filter((img) => selectedReferenceImageIds.includes(img.id))}
                  onReferenceImageDeselect={(imageId) => {
                    setSelectedReferenceImageIds((prev) =>
                      prev.filter((id) => id !== imageId)
                    );
                  }}
                  selectedGeneratedImages={(project.images || []).filter(
                    (img) => selectedGeneratedImageIds.includes(img.id)
                  )}
                  onGeneratedImageDeselect={(imageId) => {
                    setSelectedGeneratedImageIds((prev) =>
                      prev.filter((id) => id !== imageId)
                    );
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Desktop Chat Sidebar */}
        {!chatCollapsed && (
          <div
            className="hidden md:flex flex-col relative"
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
              streamingMessage={streamingMessage}
              onAutoRegenerateChange={setAutoRegenerate}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onCopyMessage={handleCopyMessage}
              editingMessage={editingMessage}
              onEditCancel={handleCancelEdit}
              onEditSubmit={handleEditSubmit}
              selectedReferenceImages={(project.referenceImages || []).filter(
                (img) => selectedReferenceImageIds.includes(img.id)
              )}
              onReferenceImageDeselect={(imageId) => {
                setSelectedReferenceImageIds((prev) =>
                  prev.filter((id) => id !== imageId)
                );
              }}
              selectedGeneratedImages={(project.images || []).filter((img) =>
                selectedGeneratedImageIds.includes(img.id)
              )}
              onGeneratedImageDeselect={(imageId) => {
                setSelectedGeneratedImageIds((prev) =>
                  prev.filter((id) => id !== imageId)
                );
              }}
            />
            {/* Resize handle - hidden on mobile */}
            <div
              className="absolute top-0 bottom-0 right-0 hover:bg-gray-300 cursor-ew-resize z-20 transition-colors touch-none hidden md:block"
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
            />
          </div>
        )}

        {/* Collapsed Chat Button - Desktop only */}
        {chatCollapsed && (
          <div className="hidden md:flex w-12 border-r border-gray-200 bg-white flex-col items-center py-4">
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
        )}

        {/* Image Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white px-2 sm:px-4 overflow-x-auto">
            <div className="flex gap-1 sm:gap-2 min-w-max">
              <button
                onClick={() => setActiveTab("images")}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "images"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Generated Images
              </button>
              <button
                onClick={() => setActiveTab("views")}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "views"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                4 Views
              </button>
              <button
                onClick={() => setActiveTab("drawing")}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
                selectedImageIds={selectedGeneratedImageIds}
                onSelectionChange={setSelectedGeneratedImageIds}
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
