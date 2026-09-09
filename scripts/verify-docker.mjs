import assert from 'node:assert/strict';

const base = 'http://localhost:3001';
async function call(path, { body, cookie, method } = {}) {
  return fetch(base + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3100', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
async function login(path, email, password) {
  const result = await call(path, { body: { email, password } });
  assert.equal(result.status, 200, `Login ${email}`);
  const cookie = result.headers.get('set-cookie');
  assert.ok(cookie?.includes('HttpOnly'), 'Cookie must be HTTP-only');
  return cookie.split(';')[0];
}

assert.equal((await call('/health')).status, 200);
assert.equal((await call('/workspace/hr')).status, 401);
const employee = await login('/auth/login', 'hr@mknsite.online', 'demo12345');
assert.equal((await call('/workspace/hr', { cookie: employee })).status, 200);
assert.equal((await call('/workspace/ops-telco', { cookie: employee })).status, 403);
assert.equal((await call('/auth/admin/me', { cookie: employee })).status, 401);
assert.equal((await call('/auth/admin/login', { body: { email: 'hr@mknsite.online', password: 'demo12345' } })).status, 401);
const admin = await login('/auth/admin/login', 'admin@mknsite.online', 'admin12345');
assert.equal((await call('/auth/admin/me', { cookie: admin })).status, 200);
assert.equal((await call('/auth/me', { cookie: admin })).status, 401);
const logout = await call('/auth/logout', { method: 'POST', cookie: employee + '; ' + admin });
assert.equal(logout.status, 200);
assert.ok(logout.headers.get('set-cookie')?.startsWith('mkn_employee.session_token='));
assert.equal((await call('/auth/admin/me', { cookie: admin })).status, 200);
for (const path of ['/', '/login', '/admin/login']) {
  assert.equal((await fetch('http://localhost:3100' + path)).status, 200);
}
console.log('PASS: web routes, database login, RBAC allow/deny, separate admin session and logout cookie.');
