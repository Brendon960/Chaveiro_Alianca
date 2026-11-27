'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./lib/db');
const auth = require('./lib/auth');
const logger = require('./lib/logger');
const backup = require('./lib/backup');
const { DEFAULT_SETTINGS, DEFAULT_TEXTS } = require('./lib/defaults');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
const SUPERVISED = !!process.env.CA_SUPERVISED || process.env.pm_id !== undefined;
const STARTED_AT = new Date();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
logger.init(db.DATA_DIR);
db.load();
backup.init({ dataFile: db.FILE, uploadDir: UPLOAD_DIR, backupDir: BACKUP_DIR });
logger.info('system', 'Aplicação iniciada', { pid: process.pid, node: process.version, port: PORT, supervised: SUPERVISED });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */
const str = (v, max = 500) => (v == null ? '' : String(v)).trim().slice(0, max);
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const imgUrl = (v) => {
  const s = str(v, 300);
  return /^\/(uploads|img)\/[\w\-./]+$/.test(s) && !s.includes('..') ? s : '';
};
const httpUrl = (v) => {
  const s = str(v, 500);
  return /^https?:\/\//i.test(s) ? s : '';
};
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const uniq = (arr) => [...new Set(arr)];
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const waDigits = () => String(db.get().settings.whatsapp || '').replace(/\D/g, '');
const waConfigured = () => /^\d{12,13}$/.test(waDigits());

function parsePrice(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  let s = String(v).replace(/[^\d,.]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function slugify(s) {
  return str(s, 60)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'categoria';
}

// Limite simples por IP para rotas públicas de registro (evita abuso dos logs).
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}|${req.ip}`;
    const now = Date.now();
    const h = hits.get(key) || { n: 0, reset: now + windowMs };
    if (now > h.reset) { h.n = 0; h.reset = now + windowMs; }
    h.n += 1;
    hits.set(key, h);
    if (h.n > max) return res.status(429).json({ error: 'Muitas requisições.' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now > h.reset) hits.delete(k); }, 60_000).unref();

/* ------------------------------------------------------------------ */
/* Página pública, cache e modo manutenção                             */
/* ------------------------------------------------------------------ */
function publicData() {
  const d = db.get();
  return {
    settings: d.settings,
    texts: d.texts,
    categories: d.categories,
    services: d.services.filter((s) => s.active).sort(byOrder),
    products: d.products
      .filter((p) => p.active)
      .sort(byOrder)
      .map((p) => ({ ...p, price: p.showPrice ? p.price : null })),
  };
}

let pageCache = null; // HTML renderizado da landing page
db.onChange(() => { pageCache = null; });

function renderIndex() {
  if (pageCache) return pageCache;
  const data = publicData();
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  pageCache = fs
    .readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
    .replace(/\{\{SEO_TITLE\}\}/g, () => escHtml(data.texts.seoTitle))
    .replace(/\{\{SEO_DESCRIPTION\}\}/g, () => escHtml(data.texts.seoDescription))
    .replace(/\{\{V\}\}/g, () => escHtml(db.get().system.assetVersion))
    .replace('{{SITE_DATA}}', () => json);
  return pageCache;
}

function renderMaintenance() {
  const d = db.get();
  const wa = waDigits();
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(d.texts.whatsappIntro || '')}`;
  return fs
    .readFileSync(path.join(PUBLIC_DIR, 'manutencao.html'), 'utf8')
    .replace(/\{\{NAME\}\}/g, () => escHtml(d.settings.businessName))
    .replace(/\{\{MESSAGE\}\}/g, () => escHtml(d.system.maintenanceMessage).replace(/\n/g, '<br>'))
    .replace(/\{\{WA_URL\}\}/g, () => escHtml(waUrl))
    .replace(/\{\{V\}\}/g, () => escHtml(d.system.assetVersion));
}

