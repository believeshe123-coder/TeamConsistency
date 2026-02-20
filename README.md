# Worker Rating App (Simple Backend Setup)

## What was added
- Node + Express backend in `/server`
- SQLite file database (`/server/data.sqlite`)
- CORS enabled for local development
- Basic API helper (`api.js`) used by the frontend for workers + ratings

## Run locally

### 1) Install dependencies
```bash
npm install
```

### 2) Start backend (port 3001)
```bash
npm run backend
```

### 3) Start frontend (port 5173)
```bash
npm run frontend
```

Then open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001/api`

## Minimum API endpoints implemented
- `GET  /api/workers`
- `POST /api/workers`
- `GET  /api/workers/:id/ratings`
- `POST /api/ratings`

## Manual two-computer test
1. On **Computer A**, run backend and frontend, open app, add a worker, submit a rating.
2. Keep backend running and ensure Computer B can reach backend host (`http://<A-IP>:3001`).
3. On **Computer B**, serve frontend and set API base before loading page:
   - In browser devtools console: `window.WORKER_API_BASE = 'http://<A-IP>:3001/api'`
   - Refresh page.
4. Verify the worker and rating created on Computer A appear on Computer B.
5. Add another rating on Computer B and refresh Computer A — data should persist and match.
