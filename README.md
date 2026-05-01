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

## Bruno (API client)

Collection versionada em `bruno/`. Abra essa pasta no [Bruno](https://www.usebruno.com/).

1. Copie o ambiente: `cp bruno/environments/local.bru.example bruno/environments/local.bru` e preencha `firebase_test_email` / `firebase_test_password` (usuário com **Email/senha** no mesmo projeto Firebase da API). `firebase_web_api_key` já vem do app (`EXPO_PUBLIC_FIREBASE_API_KEY`).
2. No Bruno, selecione o ambiente **local** (canto superior direito).
3. O **script de pré-requisição da collection** chama `signInWithPassword` na API do Identity Toolkit, guarda o `idToken` em variável de ambiente da sessão (~50 min) e define o header `Authorization` em todas as requisições, exceto **Health check** (rota pública).
4. Preencha `deck_card_id`, `entry_id`, etc. conforme precisar (UUIDs retornados pela API ou seed).
5. Doc OpenAPI: com a API no ar, no Bruno use **Import → OpenAPI** em `http://127.0.0.1:3000/docs-json` se quiser gerar/atualizar requests a partir do Swagger (a pasta `bruno/` continua sendo a collection “oficial” com auth automático).

Se `require("axios")` falhar no script, ative **Developer Mode** nas preferências do Bruno (scripts com `axios`/`await` dependem disso nas versões recentes).
