'use strict';
/**
 * Registro de eventos (logs) em data/logs.jsonl — uma linha JSON por evento.
 * Níveis: error | warn | info
 * Origens: site | admin | whatsapp | system
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_ENTRIES = 5000;
let file = null;
let entries = [];
let appendedSinceCompact = 0;

function init(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  file = path.join(dataDir, 'logs.jsonl');
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    entries = lines
      .slice(-MAX_ENTRIES)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
    if (lines.length > MAX_ENTRIES) compact();
  }
}

function compact() {
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''));
  appendedSinceCompact = 0;
}

function log(level, source, message, details = {}) {
  const entry = {
    id: crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
    level,
    source,
    message: String(message).slice(0, 500),
    details,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  if (file) {
    try {
      fs.appendFileSync(file, JSON.stringify(entry) + '\n');
      if (++appendedSinceCompact > MAX_ENTRIES) compact();
    } catch (e) {
      console.error('Falha ao gravar log:', e.message);
    }
  }
  if (level === 'error') console.error(`[${entry.ts}] ERRO ${source}: ${entry.message}`);
  return entry;
}

module.exports = {
  init,
  log,
  info: (s, m, d) => log('info', s, m, d),
  warn: (s, m, d) => log('warn', s, m, d),
  error: (s, m, d) => log('error', s, m, d),
  all: () => entries,
};
