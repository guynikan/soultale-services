# PRD — SoulTale API

> **Documento de referência para geração de código via Cursor.**
> Este documento especifica a API backend do SoulTale em nível de detalhe suficiente para implementação completa. Leia-o integralmente antes de gerar qualquer código.

---

## 1. Visão Geral do Projeto

**SoulTale** é um aplicativo mobile de diário de voz gamificado. O usuário grava entradas de voz, que são transcritas e analisadas por IA (Claude). Se o momento narrado for significativo o suficiente, uma **carta** é gerada — um artefato visual com título, imagem e insight. O app possui sistema de XP, níveis e quests narrativas.

**Por que esta API existe:**
Hoje os dados do usuário ficam salvos apenas localmente (SQLite no dispositivo). A API centraliza os dados por conta de usuário, habilita sincronização entre dispositivos, remove a chave da Claude API do client, e cria a base necessária para monetização futura.

**Stack definida:**
- **Framework:** NestJS (Node.js + TypeScript)
- **Banco de dados:** PostgreSQL com extensão JSONB para campos flexíveis
- **ORM:** Prisma
- **Autenticação:** OAuth 2.0 via Google + JWT próprio da API
- **Storage de áudio:** Cloudinary ou AWS S3 (variável de ambiente define qual)
- **Deploy:** Railway

---

## 2. Arquitetura Geral

```
Mobile App (React Native)
        │
        │ HTTPS / JSON
        ▼
  SoulTale API (NestJS)
   ├── Auth Module
   ├── Users Module
   ├── Entries Module      ← entradas de voz
   ├── Cards Module        ← cartas geradas
   ├── Quests Module       ← quests narrativas (estrutura apenas, lógica futura)
   └── AI Module           ← proxy para Claude API
        │
        ├──▶ PostgreSQL (dados)
        ├──▶ Anthropic API (análise de IA)
        └──▶ Cloud Storage (arquivos de áudio)
```

**Regra crítica de segurança:** A chave da Anthropic API **nunca** é exposta ao cliente. Todas as chamadas à Claude API são feitas exclusivamente pelo servidor.

---

## 3. Variáveis de Ambiente

O arquivo `.env` deve conter as seguintes variáveis. Gere um `.env.example` com os nomes mas sem valores.

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/soultale

# JWT
JWT_SECRET=sua_chave_secreta_longa_aqui
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# Storage (escolha um provider)
STORAGE_PROVIDER=cloudinary   # ou "s3"

# Cloudinary (se STORAGE_PROVIDER=cloudinary)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AWS S3 (se STORAGE_PROVIDER=s3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

---

## 4. Schema do Banco de Dados (Prisma)

Implemente o schema Prisma completo abaixo. Rode `prisma migrate dev` para criar as migrations.

### Conceito central — duas camadas de carta

O sistema tem **dois modelos distintos** para cartas:

- `DeckCard` — o deck mestre global. São as 72 cartas fixas do jogo, independentes de qualquer usuário. Gerenciadas por seed/admin. Existem uma única vez no banco.
- `UserCard` — o vínculo entre um usuário e uma `DeckCard`. Criado no momento do desbloqueio. Contém o contexto específico daquele desbloqueio (entry, insight, fragment). Um usuário só pode ter uma `UserCard` por `DeckCard`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String     @id @default(uuid())
  email         String     @unique
  name          String
  avatarUrl     String?
  googleId      String?    @unique
  xp            Int        @default(0)
  level         Int        @default(1)
  levelName     String     @default("O Aprendiz")
  streakDays    Int        @default(0)
  lastEntryAt   DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  entries       Entry[]
  userCards     UserCard[]
  quests        Quest[]

  @@map("users")
}

// Deck mestre — as 72 cartas fixas do jogo
// Populado via seed. Nunca alterado em runtime.
model DeckCard {
  id            String     @id @default(uuid())
  title         String     @unique   // chave de lookup usada pela IA
  imageUrl      String               // URL da imagem pré-gerada no storage
  description   String?              // descrição interna da carta (não exibida ao usuário)
  order         Int                  // ordem de exibição no deck (1–72)

  // Metadados do deck — para fins de gestão interna
  metadata      Json?      // { arquetipo, temas, dimensoes } — não exposto ao usuário

  userCards     UserCard[]

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@map("deck_cards")
}

