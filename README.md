# 🚀 Flux — Research Project Management (SaaS Platform)

A cloud-native, multi-tenant B2B/Academic SaaS platform with AI integration, engineered for research teams to collaborate seamlessly, manage literature, draft manuscripts, and track research projects from start to finish.

## ✨ Key Features

### 🏢 Workspace Management

- Create and manage multiple workspaces for different research teams
- Detailed permissions and roles for each member
- Customizable workspace settings

### 📊 Project Management

- Create and track multiple research projects
- Organize work by project
- Sticky notes for quick ideas and notes
- Intuitive task management with drag & drop

### 📝 Document Management

- Create and edit documents with rich text editor (TipTap)
- Integrated code editor (Monaco Editor) supporting multiple languages
- Direct PDF preview
- Storage system for file storage and sharing

### 🤖 AI Chat Assistant

- AI assistant for research support
- Wiki chat with context from project documents
- AI integration for writing and analysis assistance

### 👥 Team Management

- Invite and manage members
- Role-based permissions (Owner, Admin, Member, Viewer)
- Track member activities

### ✅ Work Management

- Task board with drag & drop
- Task assignment and progress tracking
- Personal work list (Your Works)

## 🛠️ Tech Stack

### Frontend

- **Next.js 16** - App Router with Turbopack
- **React 19** - Latest React with React Server Components support
- **TypeScript** - Strict type safety
- **TailwindCSS 4** - Modern utility-first CSS framework with CSS-first `@theme` configuration
- **Inter & IBM Plex Mono** - Precision typography standard via `next/font/google` (zero-CLS, subsets: latin, vietnamese), 13-step scale (9px–40px), 450 body weight, 1.54 line-height, and strict 600 SemiBold UI cap

### UI & Design System

- **Flat Precision SaaS Architecture** - 4-color foundation (Black, White, Zinc Gray, SaaS Blue)
- **Strict 100% SaaS Font Weight Cap** - SemiBold (600) for headings/KPIs, Medium (500) for badges/tags/buttons, Regular (450) for body/data tables. No font-bold in UI.
- **Radix UI** - Accessible headless component primitives
- **Lucide React** - High-precision icon library with optical centering
- **shadcn/ui** - Semantic token-based component system
- **6-Layer Platform Model** - Header Chrome, Sidebar, Action Toolbar, Data Workspaces, Overlays, 5 Interactive States

### State & Data Management

- **TanStack Query v5** - Server state management & caching
- **Zustand** - Lightweight client state management

### Rich Text & Code Editing

- **TipTap** - Rich text editor with task lists & math support
- **Monaco Editor** - VS Code editor in browser with LaTeX support

### Additional Features

- **@dnd-kit** - Drag and drop functionality
- **date-fns** - Date utilities
- **react-pdf** - PDF rendering
- **emoji-picker-react** - Emoji support
- **sonner** - Toast notifications with undo action

## 🚀 Getting Started

### System Requirements

- Node.js 18+ or Bun
- pnpm or npm

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd research-management/frontend
```

Install dependencies:

```bash
pnpm install
# or
npm install
```

### Development

Start the development server (runs at `http://localhost:2915`):

```bash
pnpm dev
# or
npm run dev
```

The application will be available at `http://localhost:2915`

### Production Build

Create a production build:

```bash
pnpm build
# or
npm run build
```

Run the production build:

```bash
pnpm start
# or
npm run start
```

Server will run at `http://localhost:2915`

### Type Checking

Check TypeScript types:

```bash
pnpm typecheck
# or
npm run typecheck
```

## 📦 Deployment

### Docker Deployment

Build Docker image:

```bash
docker build -t flux-app .
```

Run container:

```bash
docker run -p 2916:2916 flux-app
```

### Cloud Platforms

The project can be deployed to:

- AWS ECS / Elastic Beanstalk
- Google Cloud Run
- Azure Container Apps
- Vercel
- Railway
- Fly.io
- Digital Ocean App Platform

### Manual Deployment

Deploy the output of `npm run build`:

```
├── package.json
├── pnpm-lock.yaml
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code (if SSR enabled)
```

## 📁 Project Structure

```
RPM/
├── app/
│   ├── components/       # React components
│   │   ├── auth/        # Authentication components
│   │   ├── workspace/   # Workspace features
│   │   ├── shared/      # Shared components
│   │   └── ui/          # UI primitives
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilities
│   ├── query/           # TanStack Query hooks
│   ├── routes/          # Page routes
│   ├── stores/          # Zustand stores
│   └── types/           # TypeScript types
├── public/              # Static assets
└── ...config files
```

## 🤝 Contributing

All contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License.

---

Built with ❤️ by TDTU Research Project Team
