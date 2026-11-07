# KapdaFactory

An admin application for tailoring orders, customer records, payments, and deliveries.

[![Next.js: App Router](https://img.shields.io/badge/Next.js-App%20Router-111827?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript: Typed](https://img.shields.io/badge/TypeScript-Typed-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma: PostgreSQL](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?style=flat-square&logo=prisma&logoColor=white)](prisma/schema.prisma)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-64748B?style=flat-square)](LICENSE)

[Data model](prisma/schema.prisma) · [Environment](.env.example)

## What is here

- Order and delivery management screens with supporting API routes.
- PostgreSQL models through Prisma and server-side order helpers.
- Session authentication, input validators, and image-storage integration.
- Unit and Playwright test scripts.

## Run locally

```bash
git clone https://github.com/ak1458/kapdafactory-web-nextjs.git
cd kapdafactory-web-nextjs
npm ci
cp .env.example .env.local
```

Configure a **development** database and `AUTH_SECRET`, then apply the schema and start the app:

```bash
npm run db:push
npm run dev
```

Review the [environment template](.env.example). Blob storage and password-reset email need their own credentials. Configure administrator access for the target environment before exposing the app.

## Engineering notes

`src/app/` contains routes, `src/server/` contains domain and database helpers, and `prisma/` defines the data model.

Available checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. `npm run vercel-build` generates the Prisma client and builds the app; it does not apply database migrations.

## License

Copyright © 2026 Ashraf Kamal. Reuse is restricted by [LICENSE](LICENSE).