// Vínculo usuário ↔ DeckCard — criado no momento do desbloqueio
model UserCard {
  id            String     @id @default(uuid())

  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  deckCardId    String
  deckCard      DeckCard   @relation(fields: [deckCardId], references: [id])

  entryId       String?    @unique
  entry         Entry?     @relation(fields: [entryId], references: [id])

  // Contexto específico do desbloqueio — gerado pela IA para aquela entry
  insight       String     // frase gerada pela IA
  fragment      String     // trecho literal da fala do usuário
  xpEarned      Int        @default(0)

  // Metadados do momento do desbloqueio
  unlockContext Json?      // { mood, themes, significanceScore }

  questId       String?
  quest         Quest?     @relation(fields: [questId], references: [id])

  unlockedAt    DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // Garante que um usuário não desbloqueia a mesma carta duas vezes
  @@unique([userId, deckCardId])
  @@map("user_cards")
}

model Entry {
  id            String     @id @default(uuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  transcription String
  audioUrl      String?
  durationSecs  Int?
  xpEarned      Int        @default(0)

  aiAnalysis    Json?      // { mood, themes, significanceScore }

  unlockedCard  Boolean    @default(false)  // se esta entry desbloqueou uma carta
  userCard      UserCard?

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@map("entries")
}

model Quest {
  id            String      @id @default(uuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  name          String
  description   String?
  status        QuestStatus @default(LATENT)

  userCards     UserCard[]

  detectedAt    DateTime    @default(now())
  activatedAt   DateTime?
  concludedAt   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@map("quests")
}

enum QuestStatus {
  LATENT      // detectada, aguardando confirmação do usuário
  ACTIVE      // confirmada pelo usuário
  TURNING     // IA detectou mudança de tom
  CONCLUDED   // encerrada com card especial
  ABANDONED   // sumiu das entradas
}
```

---

## 5. Estrutura de Módulos NestJS

Organize o projeto na seguinte estrutura de diretórios:

```
src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── google.strategy.ts
│   │   └── jwt.strategy.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       └── google-oauth.guard.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       └── update-user.dto.ts
├── entries/
│   ├── entries.module.ts
│   ├── entries.controller.ts
│   ├── entries.service.ts
│   └── dto/
│       ├── create-entry.dto.ts
│       └── entry-response.dto.ts
├── deck/
│   ├── deck.module.ts
│   ├── deck.controller.ts        ← endpoints do deck mestre (GET /deck, GET /deck/:id)
│   ├── deck.service.ts
│   └── dto/
│       └── deck-card-response.dto.ts
├── user-cards/
│   ├── user-cards.module.ts
│   ├── user-cards.controller.ts  ← cartas desbloqueadas pelo usuário
│   ├── user-cards.service.ts
│   └── dto/
│       └── user-card-response.dto.ts
├── quests/
│   ├── quests.module.ts
│   ├── quests.controller.ts
│   ├── quests.service.ts
│   └── dto/
│       └── update-quest.dto.ts
├── ai/
│   ├── ai.module.ts
│   └── ai.service.ts          ← toda lógica de chamada à Claude API fica aqui
├── storage/
│   ├── storage.module.ts
│   └── storage.service.ts     ← abstração sobre Cloudinary/S3
└── common/
    ├── decorators/
    │   └── current-user.decorator.ts
    ├── filters/
    │   └── http-exception.filter.ts
    └── interceptors/
        └── response-transform.interceptor.ts
```

---

## 6. Especificação de Endpoints

### 6.1 Auth

#### `GET /auth/google`
Inicia o fluxo OAuth com o Google. Redireciona para a tela de consentimento do Google.

**Parâmetros:** nenhum
**Resposta:** redirect 302

---

#### `GET /auth/google/callback`
Callback do Google após autenticação. Cria o usuário se não existir, retorna JWT.

**Resposta de sucesso `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Eduardo",
    "avatarUrl": "https://...",
    "xp": 0,
    "level": 1,
    "levelName": "O Aprendiz"
  }
}
```

---

#### `POST /auth/refresh`
Renova o JWT. Requer token ainda válido no header.

**Header:** `Authorization: Bearer <token>`

**Resposta `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 6.2 Users

> Todos os endpoints de `/users` exigem `Authorization: Bearer <token>`.

#### `GET /users/me`
Retorna o perfil completo do usuário autenticado.