app.get(['/', '/index.html'], (req, res) => {
  const session = auth.sessionFrom(req);
  const sys = db.get().system;
  res.set('Cache-Control', 'no-cache');
  if (req.query.preview === 'manutencao' && session) return res.type('html').send(renderMaintenance());
  if (sys.maintenance && !session) {
    res.set('Retry-After', '3600');
    return res.status(503).type('html').send(renderMaintenance());
  }
  res.type('html').send(renderIndex());
});

app.get('/api/site', (req, res) => res.json(publicData()));

// Clique em botão de WhatsApp (enviado pelo site via sendBeacon)
app.post('/api/track', rateLimit(30, 60_000), (req, res) => {
  const b = req.body || {};
  logger.info('whatsapp', 'Clique em orçamento pelo WhatsApp', {
    servico: str(b.service, 160) || '(não informado)',
    origem: str(b.origin, 40),
    tipo: str(b.kind, 20) || 'servico',
    numeroConfigurado: waConfigured(),
  });
  res.status(204).end();
});

// Erros de carregamento no navegador do visitante
app.post('/api/client-log', rateLimit(20, 60_000), (req, res) => {
  const b = req.body || {};
  const type = str(b.type, 20);
  const details = {
    tipo: type,
    arquivo: str(b.src, 300),
    pagina: str(b.page, 300),
    linha: Number(b.line) || undefined,
    navegador: str(req.get('user-agent'), 200),
  };
  if (type === 'image') logger.warn('site', `Imagem não carregou: ${details.arquivo}`, details);
  else logger.error('site', `Erro de script na página: ${str(b.message, 300)}`, details);
  res.status(204).end();
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});
app.get(['/dev', '/dev/'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'dev', 'index.html'));
});

app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));
app.use('/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d' }));

// Imagem inexistente: registra e devolve 404
app.use(['/img', '/uploads'], (req, res) => {
  logger.warn('site', `Imagem não encontrada: ${req.originalUrl}`, { rota: req.originalUrl, origem: str(req.get('referer'), 300) });
  res.status(404).type('txt').send('Imagem não encontrada');
});

/* ------------------------------------------------------------------ */
/* Autenticação e perfis                                               */
/* ------------------------------------------------------------------ */
const ROLE_LABEL = { admin: 'Administrador', developer: 'Desenvolvedor' };

/** Exige sessão. Com roles, exige também um dos perfis. strict=false libera troca de senha pendente. */
function requireRole(roles, { strict = true } = {}) {
  return (req, res, next) => {
    const s = auth.sessionFrom(req);
    if (!s) return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    const user = db.findUser(s.username);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    if (roles && !roles.includes(user.role)) {
      logger.warn('system', 'Acesso negado por perfil', { usuario: user.username, perfil: user.role, rota: req.originalUrl });
      return res.status(403).json({ error: 'Seu perfil não tem acesso a esta área.' });
    }
    if (strict && user.mustChangePassword) {
      return res.status(403).json({ error: 'Troque a senha inicial antes de continuar.', mustChangePassword: true });
    }
    req.user = user;
    req.sessionToken = s.token;
    next();
  };
}
const anyUser = requireRole(null, { strict: false });
const asAdmin = requireRole(['admin', 'developer']);
const asDev = requireRole(['developer']);

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const area = req.body && req.body.area === 'dev' ? 'dev' : 'admin';
  const source = area === 'dev' ? 'system' : 'admin';
  if (auth.isLocked(ip)) {
    logger.warn(source, 'Login bloqueado por excesso de tentativas', { ip, area });
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
  }
  const username = str(req.body && req.body.username, 100);
  const user = db.findUser(username);
  if (!user || !auth.verifyPassword(String((req.body && req.body.password) || ''), user.passwordHash)) {
    const f = auth.registerFail(ip);
    logger.warn(source, 'Tentativa de login inválida', { usuario: username, ip, area, tentativas: f.count });
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  if (area === 'dev' && user.role !== 'developer') {
    logger.warn('system', 'Tentativa de acesso ao painel do desenvolvedor sem permissão', { usuario: username, ip });
    return res.status(403).json({ error: 'Acesso restrito ao perfil Desenvolvedor.' });
  }
  auth.clearFails(ip);
  const token = auth.createSession(user);
  res.setHeader('Set-Cookie', auth.cookie(token, req.secure));
  logger.info(source, 'Login realizado', { usuario: user.username, perfil: ROLE_LABEL[user.role], ip, area });
  res.json({ ok: true, role: user.role, mustChangePassword: !!user.mustChangePassword });
});

