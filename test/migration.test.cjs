const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module, Controller, Get } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { HealthCheckService, TypeOrmHealthIndicator } = require('@nestjs/terminus');
const { DataSource } = require('typeorm');
const { HealthController } = require('../dist/monitoring/health.controller');
const { AppModule } = require('../dist/app.module');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { ApiAuditLog } = require('../dist/database/entities/api-audit-log.entity');
let auditCalls = 0;
const { AuditLogMiddleware } = require('../dist/middleware/audit-log.middleware');
const { ResponseTransformInterceptor } = require('../dist/common/interceptors/response-transform.interceptor');
const { GlobalExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const bcrypt = require('bcrypt');

class ProbeController { probe() { return { ok: true }; } }
Controller('api/migration/nested')(ProbeController);
Get()(ProbeController.prototype, 'probe', Object.getOwnPropertyDescriptor(ProbeController.prototype, 'probe'));
class ProbeModule {
  configure(consumer) { new AppModule().configure(consumer); }
}
Module({ controllers: [ProbeController], providers: [{
  provide: getRepositoryToken(ApiAuditLog),
  useValue: { save: async () => { auditCalls++; } },
}] })(ProbeModule);

describe('Migration checks without database or external sync', () => {
  let app, url;
  before(async () => {
    const module = await Test.createTestingModule({
      imports: [ProbeModule],
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: {} },
        { provide: TypeOrmHealthIndicator, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  after(async () => { await app?.close(); });
  it('serves health ping and creates UUID request IDs', async () => {
    const response = await fetch(url + '/health/ping');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.match(body.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('preserves caller request IDs', async () => {
    const response = await fetch(url + '/health/ping', { headers: { 'x-request-id': 'migration-check' } });
    assert.equal((await response.json()).requestId, 'migration-check');
  });
  it('preserves JSON errors for missing routes', async () => {
    const response = await fetch(url + '/missing');
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.statusCode, 404);
    assert.ok(body.requestId);
  });
  it('runs API audit middleware on nested API routes only', async () => {
    const beforeCount = auditCalls;
    const api = await fetch(url + '/api/migration/nested');
    assert.equal(api.status, 200);
    await api.text();
    assert.equal(auditCalls, beforeCount + 1);
    const health = await fetch(url + '/health/ping');
    await health.text();
    assert.equal(auditCalls, beforeCount + 1);
  });
  it('loads bcrypt and validates passwords', async () => {
    const hash = await bcrypt.hash('migration-test', 4);
    assert.equal(await bcrypt.compare('migration-test', hash), true);
    assert.equal(await bcrypt.compare('wrong-password', hash), false);
  });
});