**Resposta `200`:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Eduardo",
  "avatarUrl": "https://...",
  "xp": 340,
  "level": 2,
  "levelName": "O Viajante",
  "streakDays": 5,
  "lastEntryAt": "2026-04-29T21:00:00Z",
  "createdAt": "2026-04-01T00:00:00Z"
}
```

---

#### `PATCH /users/me`
Atualiza dados do perfil. Apenas `name` e `avatarUrl` são editáveis pelo usuário.

**Body:**
```json
{
  "name": "Eduardo Lima"
}
```

**Resposta `200`:** objeto `User` atualizado

---

### 6.3 Entries

> Todos os endpoints de `/entries` exigem `Authorization: Bearer <token>`.

#### `POST /entries`
Cria uma nova entrada de voz. Este é o endpoint central do app.

**Fluxo interno ao receber a requisição:**
1. Salva o áudio no storage (se enviado)
2. Salva a Entry no banco
3. Chama `AiService.analyzeEntry(transcription)` — passa transcrição + lista dos 72 títulos do deck
4. Se `shouldGenerateCard: false` → vai direto ao passo 8
5. Busca `DeckCard` pelo título retornado pela IA — se não encontrar, trata como sem carta
6. Verifica se o usuário já possui essa `DeckCard` via `@@unique([userId, deckCardId])` — se sim, trata como sem carta
7. Cria `UserCard` vinculando usuário, DeckCard e Entry
8. Calcula XP (base + bônus de carta se desbloqueou)
9. Atualiza streak e `lastEntryAt`
10. Retorna entry + userCard + xpUpdate

**Body (multipart/form-data):**
```
transcription: string (obrigatório)
audio: File (opcional — arquivo de áudio)
durationSecs: number (opcional)
```

**Resposta `201`:**
```json
{
  "entry": {
    "id": "uuid",
    "transcription": "Hoje foi um dia difícil no trabalho...",
    "audioUrl": "https://storage.../audio.m4a",
    "durationSecs": 87,
    "xpEarned": 15,
    "unlockedCard": true,
    "createdAt": "2026-04-30T21:34:00Z"
  },
  "userCard": {
    "id": "uuid-da-user-card",
    "deckCard": {
      "id": "uuid-da-deck-card",
      "title": "O Peso do Ferro",
      "imageUrl": "https://storage.../ferro.jpg",
      "order": 1
    },
    "insight": "Aquele que carrega o peso sem reclamar, um dia encontra a força que não sabia ter.",
    "fragment": "não sei mais se quero continuar nesse caminho",
    "xpEarned": 50,
    "unlockedAt": "2026-04-30T21:34:00Z"
  },
  "xpUpdate": {
    "xpEarned": 65,
    "totalXp": 405,
    "level": 2,
    "levelName": "O Viajante",
    "leveledUp": false
  }
}
```

> **Nota:** se nenhuma carta for desbloqueada (entry sem significância, ou carta já possuída), o campo `userCard` retorna `null`. O campo `xpUpdate` sempre está presente.

---

#### `GET /entries`
Lista as entradas do usuário com paginação.

**Query params:**
```
page: number (default: 1)
limit: number (default: 20, max: 50)
```

**Resposta `200`:**
```json
{
  "data": [ /* array de Entry */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 87,
    "totalPages": 5
  }
}
```

---

#### `GET /entries/:id`
Retorna uma entrada específica do usuário. Valida que a entry pertence ao usuário autenticado.

**Resposta `200`:** objeto `Entry` completo com card relacionado (se houver)

**Resposta `404`:** entry não encontrada ou não pertence ao usuário

---

#### `DELETE /entries/:id`
Remove uma entrada. Também remove o card associado (se houver) e o áudio do storage.

**Resposta `204`:** sem corpo

---

### 6.4 Deck (cartas mestres)

> Endpoints do deck mestre — as 72 cartas fixas do jogo.
> Requerem `Authorization: Bearer <token>`.
> Estes endpoints são **read-only** para o cliente mobile. Escrita é feita apenas via seed/admin.

#### `GET /deck`
Retorna todas as 72 cartas do deck mestre, combinadas com o status de desbloqueio do usuário autenticado. Este é o endpoint usado para renderizar a tela de deck estilo Pokédex.

**Resposta `200`:**
```json
[
  {
    "id": "uuid-da-deck-card",
    "title": "O Peso do Ferro",
    "order": 1,
    "unlocked": true,
    "imageUrl": "https://storage.../ferro.jpg",
    "userCard": {
      "id": "uuid-da-user-card",
      "insight": "Aquele que carrega o peso sem reclamar...",
      "fragment": "não sei mais se quero continuar",
      "unlockedAt": "2026-04-30T21:34:00Z"
    }
  },
  {
    "id": "uuid-da-deck-card-2",
    "title": "A Travessia",
    "order": 2,
    "unlocked": false,
    "imageUrl": null,        // null quando não desbloqueada — client renderiza silhueta
    "userCard": null
  }
]
```

> **Nota de implementação:** quando `unlocked: false`, o `imageUrl` deve ser omitido ou retornado como `null`. O client é responsável por renderizar a silhueta. O título pode ser exibido ou ocultado — decisão de UI.

---

#### `GET /deck/:id`
Retorna uma carta específica do deck com o status de desbloqueio do usuário.

**Resposta `200`:** objeto no mesmo formato do item do array acima.
**Resposta `404`:** carta não existe no deck.

---

### 6.5 User Cards (cartas desbloqueadas)

> Cartas já desbloqueadas pelo usuário. Requerem `Authorization: Bearer <token>`.
> **Não há endpoint de criação** — o desbloqueio ocorre internamente via `POST /entries`.

#### `GET /user-cards`
Lista as cartas desbloqueadas pelo usuário com paginação.

**Query params:**
```
page: number (default: 1)
limit: number (default: 20, max: 50)
questId: string (opcional — filtra por quest)
```

**Resposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid-da-user-card",
      "deckCard": {
        "id": "uuid-da-deck-card",
        "title": "O Peso do Ferro",
        "imageUrl": "https://storage.../ferro.jpg",
        "order": 1
      },
      "insight": "Aquele que carrega o peso sem reclamar...",
      "fragment": "não sei mais se quero continuar",
      "xpEarned": 50,
      "unlockContext": { "mood": "tenso", "themes": ["trabalho", "identidade"] },
      "unlockedAt": "2026-04-30T21:34:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

---

#### `GET /user-cards/:id`
Retorna uma user-card específica. Valida que pertence ao usuário autenticado.

**Resposta `200`:** objeto `UserCard` completo com `deckCard` aninhado.
**Resposta `404`:** não encontrada ou não pertence ao usuário.

---

### 6.6 Quests

> Todos os endpoints de `/quests` exigem `Authorization: Bearer <token>`.

> **Nota de implementação:** A lógica de **detecção** de quests (análise de padrões entre entradas) é futura. Por agora, implemente apenas o CRUD para que o mobile possa gerenciar quests existentes.

#### `GET /quests`
Lista as quests do usuário.

**Query params:**
```
status: QuestStatus (opcional — filtra por status)
```

**Resposta `200`:** array de `Quest`

---

#### `GET /quests/:id`
Retorna uma quest com suas cartas relacionadas.

**Resposta `200`:**
```json
{
  "id": "uuid",
  "name": "A Dúvida do Caminho",
  "description": "Uma sombra sobre sua jornada profissional...",
  "status": "ACTIVE",
  "detectedAt": "2026-04-20T00:00:00Z",
  "activatedAt": "2026-04-21T00:00:00Z",
  "cards": [ /* cartas relacionadas */ ]
}
```

---

#### `PATCH /quests/:id`
Atualiza o status de uma quest. Usado pelo usuário para confirmar (LATENT → ACTIVE) ou encerrar.

**Body:**
```json
{
  "status": "ACTIVE"
}
```

**Regras de transição de status permitidas pelo client:**
- `LATENT` → `ACTIVE` (usuário confirma a quest)
- `LATENT` → `ABANDONED` (usuário descarta)
- `ACTIVE` → `CONCLUDED` (usuário encerra manualmente)
- `ACTIVE` → `ABANDONED`

Transições inválidas retornam `400 Bad Request`.

**Resposta `200`:** objeto `Quest` atualizado

---

### 6.7 Health Check

#### `GET /health`
Endpoint público para verificar se a API está no ar.

**Resposta `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-30T21:00:00Z"
}
```

---

## 7. Lógica de IA (AiService) e Fluxo de Desbloqueio

O `AiService` encapsula toda comunicação com a Anthropic API. O `UserCardsService` contém a lógica de desbloqueio.

### 7.1 Fluxo completo ao criar uma entry

```
POST /entries
     │
     ▼
