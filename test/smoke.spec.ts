import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Smoke (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? JSON.stringify({
      project_id: 'x',
      client_email: 'x@x.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nX\\n-----END PRIVATE KEY-----\\n',
    });
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    await (app.getHttpAdapter().getInstance().ready?.() ?? Promise.resolve());
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health should be public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/users/me should require auth', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
