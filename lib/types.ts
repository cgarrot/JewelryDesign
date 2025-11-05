// Shared type definitions for the application

export type ImageFormat = 'PNG' | 'JPEG' | 'WEBP';
export type ImageAspectRatio = 'SQUARE' | 'HORIZONTAL' | 'VERTICAL';
export type ViewType = 'FRONT' | 'SIDE' | 'TOP' | 'BOTTOM';

export interface Project {
  id: string;
  name: string;
  imageFormat: ImageFormat;
  imageAspectRatio: ImageAspectRatio;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
  images?: GeneratedImage[];
  referenceImages?: ReferenceImage[];
  _count?: {
    messages: number;
    images: number;
  };
  // Usage tracking
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalImagesGenerated?: number;
  totalCost?: number;
  // Custom system prompt for chat
  customSystemPrompt?: string | null;
  // Last generated image URL for preview
  lastImageUrl?: string | null;
}

export interface Message {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  contentJson?: ChatResponseJson | null; // Structured JSON data for internal processing
  createdAt: Date;
}

export interface GeneratedImage {
  id: string;
  projectId: string;
  imageData: string; // MinIO object key or URL
  prompt: string;
  viewType?: ViewType | null; // Type of view (FRONT, SIDE, TOP, BOTTOM) or null for regular images
  viewSetId?: string | null; // UUID to group 4 views together
  createdAt: Date;
}

export interface ReferenceImage {
  id: string;
  projectId: string;
  imageData: string; // MinIO object key
  imageUrl?: string; // Presigned URL
  name?: string | null;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: string;
}

export interface ProjectResponse extends ApiResponse {
  project?: Project;
}

export interface ProjectsResponse extends ApiResponse {
  projects?: Project[];
}

export interface ImageResponse extends ApiResponse {
  imageId?: string;
  imageUrl?: string;
}

export interface ReferenceImageResponse extends ApiResponse {
  referenceImage?: ReferenceImage;
  referenceImages?: ReferenceImage[];
}

export interface ChatResponse extends ApiResponse {
  message?: string;
  shouldGenerateImage?: boolean;
}

export interface ViewsResponse extends ApiResponse {
  views?: Array<{
    id: string;
    viewType: ViewType;
    imageUrl: string;
  }>;
  viewSetId?: string;
}

export interface Material {
  id: string;
  name: string;
  prompt: string;
  category: string;
  imageData?: string | null;
  imageUrl?: string;
  isGlobal: boolean;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialsResponse extends ApiResponse {
  materials?: Material[];
}

export interface MaterialResponse extends ApiResponse {
  material?: Material;
}

// JSON-based response types for LLM interactions
export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  title: string;
  options: QuestionOption[];
}

export interface DesignSpecification {
  type?: string;
  materials?: string[];
  style?: string;
  features?: string[];
  gemstones?: string[];
  dimensions?: string;
  specialFeatures?: string[];
}

export interface ChatResponseMetadata {
  type: 'question' | 'suggestion' | 'confirmation' | 'info';
  questions?: Question[];
  designSpec?: DesignSpecification;
}

export interface ChatResponseJson {
  message: string; // The full markdown-formatted message (same as before for display)
  metadata: ChatResponseMetadata;
  shouldGenerateImage: boolean;
}

export interface ImageGenerationDecisionJson {
  shouldGenerate: boolean;
  reasoning?: string;
}