1. Salva áudio no storage (se enviado)
2. Salva Entry no banco
3. AiService.analyzeEntry(transcription)
     │
     ├─ shouldGenerateCard: false → soma XP base → retorna entry sem card
     │
     └─ shouldGenerateCard: true → recebe título da carta
          │
          ▼
4. DeckService.findByTitle(title)
     │
     ├─ título não existe no deck → loga warning → trata como sem carta
     │   (a IA alucionou um título inexistente — nunca criar carta fora do deck)
     │
     └─ DeckCard encontrada
          │
          ▼
5. UserCardsService.alreadyUnlocked(userId, deckCardId)
     │
     ├─ já desbloqueada → soma XP base apenas → retorna entry sem card
     │   (carta duplicada — usuário já a possui)
     │
     └─ não desbloqueada
          │
          ▼
6. UserCardsService.create({ userId, deckCardId, entryId, insight, fragment, unlockContext })
7. Soma XP de carta ao usuário
8. Verifica level up
9. Retorna entry + userCard desbloqueada
```

---

### 7.2 Método `analyzeEntry(transcription: string)`

**Model:** `claude-haiku-4-5`

**System prompt base:**
```
Você é o motor narrativo do SoulTale, um app de diário de voz gamificado.
Sua função é analisar entradas de voz do usuário e decidir se o momento narrado
é significativo o suficiente para desbloquear uma carta — um artefato visual da jornada do usuário.

