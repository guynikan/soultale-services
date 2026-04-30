# SoulTale Services

NestJS + Prisma backend for SoulTale mobile app.

## Setup

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

## Scripts

- `npm run start:dev` - run API in watch mode
- `npm run build` - build project
- `npm run test:smoke` - run smoke e2e checks
- `npm run db:migrate` - create/apply local migration
- `npm run db:seed` - seed deck + dev fixtures
