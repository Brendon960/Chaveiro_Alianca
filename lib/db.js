'use strict';
/**
 * Armazenamento em arquivo JSON (data/db.json).
 * Suficiente para o volume de um site institucional e fácil de fazer backup.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('./auth');
const D = require('./defaults');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const SCHEMA_VERSION = 3;

let data = null;
const listeners = [];

const newId = () => crypto.randomBytes(8).toString('hex');
const clone = (x) => JSON.parse(JSON.stringify(x));

function seed() {
  return {
    version: SCHEMA_VERSION,
    settings: { ...D.DEFAULT_SETTINGS },
    texts: clone(D.DEFAULT_TEXTS),
    categories: clone(D.DEFAULT_CATEGORIES),
    services: D.DEFAULT_SERVICES.map((s, i) => ({ id: newId(), order: i + 1, ...s })),
    products: [],
    system: { ...D.DEFAULT_SYSTEM },
    users: [],
  };
}

const createdUsers = [];

/** Migra bancos criados por versões anteriores. */
function migrate(d) {
  d.settings = { ...D.DEFAULT_SETTINGS, ...(d.settings || {}) };
  d.texts = { ...clone(D.DEFAULT_TEXTS), ...(d.texts || {}) };
  d.system = { ...D.DEFAULT_SYSTEM, ...(d.system || {}) };
  for (const k of ['services', 'products', 'users']) if (!Array.isArray(d[k])) d[k] = [];
  if (!Array.isArray(d.categories) || !d.categories.length) d.categories = clone(D.DEFAULT_CATEGORIES);

  // v1 tinha um único usuário em d.admin
  if (d.admin) {
    d.users.push({ ...d.admin, role: 'admin' });
    delete d.admin;
  }

  if ((d.version || 1) < 2) {
    if (!d.settings.address) d.settings.address = D.PLACEHOLDERS.address;
    if (!d.settings.hours) d.settings.hours = D.PLACEHOLDERS.hours;
    d.texts.steps = clone(D.DEFAULT_TEXTS.steps);
  }

  // v3: seção "Marcas atendidas" removida do projeto
  delete d.brands;
  for (const k of Object.keys(d.texts)) if (k.startsWith('brands')) delete d.texts[k];

  d.services.forEach((s) => {
    if (typeof s.whatsappService !== 'string') s.whatsappService = s.title;
  });
  d.products.forEach((p) => {
    if (p.image === undefined) p.image = Array.isArray(p.images) && p.images[0] ? p.images[0] : '';
    delete p.images;
    if (typeof p.showPrice !== 'boolean') p.showPrice = true;
  });

  for (const u of D.DEFAULT_USERS) {
    if (d.users.some((x) => x.role === u.role)) continue;
    const password = process.env[u.envPassword] || u.password;
    d.users.push({
      username: (u.role === 'admin' && process.env.ADMIN_USER) || u.username,
      role: u.role,
      passwordHash: auth.hashPassword(password),
      mustChangePassword: true,
    });
    createdUsers.push({ username: u.username, role: u.role, password });
  }

  d.version = SCHEMA_VERSION;
  return d;
}

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : seed();
  migrate(data);
  save();

  if (createdUsers.length) {
    console.log('\n================ ACESSOS INICIAIS ================');
    for (const u of createdUsers.splice(0)) {
      const area = u.role === 'admin' ? 'Painel administrativo (/admin)' : 'Painel do desenvolvedor (/dev)';
      console.log(`  ${area}\n    usuário: ${u.username}   senha inicial: ${u.password}`);
    }
    console.log('  A troca da senha é exigida no primeiro acesso.');
    console.log('==================================================\n');
  }
  listeners.forEach((fn) => fn());
}

function get() {
  return data;
}

function save() {
  const json = JSON.stringify(data, null, 2);
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, json, 'utf8');
  try {
    fs.renameSync(tmp, FILE);
  } catch {
    // Em pastas sincronizadas (ex.: OneDrive) o rename pode falhar; grava direto.
    fs.writeFileSync(FILE, json, 'utf8');
    fs.rmSync(tmp, { force: true });
  }
}

function update(fn) {
  const result = fn(data);
  save();
  listeners.forEach((l) => l());
  return result;
}

function onChange(fn) {
  listeners.push(fn);
}

function findUser(username) {
  return data.users.find((u) => u.username === username) || null;
}

module.exports = { DATA_DIR, FILE, load, get, save, update, onChange, newId, findUser };