Cartas são RARAS. Elas aparecem quando há:
- Uma tomada de decisão importante
- Um momento de vulnerabilidade genuína
- Uma virada de perspectiva
- Um confronto com uma tensão recorrente
- Um evento com carga emocional significativa

Entradas cotidianas simples, relatos sem carga emocional, ou registros factuais NÃO desbloqueiam carta.

O deck possui 72 cartas com títulos fixos. Você DEVE escolher exatamente um título
da lista fornecida — nunca invente um título que não esteja na lista.

Responda SEMPRE em JSON válido, sem texto fora do JSON.
```

**User message:** inclui a transcrição + a lista dos 72 títulos do deck

```
Transcrição: "<texto da entrada>"

Títulos disponíveis no deck:
["O Peso do Ferro", "A Travessia", "O Espelho Partido", ...]
```

> **Por que passar a lista no prompt:** impede que a IA invente títulos. A lista é carregada do banco via `DeckService.getAllTitles()` a cada chamada. Em produção considere fazer cache desta lista (ela nunca muda em runtime).

**Estrutura de resposta esperada do Claude (JSON):**
```json
{
  "shouldGenerateCard": true,
  "significanceScore": 8,
  "mood": "tenso",
  "themes": ["trabalho", "identidade", "dúvida"],
  "card": {
    "title": "O Peso do Ferro",
    "insight": "Aquele que carrega o peso sem reclamar, um dia encontra a força que não sabia ter.",
    "fragment": "não sei mais se quero continuar nesse caminho"
  }
}
```

**Quando `shouldGenerateCard` é `false`:**
```json
{
  "shouldGenerateCard": false,
  "significanceScore": 3,
  "mood": "neutro",
  "themes": ["rotina"],
  "card": null
}
```

---

### 7.3 Tabela de XP

```typescript
export const XP_VALUES = {
  ENTRY_BASE: 10,        // toda entrada gravada ganha isso
  ENTRY_BONUS_LONG: 5,   // entradas > 60 segundos ganham bônus
  CARD_UNLOCK: 50,       // desbloqueio de qualquer carta (raridade removida)
  STREAK_BONUS: 5,       // bônus por manter streak diário
};
```

### 7.4 Tabela de Níveis

```typescript
export const LEVELS = [
  { level: 1, name: "O Aprendiz",  minXp: 0 },
  { level: 2, name: "O Viajante",  minXp: 100 },
  { level: 3, name: "O Buscador",  minXp: 300 },
  { level: 4, name: "O Guardião",  minXp: 600 },
  { level: 5, name: "O Sábio",     minXp: 1000 },
  { level: 6, name: "O Oráculo",   minXp: 1500 },
  { level: 7, name: "O Arquiteto", minXp: 2200 },
  { level: 8, name: "O Eterno",    minXp: 3000 },
];
```

---

## 8. Lógica de Streak

O streak mede dias consecutivos com pelo menos uma entrada.

**Regras de cálculo (implementar no `EntriesService`):**

1. Ao criar uma entry, buscar `user.lastEntryAt`
2. Se `lastEntryAt` for nulo → é a primeira entry, streak = 1
3. Se `lastEntryAt` for de **hoje** → streak não muda (já gravou hoje)
4. Se `lastEntryAt` for de **ontem** → streak += 1
5. Se `lastEntryAt` for de **2+ dias atrás** → streak volta para 1 (quebrado)
6. Atualizar `user.lastEntryAt = now()` e `user.streakDays = novoStreak`

---

## 9. Tratamento de Erros

Use o `HttpExceptionFilter` global para padronizar todos os erros:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Mensagem descritiva do erro",
  "timestamp": "2026-04-30T21:00:00Z",
  "path": "/entries"
}
```

