'use strict';
/**
 * Backups do banco de dados (db.json) + imagens enviadas (uploads/).
 * Cada backup é uma pasta em backups/AAAA-MM-DD_HH-MM-SS/.
 */
const fs = require('fs');
const path = require('path');

const KEEP = 14; // quantidade de backups mantidos
let cfg = null;

function init({ dataFile, uploadDir, backupDir }) {
  cfg = { dataFile, uploadDir, backupDir };
  fs.mkdirSync(backupDir, { recursive: true });
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function dirSize(dir) {
  let files = 0, bytes = 0;
  if (!fs.existsSync(dir)) return { files, bytes };
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    files += 1;
    bytes += fs.statSync(path.join(dir, f.name)).size;
  }
  return { files, bytes };
}

function create(reason, user) {
  let name = stamp();
  let dir = path.join(cfg.backupDir, name);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(cfg.backupDir, (name = `${stamp()}_${i}`));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(cfg.dataFile, path.join(dir, 'db.json'));
  if (fs.existsSync(cfg.uploadDir)) fs.cpSync(cfg.uploadDir, path.join(dir, 'uploads'), { recursive: true });
  const { files, bytes } = dirSize(path.join(dir, 'uploads'));
  const meta = {
    name,
    at: new Date().toISOString(),
    reason,
    user: user || null,
    images: files,
    bytes: bytes + fs.statSync(path.join(dir, 'db.json')).size,
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  prune();
  return meta;
}

function list() {
  if (!fs.existsSync(cfg.backupDir)) return [];
  return fs
    .readdirSync(cfg.backupDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(cfg.backupDir, d.name, 'db.json')))
    .map((d) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(cfg.backupDir, d.name, 'meta.json'), 'utf8'));
      } catch {
        return { name: d.name, at: fs.statSync(path.join(cfg.backupDir, d.name)).mtime.toISOString(), reason: '?' };
      }
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

function latest() {
  return list()[0] || null;
}

function prune() {
  for (const b of list().slice(KEEP)) fs.rmSync(path.join(cfg.backupDir, b.name), { recursive: true, force: true });
}

/** Restaura o backup mais recente. Não pode ser desfeito. */
function restoreLatest() {
  const b = latest();
  if (!b) throw new Error('Nenhum backup disponível para restaurar.');
  const dir = path.join(cfg.backupDir, b.name);
  JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8')); // valida antes de sobrescrever
  fs.copyFileSync(path.join(dir, 'db.json'), cfg.dataFile);
  fs.mkdirSync(cfg.uploadDir, { recursive: true });
  for (const f of fs.readdirSync(cfg.uploadDir)) fs.rmSync(path.join(cfg.uploadDir, f), { recursive: true, force: true });
  if (fs.existsSync(path.join(dir, 'uploads'))) fs.cpSync(path.join(dir, 'uploads'), cfg.uploadDir, { recursive: true });
  return b;
}

module.exports = { init, create, list, latest, restoreLatest };
