# gym-backend

Simple scaffold for a Gym backend using Express and Prisma (SQLite).

Quick start

1. Open PowerShell and go to the project folder:

```powershell
cd "C:\Users\91969\OneDrive\Desktop\GYM_FRONTEND\demo gym\gym-backend"
```

2. Install dependencies:

```powershell
npm install
```

3. Generate Prisma client and run the initial migration (creates `dev.db`):

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

4. Start server in development:

```powershell
npm run dev
```

API

- `GET /api/` — health check