**Códigos de resposta a implementar por situação:**

| Situação | Código |
|---|---|
| Recurso não encontrado | 404 |
| Token ausente ou inválido | 401 |
| Recurso pertence a outro usuário | 403 |
| Dados inválidos no body | 400 |
| Erro na Claude API | 502 |
| Erro no storage de áudio | 502 |
| Erro interno genérico | 500 |

---

## 10. Segurança

- Todos os endpoints exceto `/auth/*` e `/health` exigem JWT válido via `JwtAuthGuard`
- Aplicar globalmente com `APP_GUARD` no `AppModule`
- Validação de body com `class-validator` e `class-transformer` em todos os DTOs
- `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true`
- Rate limiting: instalar `@nestjs/throttler` e limitar a 60 requests/minuto por IP
- CORS configurado para aceitar apenas as origens do app mobile em produção
- Helmet para headers de segurança HTTP

---

## 11. Configuração do Prisma Service

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

---

## 12. Dependências do Projeto

Instale as seguintes dependências:

```bash
# Core
npm install @nestjs/common @nestjs/core @nestjs/platform-fastify reflect-metadata rxjs

# Config
npm install @nestjs/config

# Auth
npm install @nestjs/jwt @nestjs/passport passport passport-google-oauth20 passport-jwt
npm install -D @types/passport-google-oauth20 @types/passport-jwt

# Prisma
npm install @prisma/client
npm install -D prisma

# Validação
npm install class-validator class-transformer

# Segurança
npm install @nestjs/throttler helmet

# HTTP client (para chamadas à Anthropic)
npm install @nestjs/axios axios

# Multipart (upload de áudio)
npm install @fastify/multipart

# Storage
npm install cloudinary       # se usar Cloudinary
npm install @aws-sdk/client-s3   # se usar S3

# Dev
npm install -D @types/node @types/multer typescript ts-node
```

> **Nota:** Use o adapter do Fastify (`@nestjs/platform-fastify`) para melhor performance, mas toda a lógica de negócio deve ser agnóstica ao adapter.

---

## 13. Scripts do package.json

```json
{
  "scripts": {
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "build": "nest build",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

---

## 14. Seed do Banco (prisma/seed.ts)

O seed tem duas responsabilidades distintas:

**1. Seed permanente do deck (sempre executado):**
Insere as 72 `DeckCard`s com título, imageUrl e order. Este seed é **idempotente** — usa `upsert` pelo campo `title` para não duplicar em re-execuções.

**2. Seed de desenvolvimento (apenas em `NODE_ENV=development`):**
- 1 usuário de teste (`test@soultale.app`)
- 5 entries de exemplo
- 3 UserCards desbloqueadas (vinculadas às DeckCards do deck)
- 1 quest de exemplo com status `ACTIVE`

Isso permite desenvolvimento do mobile sem precisar gravar entradas reais.

> **Importante:** o seed do deck deve ser executado também em produção no primeiro deploy — as DeckCards precisam existir antes de qualquer usuário gravar uma entry. Inclua `npx prisma db seed` no pipeline de deploy após a migration.

---

## 15. Railway — Configuração de Deploy

O `Procfile` na raiz deve conter:

```
web: npm run start:prod
```

O `railway.toml` na raiz:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build && npx prisma generate"

[deploy]
startCommand = "npx prisma migrate deploy && npm run start:prod"
restartPolicyType = "on-failure"
```

> **Variáveis de ambiente no Railway:** configure todas as variáveis da seção 3 no dashboard do Railway antes do primeiro deploy. O `DATABASE_URL` é gerado automaticamente ao adicionar um plugin PostgreSQL ao projeto.

---

## 16. O que NÃO implementar agora

Para evitar escopo creep, os seguintes itens estão fora do MVP desta API:

- Detecção automática de quests por análise de padrões entre entradas
- Geração de imagens via IA (imagens são pré-geradas, armazenadas no storage e referenciadas nas DeckCards)
- Sistema de assinatura / monetização
- Notificações push
- Endpoints de métricas / analytics
- Chapters (resumos narrativos de períodos)
- Qualquer interface de backoffice — use Prisma Studio ou Metabase externamente

---

*Documento gerado em 30 abr 2026. Versão 1.1 — MVP.*
