'use strict';
const crypto = require('crypto');

const COOKIE = 'ca_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const sessions = new Map(); // token -> { exp, username, role }
const fails = new Map(); // ip -> { count, until }

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const a = crypto.scryptSync(password, salt, 64);
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { exp: Date.now() + SESSION_TTL_MS, username: user.username, role: user.role });
  return token;
}

function tokenFrom(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}

/** Retorna a sessão válida da requisição (e a renova) ou null. */
function sessionFrom(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.exp < Date.now()) {
    sessions.delete(token);
    return null;
  }
  s.exp = Date.now() + SESSION_TTL_MS;
  return { ...s, token };
}

function destroy(token) {
  sessions.delete(token);
}

/** Encerra as outras sessões de um usuário (ex.: após troca de senha). */
function destroyUserSessions(username, keepToken) {
  for (const [t, s] of sessions) if (s.username === username && t !== keepToken) sessions.delete(t);
}

function cookie(token, secure) {
  const maxAge = token ? SESSION_TTL_MS / 1000 : 0;
  return `${COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function isLocked(ip) {
  const f = fails.get(ip);
  return !!(f && f.until && f.until > Date.now());
}

function registerFail(ip) {
  const f = fails.get(ip) || { count: 0, until: 0 };
  if (f.until && f.until < Date.now()) {
    f.count = 0;
    f.until = 0;
  }
  f.count += 1;
  if (f.count >= MAX_FAILS) f.until = Date.now() + LOCK_MS;
  fails.set(ip, f);
  return f;
}

function clearFails(ip) {
  fails.delete(ip);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  tokenFrom,
  sessionFrom,
  destroy,
  destroyUserSessions,
  cookie,
  isLocked,
  registerFail,
  clearFails,
};