app.post('/api/logout', (req, res) => {
  const s = auth.sessionFrom(req);
  if (s) {
    auth.destroy(s.token);
    logger.info(s.role === 'developer' ? 'system' : 'admin', 'Logout', { usuario: s.username });
  }
  res.setHeader('Set-Cookie', auth.cookie(null, req.secure));
  res.json({ ok: true });
});

app.get('/api/me', anyUser, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role, mustChangePassword: !!req.user.mustChangePassword });
});

app.put('/api/password', anyUser, (req, res) => {
  const { current, next } = req.body || {};
  const user = req.user;
  const src = user.role === 'developer' ? 'system' : 'admin';
  if (!auth.verifyPassword(String(current || ''), user.passwordHash)) {
    logger.warn(src, 'Troca de senha recusada: senha atual incorreta', { usuario: user.username });
    return res.status(400).json({ error: 'A senha atual está incorreta.' });
  }
  const pw = String(next || '');
  if (pw.length < 8) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
  if (pw === String(current)) return res.status(400).json({ error: 'A nova senha deve ser diferente da atual.' });
  db.update(() => {
    user.passwordHash = auth.hashPassword(pw);
    user.mustChangePassword = false;
  });
  auth.destroyUserSessions(user.username, req.sessionToken);
  logger.info(src, 'Senha alterada', { usuario: user.username });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Painel administrativo (perfis Administrador e Desenvolvedor)        */
/* ------------------------------------------------------------------ */
const admin = express.Router();
admin.use(asAdmin);

const ENTITY = {
  services: { label: 'Serviço', g: 'o', name: (x) => x.title },
  products: { label: 'Produto', g: 'o', name: (x) => x.name },
};
const audit = (req, message, extra = {}) =>
  logger.info('admin', message, { usuario: req.user.username, rota: `${req.method} ${req.originalUrl}`, ...extra });

admin.get('/data', (req, res) => {
  const d = db.get();
  res.json({
    settings: d.settings,
    texts: d.texts,
    categories: d.categories,
    services: [...d.services].sort(byOrder),
    products: [...d.products].sort(byOrder),
  });
});

const changedKeys = (a, b) => Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

admin.put('/settings', (req, res) => {
  const b = req.body || {};
  const old = db.get().settings;
  const next = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    let v = b[key];
    if (key === 'logo') v = imgUrl(v);
    else if (key === 'whatsapp') v = str(v, 20).replace(/\D/g, '');
    else if (['mapsUrl', 'instagram', 'facebook'].includes(key)) v = httpUrl(v);
    else v = str(v, key === 'hours' || key === 'address' ? 400 : 160);
    next[key] = v;
  }
  if (!next.businessName) next.businessName = DEFAULT_SETTINGS.businessName;
  const changed = changedKeys(old, next);
  db.update((d) => (d.settings = next));
  removeUnusedUploads([old.logo]);
  audit(req, 'Informações de contato alteradas', { campos: changed });
  if (changed.includes('whatsapp')) {
    logger.info('whatsapp', next.whatsapp ? 'Número do WhatsApp alterado' : 'Número do WhatsApp removido', {
      usuario: req.user.username,
      numero: next.whatsapp ? `${next.whatsapp.slice(0, 4)}…${next.whatsapp.slice(-4)}` : '',
    });
  }
  res.json(next);
});

admin.put('/texts', (req, res) => {
  const b = req.body || {};
  const old = db.get().texts;
  const next = {};
  for (const [key, def] of Object.entries(DEFAULT_TEXTS)) {
    if (Array.isArray(def)) {
      const arr = Array.isArray(b[key]) ? b[key] : [];
      next[key] = def.map((item, i) => ({
        title: str(arr[i] && arr[i].title, 120),
        text: str(arr[i] && arr[i].text, 400),
      }));
    } else if (key === 'heroImage') {
      next[key] = imgUrl(b[key]);
    } else {
      next[key] = str(b[key], 1500);
    }
  }
  const changed = changedKeys(old, next);
  db.update((d) => (d.texts = next));
  removeUnusedUploads([old.heroImage]);
  audit(req, 'Textos do site alterados', { campos: changed });
  res.json(next);
});

/* Categorias -------------------------------------------------------- */
admin.post('/categories', (req, res) => {
  const name = str(req.body && req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'Informe o nome da categoria.' });
  const cats = db.get().categories;
  if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
  }
  let id = slugify(name);
  for (let i = 2; cats.some((c) => c.id === id); i++) id = `${slugify(name)}-${i}`;
  const cat = { id, name };
  db.update((d) => d.categories.push(cat));
  audit(req, `Categoria criada: ${name}`, { id });
  res.status(201).json(cat);
});

