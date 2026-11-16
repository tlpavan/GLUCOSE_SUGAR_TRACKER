import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createTokenService, TOKEN_LIFETIME_SECONDS } from '../src/auth/tokens.js';
import { requireAuthentication } from '../src/auth/middleware.js';
import { loginSchema, registrationSchema } from '../src/auth/validation.js';

describe('credential validation', () => {
  const valid = { name: 'Test User', email: 'test@example.test', password: 'synthetic-password' };

  it('normalizes name/email but preserves passwords exactly', () => {
    const input = { ...valid, name: '  Test User  ', email: ' TEST@EXAMPLE.TEST ', password: '  password  ' };
    const parsed = registrationSchema.parse(input);
    assert.equal(parsed.name, valid.name);
    assert.equal(parsed.email, valid.email);
    assert.ok(parsed.password === input.password);
  });

  it('enforces required fields, lengths and strict input ownership', () => {
    for (const input of [
      {}, { ...valid, name: ' ' }, { ...valid, name: 'a'.repeat(101) },
      { ...valid, email: 'not-email' }, { ...valid, password: 'short' },
      { ...valid, password: 'a'.repeat(73) }, { ...valid, password: 'é'.repeat(37) },
      { ...valid, userId: 123 }, { ...valid, password: 12345678 },
    ]) assert.equal(registrationSchema.safeParse(input).success, false);
    assert.equal(registrationSchema.safeParse({ ...valid, password: 'é'.repeat(36) }).success, true);
    assert.equal(registrationSchema.safeParse({ ...valid, password: 'a'.repeat(8) }).success, true);
    assert.equal(loginSchema.safeParse({ email: valid.email, password: valid.password, userId: 1 }).success, false);
  });
});

describe('verified token identity', () => {
  const secret = randomBytes(48).toString('hex');
  const tokens = createTokenService(secret);
  const app = express();
  app.get('/protected', requireAuthentication(tokens), (req, res) => res.json(req.auth));
  const options = { issuer: 'sweety-api', audience: 'sweety-client', subject: '7', expiresIn: '15m' };

  it('issues a short-lived token and derives identity solely from its subject', async () => {
    const token = tokens.issue(7);
    const claims = jwt.decode(token);
    assert.equal(claims.exp - claims.iat, TOKEN_LIFETIME_SECONDS);
    const response = await request(app).get('/protected?userId=999').set('Authorization', `Bearer ${token}`).set('X-User-Id', '999');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { userId: 7 });
  });

  it('rejects missing, malformed, expired, forged and unsuitable tokens', async () => {
    const invalid = [
      undefined, 'Basic invalid', 'Bearer not-a-jwt',
      `Bearer ${jwt.sign({}, randomBytes(48).toString('hex'), options)}`,
      `Bearer ${jwt.sign({}, secret, { ...options, expiresIn: -1 })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, algorithm: 'HS384' })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, audience: 'other-client' })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, issuer: 'other-issuer' })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, subject: 'invalid' })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, expiresIn: '1h' })}`,
      `Bearer ${jwt.sign({ sub: '7' }, secret)}`,
      `Bearer ${jwt.sign({}, secret, { ...options, subject: '-1' })}`,
      `Bearer ${jwt.sign({}, secret, { ...options, algorithm: 'none' })}`,
    ];
    for (const authorization of invalid) {
      const req = request(app).get('/protected?userId=7');
      if (authorization) req.set('Authorization', authorization);
      const response = await req;
      assert.equal(response.status, 401);
      assert.equal(response.body.error.code, 'UNAUTHORIZED');
    }
  });

  it('refuses a weak signing-secret configuration', () => {
    assert.throws(() => createTokenService('short'), /at least 32 bytes/);
  });
});
