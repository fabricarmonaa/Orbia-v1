# ORBIA - SaaS Multi-Tenant para PyMEs

## Overview
ORBIA is a multi-tenant SaaS platform for SMBs (PyMEs). It provides order management, treasury/cash control, product catalogs, branch management, and public tracking links.

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT-based (separate flows: Super Admin vs Tenant Admin vs Public tracking)

## Access Flows
1. **Super Admin** (`/owner/login`): admin@orbia.app / admin123
2. **Tenant Admin** (`/login`): Code: demo, admin@demo.com / demo123
3. **Public Tracking** (`/tracking/:id`): No auth needed

## Key Modules
- **Orders**: CRUD + status management + comments + public tracking links + branch column display
- **Cash/Treasury**: Session open/close + income/expense movements
- **Products**: CRUD + categories + cost/stock tracking + edit modal + activate/deactivate toggle + CSV export
- **Branches**: Multi-branch support per tenant + branch detail panel with filtered orders/cash
- **Plans**: Feature flags + limits (ECONOMICO / PROFESIONAL / ESCALA)
- **STT Voice Commands** (ESCALA plan only): Whisper transcription + GPT-4.1-mini intent extraction for orders, cash, and products

## Project Structure
- `client/src/` - React frontend
- `client/src/components/voice-command.tsx` - VoiceCommand component for STT
- `client/src/pages/app/branch-detail.tsx` - Branch detail panel with filtered data
- `server/` - Express backend (routes.ts, storage.ts, auth.ts, seed.ts, db.ts)
- `server/replit_integrations/audio/client.ts` - Audio client for voice recording
- `shared/schema.ts` - Drizzle schema (all tables including stt_logs)

## Running
- `npm run dev` starts both frontend and backend
- Frontend binds to port 5000
- Database is PostgreSQL via DATABASE_URL

## Recent Changes
- 2026-02-07: Initial MVP built - schema, frontend (all pages), backend (all endpoints), JWT auth, seed data
- 2026-02-07: Added STT voice commands (ESCALA plan), product management enhancements (edit/toggle/CSV/cost/stock), branch detail panel with filtered data, orders show branch badges
