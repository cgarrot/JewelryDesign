# Jewelry Design Studio

An AI-powered jewelry design application that lets you create stunning jewelry pieces through natural conversation and AI-generated images.

## Features

- **Conversational Design**: Chat with AI to describe your jewelry vision with structured multiple-choice questions
- **AI Image Generation**: Powered by Google's Gemini 2.5 Flash Image model
- **Multi-View Generation**: Generate 4 views (Front, Side, Top, Bottom) of your jewelry piece
- **Materials Library**: Manage global and project-specific materials with preview images
- **Reference Images**: Upload reference sketches or drawings to guide image generation
- **Project Management**: Save and manage multiple jewelry design projects
- **Custom System Prompts**: Customize AI behavior per project
- **Image Configuration**: Choose image format (PNG, JPEG, WEBP) and aspect ratio (Square, Horizontal, Vertical)
- **Usage Tracking**: Track API usage, tokens, and costs per project
- **Export & Download**: Download generated images and export project data
- **Keyboard Shortcuts**: Fast navigation and actions (Ctrl/Cmd + G to generate, Ctrl/Cmd + E to export)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: MinIO for object storage (images)
- **AI Model**: Google Gemini 2.5 Flash & Gemini 2.5 Flash Image
- **Icons**: Lucide React
- **Deployment**: Docker Compose for local development

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for database and storage)
- A Google Gemini API key ([Get one here](https://ai.google.dev/))

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory (see `env.example` for reference):
```env
DATABASE_URL="postgresql://jewelry_user:jewelry_pass@localhost:5432/jewelry_db"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_USE_SSL="false"
MINIO_BUCKET="jewelry-images"
GEMINI_API_KEY="your-gemini-api-key-here"
```

4. Start Docker services (PostgreSQL and MinIO):
```bash
npm run docker:up
# Or use: docker-compose up -d
```

5. Run database migrations:
```bash
npm run db:migrate
# Or use: npx prisma migrate dev
```

6. (Optional) Seed materials library:
```bash
npm run seed-materials
```

7. Start the development server:
```bash
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

**Note**: MinIO Console is available at [http://localhost:9001](http://localhost:9001) (default credentials: minioadmin/minioadmin)

## Usage

### Creating a Project

1. Click "New Project" on the home page
2. Enter a project name (e.g., "Wedding Ring Design")
3. Choose image format (PNG, JPEG, WEBP) and aspect ratio (Square, Horizontal, Vertical)

### Designing Jewelry

1. Open a project to access the design workspace
2. Use the chat on the left to describe your jewelry piece:
   - Type of jewelry (ring, necklace, bracelet, earrings, etc.)
   - Materials (gold, silver, platinum, etc.) - use autocomplete to select from materials library
   - Gemstones and style preferences
   - The AI will ask structured questions with multiple-choice options
3. (Optional) Upload reference images to guide the design
4. Click "Generate Image" or press Ctrl/Cmd + G to create an AI-generated visualization
5. Generate multiple views (Front, Side, Top, Bottom) for a complete perspective
6. Continue refining through conversation and regenerate as needed

### Managing Materials

- **Materials Library**: Access from the home page or within a project
- **Global Materials**: Available to all projects (e.g., "Gold", "Silver", "Diamond")
- **Project Materials**: Specific to a single project
- **Material Previews**: Generate AI preview images for materials
- **Create/Edit**: Add custom materials with descriptions and preview images

### Managing Projects

- **View Projects**: All projects are listed on the home page with message and image counts
- **Delete Project**: Click the trash icon on any project card
- **Export Project**: Click "Export" or press Ctrl/Cmd + E to download project data as JSON
- **Download Images**: Click the download icon next to generated images
- **Custom System Prompt**: Customize AI behavior per project
- **Usage Tracking**: View API usage, tokens, and costs per project

## Keyboard Shortcuts

- `Ctrl/Cmd + G`: Generate image from current conversation
- `Ctrl/Cmd + E`: Export project data
- `Enter`: Send message in chat
- `Shift + Enter`: New line in chat

## Project Structure

```
/app
  /api
    /chat/route.ts                    # Chat endpoint with Gemini
    /generate-image/route.ts          # Image generation endpoint
    /generate-views/route.ts          # Multi-view generation (4 views)
    /materials/route.ts               # Materials CRUD operations
    /materials/generate-preview/route.ts # Material preview generation
    /materials/generate-all-previews/route.ts # Bulk preview generation
    /materials/seed/route.ts          # Material seeding
    /projects/route.ts                # Project CRUD operations
    /projects/[id]/route.ts           # Single project operations
    /projects/[id]/export/route.ts    # Project export
    /projects/[id]/system-prompt/route.ts # Custom system prompt
    /projects/[id]/reference-images/route.ts # Reference image management
    /images/[...path]/route.ts        # Image serving from MinIO
  /materials/page.tsx                 # Materials library page
  /projects/[id]/page.tsx             # Project workspace
  /page.tsx                           # Home page with project list
/components
  /chat                               # Chat UI components
  /canvas                             # Image canvas components
  /materials                          # Materials management components
  /projects                           # Project management components
  /ui                                 # Base UI components
/lib
  /gemini.ts                          # Gemini API client
  /db.ts                              # Prisma database client
  /minio.ts                           # MinIO storage client
  /pricing.ts                         # Cost calculation utilities
  /utils.ts                           # Utility functions
  /types.ts                           # TypeScript type definitions
/prisma
  /schema.prisma                      # Database schema
/scripts
  /seed-materials.ts                  # Material seeding script
```

## Database Schema

The app uses five main models:

- **Project**: Stores project metadata, image format/aspect ratio preferences, usage tracking, and custom system prompts
- **Message**: Stores chat messages with optional JSON metadata (linked to projects)
- **GeneratedImage**: Stores AI-generated images with MinIO object keys, view types (FRONT, SIDE, TOP, BOTTOM), and view set grouping
- **ReferenceImage**: Stores uploaded reference sketches/drawings (linked to projects)
- **Material**: Stores materials library entries (global or project-specific) with preview images

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `DELETE /api/projects?id={id}` - Delete project
- `GET /api/projects/[id]` - Get project with messages and images
- `PATCH /api/projects/[id]` - Update project
- `GET /api/projects/[id]/export` - Export project data
- `GET /api/projects/[id]/system-prompt` - Get custom system prompt
- `PATCH /api/projects/[id]/system-prompt` - Update system prompt

### Chat & Image Generation
- `POST /api/chat` - Send chat message and get AI response
- `POST /api/generate-image` - Generate jewelry image from conversation
- `POST /api/generate-views` - Generate 4 views (Front, Side, Top, Bottom)

### Materials
- `GET /api/materials?projectId={id}` - List materials (global + project-specific)
- `POST /api/materials` - Create material
- `PATCH /api/materials` - Update material
- `DELETE /api/materials?id={id}` - Delete material
- `POST /api/materials/generate-preview` - Generate preview image for material
- `POST /api/materials/generate-all-previews` - Generate previews for all materials
- `POST /api/materials/seed` - Seed materials library

### Reference Images
- `GET /api/projects/[id]/reference-images` - List reference images
- `POST /api/projects/[id]/reference-images` - Upload reference image
- `DELETE /api/projects/[id]/reference-images/[imageId]` - Delete reference image

### Images
- `GET /api/images/[...path]` - Serve images from MinIO storage

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run docker:up` - Start Docker services (PostgreSQL, MinIO)
- `npm run docker:down` - Stop Docker services
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database (⚠️ deletes all data)
- `npm run db:studio` - Open Prisma Studio
- `npm run seed-materials` - Seed materials library

## Notes

- Images are stored in MinIO object storage (not in the database)
- The app uses PostgreSQL (not SQLite) for better scalability
- Docker Compose is required for local development (PostgreSQL + MinIO)
- The app is designed for single-user use (no authentication required)
- Gemini API rate limits may apply based on your API key tier
- Cost tracking is approximate based on Gemini API pricing
- MinIO console available at http://localhost:9001 for file management

## License

MIT

## Credits

Built with Next.js, Prisma, PostgreSQL, MinIO, and Google Gemini AI.
