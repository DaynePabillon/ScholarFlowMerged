# ScholarFlow Merged

A unified platform combining **ScholarSync** (Academic Management) and **SkyFlow** (Project Management) into a single co-existing system.

## Architecture

- **Backend** (`/backend`): Express.js API on port `5000`
  - SkyFlow routes: `/api/*` (tasks, workspaces, teams, WBS, analytics)
  - ScholarSync routes: `/api/scholar/*` (courses, consultations, journals)
- **Frontend** (`/frontend`): Next.js 14 on port `3000`
  - SkyFlow pages: `/boards`, `/analytics`, etc.
  - ScholarSync pages: `/scholar/*`

## Getting Started

```bash
# Backend
cd backend
cp ../.env.example .env  # Fill in your credentials
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Setup

Copy `.env.example` to `backend/.env` and fill in the required values. See the file for details.
