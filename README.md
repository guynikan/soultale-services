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

## Imagens do baralho (R2 ou outro CDN)

- Defina `DECK_ASSETS_PUBLIC_BASE_URL` no `.env` (origem **sem** barra final), por exemplo o host `https://pub-….r2.dev` ou um domínio próprio apontando ao bucket.
- Faça upload dos arquivos em **`deck/v1/{imageId}.png`**, com os mesmos `imageId` do seed (`margem`, `porta-fechada`, `armadura`, `impasse`, `guinada`, `correnteza`).
- Rode `npm run db:seed` de novo para atualizar `DeckCard.imageUrl` no banco. Sem essa variável, o seed continua usando as URLs de fallback no GitHub.

**Segurança:** tokens de API da Cloudflare (`cfat_…`) e chaves S3 do R2 **não** vão para o app nem para o Git — só em `.env` local/CI secreto. Se um token vazou, revogue no painel e crie outro.
