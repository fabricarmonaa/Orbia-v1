# ORBIA - SaaS Multi-Tenant para PyMEs

## Overview
ORBIA is a multi-tenant SaaS platform for SMBs (PyMEs). It provides order management, treasury/cash control, product catalogs, branch management, and public tracking links. Supports branch-level multi-tenancy with scope-based access control.

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT-based (separate flows: Super Admin vs Tenant Admin vs Delivery Agent vs Public tracking)
- **AI Service**: Python FastAPI microservice (ai-service/) for STT, using faster-whisper with ffmpeg audio conversion

## Access Flows
1. **Super Admin** (`/owner/login`): admin@orbia.app / admin123
2. **Tenant Admin** (`/login`): Code: demo, admin@demo.com / demo123
3. **Public Tracking** (`/tracking/:id`): No auth needed
4. **Delivery Agent** (`/delivery/login`): Code: demo, DNI: 30123456, PIN: 1234

## Key Modules
- **Orders**: CRUD + status management + comments + public tracking links + branch column display + delivery toggle + order auditing (createdByScope, createdByBranchId)
- **Cash/Treasury**: Session open/close + income/expense movements
- **Products**: CRUD + categories + cost/stock tracking + edit modal + activate/deactivate toggle + PDF export + stock by branch dialog
- **Branches**: Multi-branch support per tenant + branch detail panel with filtered orders/cash
- **Plans**: Feature flags + limits (ECONOMICO / PROFESIONAL / ESCALA)
- **STT Voice Commands** (ESCALA plan only): Proxied to Python AI microservice for transcription, with POST /api/ai/apply for confirmed intents
- **Delivery** (addon, per-tenant): Agent management + route building + action states config + photo proofs + delivery tracking + Google Maps redirect links
- **Stock Management**: Per-branch stock tracking with audit trail (productStockByBranch + stockMovements tables)

## Scope-Based Access Control
- **User scopes**: `TENANT` (full access) or `BRANCH` (restricted to assigned branch)
- **JWT includes**: `scope` and `branchId` fields
- **Middleware**: `enforceBranchScope` restricts BRANCH users to their branch data; `blockBranchScope` blocks BRANCH users entirely from certain operations
- **Order auditing**: Each order records `createdByScope` and `createdByBranchId` from the JWT of the creator

## Delivery Module
- **Addon activation**: Super admin enables per tenant via PATCH /api/super/tenants/:tenantId/addons/:addonKey (tenant_addons table)
- **Delivery agents**: Separate auth flow (tenantCode + DNI + PIN), JWT with scope=DELIVERY
- **Action states**: Tenant-configurable (ENTREGADO/NO_ENCONTRADO/RECHAZADO etc) with photo/comment requirements
- **Routes**: Agent selects available orders → creates route → marks each stop with action + photo → completes route
- **Photo proofs**: multer upload to /uploads/delivery/, 10MB limit, .jpg/.jpeg/.png/.webp
- **Order integration**: Orders can toggle requiresDelivery, with deliveryAddress (calle+número), deliveryCity, deliveryAddressNotes, deliveryStatus fields
- **Google Maps**: No API key needed - uses redirect URLs (`https://www.google.com/maps/search/?api=1&query=...`) from delivery panel and order detail