admin.delete('/categories/:id', (req, res) => {
  const d = db.get();
  const idx = d.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Categoria não encontrada.' });
  const used = d.products.filter((p) => p.category === req.params.id).length;
  if (used) return res.status(409).json({ error: `Não é possível remover: ${used} produto(s) usam esta categoria.` });
  if (d.categories.length === 1) return res.status(409).json({ error: 'Mantenha pelo menos uma categoria.' });
  const [removed] = db.update(() => d.categories.splice(idx, 1));
  audit(req, `Categoria removida: ${removed.name}`, { id: removed.id });
  res.json({ ok: true });
});

/* Serviços e produtos --------------------------------------- */
const sanitizers = {
  services: (b) => ({
    title: str(b.title, 120),
    description: str(b.description, 1200),
    whatsappService: str(b.whatsappService, 120),
    image: imgUrl(b.image),
    highlight: bool(b.highlight),
    active: bool(b.active),
  }),
  products: (b) => ({
    name: str(b.name, 120),
    category: db.get().categories.some((c) => c.id === b.category) ? b.category : db.get().categories[0].id,
    description: str(b.description, 1500),
    price: parsePrice(b.price),
    showPrice: bool(b.showPrice),
    image: imgUrl(b.image),
    active: bool(b.active),
  }),
};
const requiredField = { services: 'title', products: 'name' };
const imagesOf = (x) => [x.image, x.logo].filter(Boolean);

for (const name of Object.keys(sanitizers)) {
  const base = `/${name}`;
  const ent = ENTITY[name];

  admin.post(base, (req, res) => {
    const item = sanitizers[name](req.body || {});
    if (!item[requiredField[name]]) return res.status(400).json({ error: 'Preencha o nome/título.' });
    const created = db.update((d) => {
      const order = d[name].reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
      const full = { id: db.newId(), order, ...item };
      d[name].push(full);
      return full;
    });
    audit(req, `${ent.label} criad${ent.g}: ${ent.name(created)}`, { entidade: name, id: created.id, dados: item });
    res.status(201).json(created);
  });

  admin.put(`${base}/reorder`, (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
    db.update((d) => {
      d[name].forEach((x) => {
        const i = ids.indexOf(x.id);
        x.order = i === -1 ? ids.length + (x.order || 0) : i + 1;
      });
    });
    audit(req, `Ordem alterada: ${ent.label.toLowerCase()}s`, { entidade: name });
    res.json({ ok: true });
  });

  admin.put(`${base}/:id`, (req, res) => {
    const cur = db.get()[name].find((x) => x.id === req.params.id);
    if (!cur) return res.status(404).json({ error: 'Item não encontrado.' });
    const item = sanitizers[name](req.body || {});
    if (!item[requiredField[name]]) return res.status(400).json({ error: 'Preencha o nome/título.' });
    const oldImages = imagesOf(cur);
    const changed = changedKeys(cur, item);
    const visibility = changed.length === 1 && changed[0] === 'active';
    db.update(() => Object.assign(cur, item));
    removeUnusedUploads(oldImages);
    audit(
      req,
      visibility
        ? `${ent.label} ${item.active ? `exibid${ent.g}` : `ocultad${ent.g}`}: ${ent.name(cur)}`
        : `${ent.label} alterad${ent.g}: ${ent.name(cur)}`,
      { entidade: name, id: cur.id, campos: changed }
    );
    res.json(cur);
  });

  admin.delete(`${base}/:id`, (req, res) => {
    const list = db.get()[name];
    const idx = list.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item não encontrado.' });
    const [removed] = db.update(() => list.splice(idx, 1));
    removeUnusedUploads(imagesOf(removed));
    audit(req, `${ent.label} removid${ent.g}: ${ent.name(removed)}`, { entidade: name, id: removed.id });
    res.json({ ok: true });
  });
}

