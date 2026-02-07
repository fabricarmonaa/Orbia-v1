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
4. **Delivery Agent** (`/delivery/login`): Code: demo, DNI: 30123456, PIN: 1234

## Key Modules
- **Orders**: CRUD + status management + comments + public tracking links + branch column display + delivery toggle
- **Cash/Treasury**: Session open/close + income/expense movements
- **Products**: CRUD + categories + cost/stock tracking + edit modal + activate/deactivate toggle + CSV export
- **Branches**: Multi-branch support per tenant + branch detail panel with filtered orders/cash
- **Plans**: Feature flags + limits (ECONOMICO / PROFESIONAL / ESCALA)
- **STT Voice Commands** (ESCALA plan only): Whisper transcription + GPT-4.1-mini intent extraction for orders, cash, and products
- **Delivery** (addon, per-tenant): Agent management + route building + action states config + photo proofs + delivery tracking

## Delivery Module
- **Addon activation**: Super admin enables per tenant via toggle in Owner panel (tenant_addons table)
- **Delivery agents**: Separate auth flow (tenantCode + DNI + PIN), JWT with scope=DELIVERY
- **Action states**: Tenant-configurable (ENTREGADO/NO_ENCONTRADO/RECHAZADO etc) with photo/comment requirements
- **Routes**: Agent selects available orders → creates route → marks each stop with action + photo → completes route
- **Photo proofs**: multer upload to /uploads/delivery/, 10MB limit, .jpg/.jpeg/.png/.webp
- **Order integration**: Orders can toggle requiresDelivery, with deliveryAddress (calle+número), deliveryCity, deliveryAddressNotes, deliveryStatus fields
- **Google Maps**: No API key needed - uses redirect URLs (`https://www.google.com/maps/search/?api=1&query=...`) from delivery panel and order detail

## Project Structure
- `client/src/` - React frontend
- `client/src/components/voice-command.tsx` - VoiceCommand component for STT
- `client/src/pages/app/branch-detail.tsx` - Branch detail panel with filtered data
- `client/src/pages/app/delivery.tsx` - Tenant delivery management (agents, config, routes, orders)
- `client/src/pages/delivery-login.tsx` - Delivery agent login page
- `client/src/pages/delivery-panel.tsx` - Delivery agent panel (orders, route, actions, history)
- `server/` - Express backend (routes.ts, storage.ts, auth.ts, seed.ts, db.ts)
- `server/replit_integrations/audio/client.ts` - Audio client for voice recording
- `shared/schema.ts` - Drizzle schema (all tables including delivery tables + stt_logs)

## Running
- `npm run dev` starts both frontend and backend
- Frontend binds to port 5000
- Database is PostgreSQL via DATABASE_URL

## Recent Changes
- 2026-02-07: Initial MVP built - schema, frontend (all pages), backend (all endpoints), JWT auth, seed data
- 2026-02-07: Added STT voice commands (ESCALA plan), product management enhancements (edit/toggle/CSV/cost/stock), branch detail panel with filtered data, orders show branch badges
- 2026-02-07: Comprehensive Delivery addon module - agents CRUD, separate auth, routes/stops/actions, photo proofs, tenant-configurable action states, owner panel addon toggle, delivery agent login/panel pages
