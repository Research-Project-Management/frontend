# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Domain & Delivery Model

- **Domain Category**: B2B & Academic Research Management SaaS (Software-as-a-Service).
- **Delivery Model**: Multi-tenant cloud-native SaaS with workspace isolation, role-based access control (RBAC), real-time collaboration, and AI-assisted workflows.

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
- **Project Name:** Flux — Research Management Platform.
- **Design Direction:** Flat Precision SaaS (Academic Workbench) — built upon a strict 4-color foundation (Black, White, Zinc Gray, SaaS Blue), Geist Sans & Geist Mono typography with OpenType precision (`cv02-cv11`, `tnum`), 13px dense tables, negative tracking (`-0.011em`), and a 6-layer platform model adhering to international SaaS benchmarks (Linear, Vercel, Midday, Supabase).