## AI Service (ai-service/)
- **Architecture**: Separate Python FastAPI microservice, configurable via `AI_SERVICE_URL` env var (default: http://localhost:8001)
- **STT**: faster-whisper (base model, CPU, int8) for speech-to-text
- **Audio conversion**: ffmpeg detects format and converts webm/ogg/mp3/m4a → WAV before transcription
- **Intent apply**: POST /api/ai/apply endpoint creates orders/cash/products directly from confirmed voice intents
- **Graceful degradation**: If AI service is unavailable, Express returns 503 with `AI_SERVICE_UNAVAILABLE` code
- **Run**: `cd ai-service && pip install -r requirements.txt && python main.py`

## Project Structure (Modular)
- `client/src/` - React frontend
- `client/src/components/voice-command.tsx` - VoiceCommand component for STT with editable intent preview
- `client/src/pages/app/` - Tenant app pages (orders, products, cash, branches, delivery, settings, dashboard)
- `client/src/pages/app/branch-detail.tsx` - Branch detail panel with filtered data
- `client/src/pages/app/delivery.tsx` - Tenant delivery management (agents, config, routes, orders)
- `client/src/pages/delivery-login.tsx` - Delivery agent login page
- `client/src/pages/delivery-panel.tsx` - Delivery agent panel (orders, route, actions, history)
- `shared/schema.ts` - Barrel re-export from shared/schema/ directory
- `shared/schema/` - Domain-based schema modules (plans.ts, tenants.ts, users.ts, branches.ts, config.ts, orders.ts, products.ts, cash.ts, delivery.ts, stock.ts, stt.ts)
- `server/storage/` - Domain-based storage modules (interface.ts, users.ts, orders.ts, products.ts, cash.ts, delivery.ts, stock.ts, config.ts, stt.ts, super.ts, tenants.ts) + index.ts barrel
- `server/routes/` - Domain-based route modules (auth.ts, super.ts, tenant.ts, orders.ts, branches.ts, cash.ts, products.ts, stt.ts, tracking.ts, delivery.ts, uploads.ts) + index.ts barrel
- `server/auth.ts` - JWT auth, middleware (tenantAuth, superAuth, enforceBranchScope, blockBranchScope, deliveryAuth)
- `server/seed.ts` - Conditional database seeding (SEED env var, checks existing data)
- `ai-service/` - Python FastAPI microservice (main.py, transcriber.py, parsers/)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - JWT signing secret
- `AI_SERVICE_URL` - URL of Python AI microservice (default: http://localhost:8001)
- `SEED` - Set to "false" to disable database seeding (default: seeds run in dev)

## Running
- `npm run dev` starts both frontend and backend
- Frontend binds to port 5000
- Database is PostgreSQL via DATABASE_URL
- AI service runs separately: `cd ai-service && python main.py` (port 8001)

## Background Jobs
- **Tracking purge**: Runs every 5 minutes, revokes expired tracking links (sets trackingRevoked=true where trackingExpiresAt < now)

## Profile & Customization
- **Tenant Settings**: Logo upload (POST /api/config/logo), business description, tracking style editor
- **Tracking Customization**: 4 layout presets (classic/cards/stepper/minimal), color pickers (primary/accent/bg), ToS text, live preview
- **Owner Panel**: Avatar upload, tabs for tenant management vs subscription management
- **Subscription System**: Start/end dates per tenant, 3-day grace period, 7-day warning, auto-block after grace, warning banner in tenant app
- **File Uploads**: multer, tenant logos and owner avatars in /uploads/profiles/ (5MB), delivery photos in /uploads/delivery/ (10MB)
- **PDF Export**: Products export as PDF via pdfkit (replaced CSV)

## DB Constraints
- `tenant_addons`: unique on (tenantId, addonKey)
- `delivery_agents`: unique on (tenantId, dni)
- `product_stock_by_branch`: unique on (tenantId, productId, branchId)

## MySQL Migration Notes
- Avoid Postgres-specific features: no `text().array()`, use JSON columns instead
- Replace `serial()` with `int().autoincrement()` for MySQL
- Replace `timestamp().defaultNow()` with MySQL equivalent
- Drizzle ORM supports both dialects via separate driver packages

## Recent Changes
- 2026-02-07: Initial MVP built - schema, frontend (all pages), backend (all endpoints), JWT auth, seed data
- 2026-02-07: Added STT voice commands (ESCALA plan), product management enhancements (edit/toggle/CSV/cost/stock), branch detail panel with filtered data, orders show branch badges
- 2026-02-07: Comprehensive Delivery addon module - agents CRUD, separate auth, routes/stops/actions, photo proofs, tenant-configurable action states, owner panel addon toggle, delivery agent login/panel pages
- 2026-02-07: Profile customization (logos, avatars, business descriptions), tracking page theming (4 layouts, colors, ToS), subscription management with grace period/warnings, PDF product export
- 2026-02-07: Branch-level multi-tenancy with scope-based access control (TENANT/BRANCH scopes), per-branch stock management with audit trail, order auditing (createdByScope/createdByBranchId), Python FastAPI AI microservice (faster-whisper + regex intent), automated tracking link expiration purge, conditional database seeding
- 2026-02-07: Code restructured into 49 domain-based modules (shared/schema/, server/storage/, server/routes/), STT enhanced with ffmpeg audio conversion and POST /api/ai/apply endpoint, VoiceCommand component with editable preview, PATCH addon toggle endpoint, DB unique constraints added