/* Upload de imagens ------------------------------------------------- */
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIME_EXT[file.mimetype]) return cb(null, true);
    req.rejectedFile = { nome: file.originalname, tipo: file.mimetype };
    cb(null, false);
  },
});

function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const ascii = (a, b) => buf.toString('ascii', a, b);
  return (
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (buf[0] === 0x89 && ascii(1, 4) === 'PNG') ||
    ascii(0, 3) === 'GIF' ||
    (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') ||
    ascii(4, 8) === 'ftyp'
  );
}

admin.post('/upload', (req, res) => {
  const fail = (msg, details) => {
    logger.warn('admin', `Falha no upload de imagem: ${msg}`, { usuario: req.user.username, ...details });
    res.status(400).json({ error: msg });
  };
  upload.single('file')(req, res, (err) => {
    if (err) {
      return fail(err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande (máximo 6 MB).' : 'Falha ao enviar a imagem.', { codigo: err.code, erro: err.message });
    }
    if (!req.file) return fail('Envie uma imagem JPG, PNG, WEBP, GIF ou AVIF.', { arquivo: req.rejectedFile || null });
    if (!looksLikeImage(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
      return fail('O arquivo enviado não é uma imagem válida.', { arquivo: req.file.originalname, tipo: req.file.mimetype });
    }
    audit(req, 'Imagem enviada', { arquivo: req.file.filename, original: req.file.originalname, bytes: req.file.size });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

function removeUnusedUploads(urls) {
  const all = JSON.stringify(db.get());
  for (const url of urls) {
    if (!url || !url.startsWith('/uploads/')) continue;
    if (all.includes(`"${url}"`)) continue;
    fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }, () => {});
  }
}

app.use('/api/admin', admin);

/* ------------------------------------------------------------------ */
/* Painel do desenvolvedor (somente perfil Desenvolvedor)              */
/* ------------------------------------------------------------------ */
const dev = express.Router();
dev.use(asDev);
const devAudit = (req, level, message, extra = {}) =>
  logger.log(level, 'system', message, { usuario: req.user.username, rota: `${req.method} ${req.originalUrl}`, ...extra });

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function healthChecks(req) {
  const out = [];
  const d = db.get();

  try {
    fs.accessSync(db.FILE, fs.constants.R_OK | fs.constants.W_OK);
    JSON.parse(fs.readFileSync(db.FILE, 'utf8'));
    out.push({ key: 'db', label: 'Banco de dados', status: 'ok', detail: `Leitura e gravação OK (${kb(fs.statSync(db.FILE).size)})` });
  } catch (e) {
    out.push({ key: 'db', label: 'Banco de dados', status: 'error', detail: e.message });
  }

  try {
    fs.accessSync(UPLOAD_DIR, fs.constants.W_OK);
    const files = fs.readdirSync(UPLOAD_DIR);
    const bytes = files.reduce((s, f) => s + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0);
    const refs = (JSON.stringify(d).match(/\/uploads\/[\w.-]+/g) || []).map((u) => u.slice(9));
    const missing = uniq(refs).filter((f) => !files.includes(f));
    out.push({
      key: 'storage',
      label: 'Armazenamento de imagens',
      status: missing.length ? 'warn' : 'ok',
      detail: missing.length
        ? `${missing.length} imagem(ns) cadastrada(s) não encontrada(s) no disco`
        : `${files.length} arquivo(s), ${kb(bytes)}`,
    });
  } catch (e) {
    out.push({ key: 'storage', label: 'Armazenamento de imagens', status: 'error', detail: e.message });
  }

  out.push(
    req.secure
      ? { key: 'ssl', label: 'Certificado SSL (HTTPS)', status: 'ok', detail: 'Conexão HTTPS ativa' }
      : { key: 'ssl', label: 'Certificado SSL (HTTPS)', status: 'warn', detail: 'Acesso atual sem HTTPS. Normal em ambiente local; em produção configure o certificado.' }
  );

  out.push(
    waConfigured()
      ? { key: 'whatsapp', label: 'Número do WhatsApp', status: 'ok', detail: 'Configurado' }
      : { key: 'whatsapp', label: 'Número do WhatsApp', status: 'error', detail: 'Não configurado — os orçamentos não chegam à empresa' }
  );

  const last = backup.latest();
  const age = last ? Date.now() - Date.parse(last.at) : Infinity;
  out.push(
    !d.system.autoBackup
      ? { key: 'backup', label: 'Backup automático', status: 'warn', detail: 'Desativado' }
      : age > 26 * 3600 * 1000
        ? { key: 'backup', label: 'Backup automático', status: 'warn', detail: last ? 'Último backup com mais de 24 h' : 'Nenhum backup gerado ainda' }
        : { key: 'backup', label: 'Backup automático', status: 'ok', detail: 'Ativo (diário)' }
  );
  return out;
}

dev.get('/overview', (req, res) => {
  const since = Date.now() - 24 * 3600 * 1000;
  const recent24 = logger.all().filter((e) => Date.parse(e.ts) >= since);
  const sys = db.get().system;
  res.json({
    maintenance: sys.maintenance,
    counts: {
      error: recent24.filter((e) => e.level === 'error').length,
      warn: recent24.filter((e) => e.level === 'warn').length,
      whatsapp: recent24.filter((e) => e.source === 'whatsapp' && e.message.startsWith('Clique')).length,
    },
    lastBackup: backup.latest(),
    health: healthChecks(req),
    recent: logger.all().filter((e) => e.level !== 'info').slice(-8).reverse(),
    system: {
      startedAt: STARTED_AT.toISOString(),
      node: process.version,
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      supervised: SUPERVISED,
      autoBackup: sys.autoBackup,
      assetVersion: sys.assetVersion,
    },
  });
});

dev.get('/logs', (req, res) => res.json([...logger.all()].reverse()));

dev.put('/maintenance', (req, res) => {
  const b = req.body || {};
  const sys = db.get().system;
  const enabled = b.enabled === undefined ? sys.maintenance : bool(b.enabled);
  const message = b.message === undefined ? sys.maintenanceMessage : str(b.message, 1000);
  const toggled = enabled !== sys.maintenance;
  db.update((d) => {
    d.system.maintenance = enabled;
    d.system.maintenanceMessage = message || d.system.maintenanceMessage;
  });
  if (toggled) devAudit(req, 'warn', enabled ? 'Modo manutenção ATIVADO' : 'Modo manutenção desativado');
  else devAudit(req, 'info', 'Mensagem de manutenção alterada');
  res.json({ enabled, message: db.get().system.maintenanceMessage });
});

dev.get('/maintenance', (req, res) => {
  const s = db.get().system;
  res.json({ enabled: s.maintenance, message: s.maintenanceMessage });
});

dev.post('/cache/clear', (req, res) => {
  pageCache = null;
  const v = Date.now().toString(36);
  db.update((d) => (d.system.assetVersion = v));
  devAudit(req, 'info', 'Cache limpo', { novaVersaoArquivos: v });
  res.json({ ok: true, assetVersion: v });
});

dev.put('/settings', (req, res) => {
  const autoBackup = bool(req.body && req.body.autoBackup);
  db.update((d) => (d.system.autoBackup = autoBackup));
  devAudit(req, 'info', autoBackup ? 'Backup automático ativado' : 'Backup automático desativado');
  res.json({ autoBackup });
});

dev.get('/backups', (req, res) => res.json(backup.list()));

dev.post('/backup', (req, res) => {
  try {
    const b = backup.create('manual', req.user.username);
    devAudit(req, 'info', 'Backup gerado manualmente', { backup: b.name, imagens: b.images, tamanho: kb(b.bytes) });
    res.status(201).json(b);
  } catch (e) {
    devAudit(req, 'error', 'Falha ao gerar backup', { erro: e.message });
    res.status(500).json({ error: `Falha ao gerar backup: ${e.message}` });
  }
});

dev.post('/backup/restore', (req, res) => {
  try {
    const b = backup.restoreLatest();
    db.load();
    pageCache = null;
    devAudit(req, 'warn', 'Último backup restaurado', { backup: b.name, dataBackup: b.at });
    res.json({ ok: true, backup: b });
  } catch (e) {
    devAudit(req, 'error', 'Falha ao restaurar backup', { erro: e.message });
    res.status(500).json({ error: e.message });
  }
});

dev.post('/restart', (req, res) => {
  if (!SUPERVISED) {
    devAudit(req, 'warn', 'Reinício recusado: aplicação sem supervisor', {});
    return res.status(409).json({
      error: 'A aplicação não foi iniciada pelo supervisor (use "npm start" ou PM2). Reinicie manualmente no servidor.',
    });
  }
  devAudit(req, 'warn', 'Reinício da aplicação solicitado');
  res.json({ ok: true });
  setTimeout(() => process.exit(75), 300);
});

app.use('/api/dev', dev);

/* ------------------------------------------------------------------ */
/* Backup automático diário                                            */
/* ------------------------------------------------------------------ */
function autoBackupTick() {
  if (!db.get().system.autoBackup) return;
  const last = backup.latest();
  if (last && Date.now() - Date.parse(last.at) < 24 * 3600 * 1000) return;
  try {
    const b = backup.create('automático');
    logger.info('system', 'Backup automático gerado', { backup: b.name, imagens: b.images, tamanho: kb(b.bytes) });
  } catch (e) {
    logger.error('system', 'Falha no backup automático', { erro: e.message });
  }
}
setTimeout(autoBackupTick, 15_000).unref();
setInterval(autoBackupTick, 60 * 60 * 1000).unref();

/* ------------------------------------------------------------------ */
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((req, res) => res.redirect('/'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.log(status >= 500 ? 'error' : 'warn', req.path.startsWith('/api/admin') ? 'admin' : 'system', `Erro na requisição: ${err.message}`, {
    rota: `${req.method} ${req.originalUrl}`,
    status,
    stack: String(err.stack || '').split('\n').slice(0, 6).join('\n'),
  });
  if (req.path.startsWith('/api')) return res.status(status).json({ error: status >= 500 ? 'Erro interno no servidor.' : 'Requisição inválida.' });
  res.status(status).send('Erro interno no servidor.');
});

process.on('uncaughtException', (e) => {
  logger.error('system', `Exceção não tratada: ${e.message}`, { stack: String(e.stack || '').split('\n').slice(0, 8).join('\n') });
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  logger.error('system', `Promise rejeitada sem tratamento: ${e && e.message}`, {});
});

app.listen(PORT, () => {
  console.log(`Chaveiro Aliança BH rodando em http://localhost:${PORT}`);
  console.log(`Painel administrativo:   http://localhost:${PORT}/admin`);
  console.log(`Painel do desenvolvedor: http://localhost:${PORT}/dev`);
});
