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
- **Orders**: CRUD + status management + comments + public tracking links
- **Cash/Treasury**: Session open/close + income/expense movements
- **Products**: CRUD + categories
- **Branches**: Multi-branch support per tenant
- **Plans**: Feature flags + limits (ECONOMICO / PROFESIONAL / ESCALA)

## Project Structure
- `client/src/` - React frontend
- `server/` - Express backend (routes.ts, storage.ts, auth.ts, seed.ts, db.ts)
- `shared/schema.ts` - Drizzle schema (all tables)

## Running
- `npm run dev` starts both frontend and backend
- Frontend binds to port 5000
- Database is PostgreSQL via DATABASE_URL

## Recent Changes
- 2026-02-07: Initial MVP built - schema, frontend (all pages), backend (all endpoints), JWT auth, seed data
