# 🚀 RPM - Research Project Management

A comprehensive research project management platform with AI integration, helping research teams organize work, manage documents, and collaborate effectively.

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

- **React 19** - Latest React with React Compiler
- **React Router 7** - Routing and SSR
- **TypeScript** - Type safety
- **Vite 7** - Lightning-fast build tool
- **TailwindCSS 4** - Styling framework

### UI Components

- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **shadcn/ui** - Component system

### State & Data Management

- **TanStack Query v5** - Server state management
- **Zustand** - Client state management

### Rich Text & Code Editing

- **TipTap** - Rich text editor with task lists
- **Monaco Editor** - VS Code editor in browser

### Authentication

- **@react-oauth/google** - Google OAuth integration

### Additional Features

- **@dnd-kit** - Drag and drop functionality
- **date-fns** - Date utilities
- **react-pdf** - PDF rendering
- **emoji-picker-react** - Emoji support
- **sonner** - Toast notifications

## 🚀 Getting Started

### System Requirements

- Node.js 18+ or Bun
- pnpm (recommended) or npm

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd Flux
```

Install dependencies:

```bash
pnpm install
# or
npm install
```

### Development

Start the development server:

```bash
pnpm dev
# or
npm run dev
```

The application will be available at `http://localhost:5173`

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
npm start
```

Server will run at `http://localhost:2916`

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
