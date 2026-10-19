import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loginPage, layoutCss } from './page.mjs';

const sessionName = '__Host-aw_gate';
const csrfName = '__Host-aw_gate_csrf';
const ttl = 12 * 60 * 60;
const equal = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
const readCookie = (req, name) => (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) ?? '';

export function createGate({ origin, secret, credentialHash, verifier = 'http://caddy:8081/verify', css = '', now = Date.now }) {
  if (new URL(origin).origin !== origin || !origin.startsWith('https://')) throw Error('HTTPS origin required');
  if (!secret || secret.length < 64 || !credentialHash) throw Error('Gate secrets missing');
  // Credential rotation also invalidates all previously issued sessions.
  const key = createHash('sha256').update(secret + '\0' + credentialHash + '\0' + origin).digest();
  const sign = data => createHmac('sha256', key).update(data).digest('base64url');
  const mint = (purpose, seconds) => {
    const body = `${purpose}.${Math.floor(now() / 1000) + seconds}.${randomBytes(24).toString('base64url')}`;
    return body + '.' + sign(body);
  };
  const valid = (token, purpose, seconds) => {
    if (token.length > 256) return false;
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== purpose || !/^\d+$/.test(parts[1])) return false;
    const remaining = Number(parts[1]) - Math.floor(now() / 1000);
    return remaining > 0 && remaining <= seconds && equal(parts[3], sign(parts.slice(0, 3).join('.')));
  };
  const attempts = new Map();
  // Issued only over container loopback. Restart invalidates outstanding links.
  const invitations = new Map();
  const inviteHash = value => createHash('sha256').update(value).digest('hex');
  function allowed(req) {
    const time = now();
    for (const [ip, item] of attempts) if (item.until <= time) attempts.delete(ip);
    // Caddy replaces untrusted incoming X-Forwarded-For; service has no host port.
    const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
    const item = attempts.get(ip) ?? { count: 0, until: time + 60_000 };
    if (attempts.size >= 10000 && !attempts.has(ip)) return false;
    attempts.set(ip, item);
    return ++item.count <= 10;
  }
  async function credentials(authorization) {
    const response = await fetch(verifier, { headers: { authorization }, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    if (response.status === 200) return true;
    if (response.status === 401) return false;
    throw Error('Credential verifier unavailable');
  }
  function page(req, res, status = 200, message = '') {
    const csrf = mint('csrf', 600);
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie(csrfName, csrf, 600) });
    res.end(loginPage(csrf, message));
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // HTML form navigation uses Origin:null under no-referrer, even same-origin.
    // Keep only the origin (no path/query disclosure) without breaking POST CSRF checks.
    res.setHeader('Referrer-Policy', 'strict-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const path = new URL(req.url, origin).pathname;
      if (path === '/healthz' && req.method === 'GET') { res.end('OK'); return; }
      if (path === '/issue-invite' && req.method === 'POST') {
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !equal(req.headers.authorization ?? '', 'Bearer ' + secret)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        for (const [id, expires] of invitations) if (expires <= now()) invitations.delete(id);
        if (invitations.size >= 100) { res.writeHead(429); res.end('Too many outstanding invitations'); return; }
        const token = randomBytes(32).toString('base64url'), expires = now() + 30 * 60_000;
        invitations.set(inviteHash(token), expires);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: origin + '/__gate/invite?token=' + token, expiresAt: new Date(expires).toISOString() })); return;
      }
      if (path === '/__gate/invite' && req.method === 'GET') {
        // GET redemption needs no form, native input, or browser credential broker.
        // Strip the secret from the next URL and from all subsequent referrers.
        res.setHeader('Referrer-Policy', 'no-referrer');
        const token = new URL(req.url, origin).searchParams.get('token') ?? '';
        const id = inviteHash(token), expires = invitations.get(id);
        if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !expires || expires <= now()) {
          res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('测试邀请已失效或已使用，请申请新的邀请链接。'); return;
        }
        // Synchronous consume before sending a session prevents concurrent redemption.
        invitations.delete(id);
        res.writeHead(303, { Location: '/', 'Set-Cookie': cookie(sessionName, mint('session', ttl), ttl) });
        res.end(); return;
      }
      if (path === '/__gate/style.css' && req.method === 'GET') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.end(css + layoutCss); return;
      }
      if (path === '/__gate/login' && req.method === 'GET') { page(req, res); return; }
      if (path === '/verify' && req.method === 'GET') {
        if (valid(readCookie(req, sessionName), 'session', ttl)) { res.end('OK'); return; }
        const uri = req.headers['x-forwarded-uri'] ?? '/';
        const method = req.headers['x-forwarded-method'] ?? 'GET';
        if (['GET', 'HEAD'].includes(method) && !uri.startsWith('/api/') && !req.headers.upgrade && (req.headers.accept ?? '').includes('text/html')) {
          res.writeHead(303, { Location: '/__gate/login' }); res.end(); return;
        }
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'SITE_ACCESS_REQUIRED', login: '/__gate/login' })); return;
      }
      if (path === '/__gate/login' && req.method === 'POST') {
        if (req.headers.origin !== origin) { res.writeHead(403); res.end('Origin rejected'); return; }
        if (!allowed(req)) { res.setHeader('Retry-After', '60'); page(req, res, 429, '尝试过于频繁，请一分钟后重试。'); return; }
        if (!(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) { res.writeHead(415); res.end(); return; }
        let body = '', bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 4096) { res.writeHead(413); res.end(); return; }
          body += chunk.toString('utf8');
        }
        const form = new URLSearchParams(body), csrf = form.get('csrf') ?? '';
        if (!valid(csrf, 'csrf', 600) || !equal(csrf, readCookie(req, csrfName))) { page(req, res, 403, '验证页面已过期，请重新输入。'); return; }
        const username = form.get('username') ?? '', password = form.get('password') ?? '';
        if (!username || username.length > 128 || username.includes(':') || !password || password.length > 512) { page(req, res, 400, '请填写有效的访问用户名和口令。'); return; }
        if (!await credentials('Basic ' + Buffer.from(username + ':' + password).toString('base64'))) { page(req, res, 401, '访问用户名或口令不正确，请重试。'); return; }
        res.writeHead(303, { Location: '/', 'Set-Cookie': [cookie(sessionName, mint('session', ttl), ttl), cookie(csrfName, '', 0)] });
        res.end(); return;
      }
      if (path === '/__gate/logout' && req.method === 'POST') {
        if (req.headers.origin !== origin) { res.writeHead(403); res.end(); return; }
        res.writeHead(303, { Location: '/__gate/login', 'Set-Cookie': cookie(sessionName, '', 0) }); res.end(); return;
      }
      res.writeHead(404); res.end('Not found');
    } catch {
      if (!res.headersSent) page(req, res, 503, '访问验证暂时不可用，请稍后重试。');
      else res.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createGate({ origin: 'https://' + process.env.AW_DOMAIN, secret: process.env.AW_GATE_SESSION_KEY,
    credentialHash: process.env.AW_GATE_HASH, verifier: process.env.AW_GATE_VERIFIER || 'http://caddy:8081/verify', css: readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
  }).listen(8080, '0.0.0.0', () => console.log('Web access gate listening on 8080'));
}
