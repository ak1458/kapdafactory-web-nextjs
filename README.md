# KapdaFactory - Order Management System

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Vercel](https://img.shields.io/badge/Vercel-Blob%20Storage-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)


**Admin-only application** for managing tailoring orders, payments, and deliveries.

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Database:** PostgreSQL (Prisma ORM)
- **Storage:** Vercel Blob (images)
- **Auth:** JWT (jose)
- **Styling:** Tailwind CSS 4

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Push database schema
npm run db:push

# Run development server
npm run dev
```

Default login: `admin@admin.com` / `admin`

## Deployment

### Vercel + Postgres (Recommended)

1. Create project on Vercel
2. Add Vercel Postgres from Storage tab
3. Set environment variables:
   - `AUTH_SECRET` (generate: `openssl rand -base64 32`)
4. Deploy

See `DEPLOY.md` for detailed instructions.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run vercel-build` - Build with database migration
- `npm run db:push` - Push schema changes
- `npm run db:studio` - Open Prisma Studio
- `npm test` - Run tests

## Security

- JWT-based authentication
- Rate limiting on auth endpoints
- CSRF protection (optional, disabled by default)
- Security headers enabled
- Admin-only access (no public routes)

## Project Structure

```
src/
  app/           # Next.js App Router
    api/         # API routes
    (pages)/     # Page components
  components/    # React components
  context/       # Auth context
  lib/           # Utilities (API, CSRF, rate-limit)
  server/        # Server utilities (auth, db, validators)
  ui-pages/      # Page UI components
prisma/
  schema.prisma  # Database schema
public/          # Static assets
scripts/         # Dev scripts only
```

## Environment Variables

```env
# Required
DATABASE_URL="postgresql://..."
AUTH_SECRET="your-secret-key"

# Optional (for Vercel Blob images)
BLOB_READ_WRITE_TOKEN="..."

# Optional (for password reset emails)
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
```

## License

Private - For KapdaFactory use only
