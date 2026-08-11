# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Students, lecturers, PhD candidates, researchers, and scientific research teams. They need an environment to collaborate, organize literature, and manage research projects from start to finish.

## Product Purpose
To provide an "All-in-one" platform that comprehensively serves the scientific research project management process. Success is defined by a research team's ability to execute every phase—from planning and literature storage to drafting manuscripts/code and tracking progress—within a single unified workspace rather than fragmenting across multiple tools.

## Positioning
A seamless integration of task management (Project Management), resource/literature management (Library/Storage), and specialized editors (Rich Text, Code/LaTeX) meticulously tuned for the unique demands of scientific research.

## Operating Context
Primarily used in academic contexts, university environments, and R&D labs. Users frequently interact with PDFs, manuscripts, charts, source code, and scientific citations, demanding robust capabilities for real-time collaboration and concurrent editing with peers.

## Capabilities and Constraints
- **Stack:** Next.js 16 (React 19), Tailwind CSS 4, Radix UI (Frontend) combined with Express.js, MongoDB, Redis, and Socket.io (Backend).
- **Architectural Constraints:** Strict adherence to a Feature-based architecture (inspired by Midday.ai). The `app/` layer remains ultra-thin (routing only), while complex logic and UI are neatly encapsulated within `features/[name]/` directories.
- **Data Flow:** The frontend leverages Zustand and React Query; form handling relies on React Hook Form + Zod.

## Brand Commitments
- **Project Name:** Research Management (rpm / Flux).
- **Design Direction:** Adheres to a design system and UI/UX feel akin to Midday.ai—focusing on minimalism, clarity, professional typography, and strong visual hierarchy to reduce cognitive load during complex research tasks.
