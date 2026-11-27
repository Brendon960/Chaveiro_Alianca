'use strict';
/**
 * Supervisor simples: inicia o servidor e o reinicia quando
 *  - o painel do desenvolvedor pede "Reiniciar aplicação" (código de saída 75), ou
 *  - o processo cai inesperadamente (com espera crescente para evitar loop).
 * Uso: npm start  (equivale a: node launcher.js)
 */
const { spawn } = require('child_process');
const path = require('path');

const RESTART_CODE = 75;
let child = null;
let stopping = false;
let crashes = [];

function start() {
  child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
    env: { ...process.env, CA_SUPERVISED: '1' },
  });

  child.on('exit', (code, signal) => {
    if (stopping) return process.exit(0);
    if (code === RESTART_CODE) {
      console.log('\n[launcher] Reiniciando a aplicação...\n');
      return start();
    }
    if (code === 0 && !signal) return process.exit(0);

    const now = Date.now();
    crashes = crashes.filter((t) => now - t < 60_000).concat(now);
    if (crashes.length > 5) {
      console.error('[launcher] A aplicação caiu 5 vezes em 1 minuto. Encerrando.');
      return process.exit(1);
    }
    const wait = 1000 * crashes.length;
    console.error(`[launcher] A aplicação parou (código ${code}${signal ? `, sinal ${signal}` : ''}). Reiniciando em ${wait / 1000}s...`);
    setTimeout(start, wait);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopping = true;
    if (child && child.exitCode === null) child.kill(sig);
    else process.exit(0);
  });
}

start();
