import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/shared/errors/global-exception.filter';

describe('Patients API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = ':memory:';
    process.env.LLM_PROVIDER = 'ollama'; // sin llamadas reales en este test

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /patients - creates a patient', async () => {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .send({
        name: 'Test',
        lastname: 'Patient',
        age: 30,
        cedula: Math.floor(Math.random() * 99999999),
        email: `test-${Date.now()}@example.com`,
        phone: '+584141234567',
        birthdate: '1996-01-01',
        address: 'Test street',
        gender: 1,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name.full).toBe('Test Patient');
  });

  it('POST /patients - rejects invalid email', async () => {
    await request(app.getHttpServer())
      .post('/patients')
      .send({
        name: 'X',
        lastname: 'Y',
        age: 30,
        cedula: 111,
        email: 'not-an-email',
        phone: '+584141234567',
        birthdate: '1996-01-01',
        address: 'addr',
        gender: 1,
      })
      .expect(400);
  });

  it('GET /healthz - returns status', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('db');
    expect(res.body).toHaveProperty('uptime');
  });
});
