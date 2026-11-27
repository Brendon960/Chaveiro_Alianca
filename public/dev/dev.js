(() => {
  'use strict';

  /* ============================== Utilitários ============================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }

  let toastTimer;
  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-error', isError);
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 3600);
  }

  async function api(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) { showOnly('login-view'); throw new Error(data.error || 'Sessão expirada.'); }
    if (res.status === 403 && data.mustChangePassword) { showOnly('password-view'); throw new Error(data.error); }
    if (res.status === 403 && url.startsWith('/api/dev')) { showOnly('denied-view'); throw new Error(data.error); }
    if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }

  function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
    return new Promise((resolve) => {
      const close = (v) => { dlg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      const ok = h('button', { type: 'button', class: `btn ${danger ? 'btn--red' : 'btn--primary'}`, text: confirmText, onclick: () => close(true) });
      const dlg = h('div', { class: 'dialog' },
        h('div', { class: 'dialog__bg', onclick: () => close(false) }),
        h('div', { class: `dialog__box${danger ? ' is-danger' : ''}`, role: 'alertdialog', 'aria-modal': 'true' },
          h('h2', { text: title }), h('p', { text: message }),
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--outline', text: 'Cancelar', onclick: () => close(false) }), ok)));
      document.addEventListener('keydown', onKey);
      document.body.append(dlg);
      (danger ? $('.btn--outline', dlg) : ok).focus();
    });
  }

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');
  const ago = (iso) => {
    if (!iso) return 'nunca';
    const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'agora há pouco';
    if (s < 3600) return `há ${Math.round(s / 60)} min`;
    if (s < 86400) return `há ${Math.round(s / 3600)} h`;
    return `há ${Math.round(s / 86400)} dia(s)`;
  };
  const LEVEL = { error: 'ERRO', warn: 'AVISO', info: 'INFO' };
  const SOURCE = { site: 'Site', admin: 'Painel admin', whatsapp: 'WhatsApp', system: 'Sistema' };
  const STATUS = { ok: 'OK', warn: 'Atenção', error: 'Falha' };
  const pageHead = (title, desc, ...actions) =>
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: title }), desc ? h('p', { text: desc }) : null), actions.length ? h('div', { class: 'actions' }, actions) : null);

  /* ============================== Visão geral ============================== */
  async function renderOverview() {
    const o = await api('GET', '/api/dev/overview');
    $('#maint-alert').hidden = !o.maintenance;
    const b = o.lastBackup;
    return h('div', {},
      pageHead('Visão geral', `Aplicação no ar desde ${fmtDate(o.system.startedAt)} · Node ${o.system.node} · ${o.system.memoryMb} MB de memória`,
        h('button', { class: 'btn btn--outline', text: 'Atualizar', onclick: () => go('geral') })),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'stat__label', text: 'Status do site' }),
          h('span', { class: 'stat__value' }, h('span', { class: `dot ${o.maintenance ? 'dot--error' : 'dot--ok'}` }), o.maintenance ? 'Em manutenção' : 'Online'),
          h('span', { class: 'stat__sub', text: o.maintenance ? 'Visitantes veem a página de aviso' : 'Visitantes veem o site normalmente' })),
        h('div', { class: `stat${o.counts.error ? ' stat--error' : ''}` }, h('span', { class: 'stat__label', text: 'Erros (24 h)' }),
          h('span', { class: 'stat__value', text: String(o.counts.error) }), h('span', { class: 'stat__sub', text: 'Nível ERRO' })),
        h('div', { class: `stat${o.counts.warn ? ' stat--warn' : ''}` }, h('span', { class: 'stat__label', text: 'Avisos (24 h)' }),
          h('span', { class: 'stat__value', text: String(o.counts.warn) }), h('span', { class: 'stat__sub', text: 'Nível AVISO' })),
        h('div', { class: 'stat' }, h('span', { class: 'stat__label', text: 'Último backup' }),
          h('span', { class: 'stat__value', text: b ? ago(b.at) : 'Nenhum' }),
          h('span', { class: 'stat__sub', text: b ? `${fmtDate(b.at)} · ${b.reason}` : 'Gere um backup em Manutenção' })),
        h('div', { class: 'stat' }, h('span', { class: 'stat__label', text: 'Cliques no WhatsApp (24 h)' }),
          h('span', { class: 'stat__value', text: String(o.counts.whatsapp) }), h('span', { class: 'stat__sub', text: 'Pedidos de orçamento iniciados' }))
      ),
      h('div', { class: 'cols' },
        h('div', { class: 'card' },
          h('div', { class: 'card__head' }, h('h2', { text: 'Checagem de saúde' })),
          h('div', { class: 'health' }, o.health.map((c) =>
            h('div', { class: 'health__item' },
              h('span', { class: `dot dot--${c.status}` }),
              h('div', {}, h('strong', { text: c.label }), h('span', { text: c.detail })),
              h('span', { class: `health__badge health__badge--${c.status}`, text: STATUS[c.status] }))))),
        h('div', { class: 'card' },
          h('div', { class: 'card__head' }, h('h2', { text: 'Erros e avisos recentes' }),
            h('button', { class: 'btn btn--sm btn--outline', text: 'Ver todos os logs', onclick: () => { logState.level = ''; go('logs'); } })),
          o.recent.length
            ? h('div', { class: 'health' }, o.recent.map((e) =>
                h('div', { class: 'health__item', style: 'grid-template-columns:auto 1fr; cursor:pointer', onclick: () => showLog(e) },
                  h('span', { class: `lvl lvl--${e.level}`, text: LEVEL[e.level] }),
                  h('div', {}, h('strong', { text: e.message }), h('span', { text: `${fmtDate(e.ts)} · ${SOURCE[e.source] || e.source}` })))))
            : h('p', { class: 'hint', text: 'Nenhum erro ou aviso registrado.' }))
      )
    );
  }

  /* ============================== Logs ============================== */
  const logState = { level: '', source: '', q: '', page: 0 };
  const PAGE = 50;
  let LOGS = [];

  function filteredLogs() {
    const q = logState.q.trim().toLowerCase();
    return LOGS.filter((e) =>
      (!logState.level || e.level === logState.level) &&
      (!logState.source || e.source === logState.source) &&
      (!q || e.message.toLowerCase().includes(q) || JSON.stringify(e.details || {}).toLowerCase().includes(q)));
  }

  function showLog(e) {
    const close = () => drawer.remove();
    const d = e.details || {};
    const drawer = h('div', { class: 'drawer' },
      h('div', { class: 'drawer__bg', onclick: close }),
      h('div', { class: 'drawer__panel' },
        h('div', { class: 'drawer__head' }, h('h2', { text: 'Detalhe do registro' }), h('button', { type: 'button', class: 'btn btn--sm btn--outline', text: 'Fechar', onclick: close })),
        h('div', { class: 'drawer__body' },
          h('dl', { class: 'kv' },
            h('dt', { text: 'Data e hora' }), h('dd', { text: fmtDate(e.ts) }),
            h('dt', { text: 'Nível' }), h('dd', {}, h('span', { class: `lvl lvl--${e.level}`, text: LEVEL[e.level] })),
            h('dt', { text: 'Origem' }), h('dd', { text: SOURCE[e.source] || e.source }),
            h('dt', { text: 'Mensagem' }), h('dd', { text: e.message }),
            d.usuario ? [h('dt', { text: 'Usuário' }), h('dd', { text: d.usuario })] : null,
            d.rota ? [h('dt', { text: 'Rota' }), h('dd', { class: 'mono', text: d.rota })] : null,
            d.arquivo ? [h('dt', { text: 'Arquivo' }), h('dd', { class: 'mono', text: typeof d.arquivo === 'string' ? d.arquivo : JSON.stringify(d.arquivo) })] : null,
            h('dt', { text: 'ID' }), h('dd', { class: 'mono', text: e.id })),
          h('h3', { text: 'Dados técnicos', style: 'margin-top:8px' }),
          h('pre', { class: 'json mono', text: JSON.stringify(d, null, 2) }))));
    document.body.append(drawer);
  }

  function exportCsv(rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['data_hora', 'nivel', 'origem', 'mensagem', 'usuario', 'detalhes'].join(';')].concat(
      rows.map((e) => [fmtDate(e.ts), LEVEL[e.level], SOURCE[e.source] || e.source, e.message, (e.details || {}).usuario || '', JSON.stringify(e.details || {})].map(esc).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `logs-alianca-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`${rows.length} registro(s) exportado(s).`);
  }

  async function renderLogs() {
    LOGS = await api('GET', '/api/dev/logs');
    const tbody = h('tbody');
    const info = h('span');
    const prev = h('button', { class: 'btn btn--sm btn--outline', text: '← Anteriores' });
    const next = h('button', { class: 'btn btn--sm btn--outline', text: 'Próximos →' });

    const fill = () => {
      const rows = filteredLogs();
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      logState.page = Math.min(logState.page, pages - 1);
      const slice = rows.slice(logState.page * PAGE, (logState.page + 1) * PAGE);
      tbody.replaceChildren(...(slice.length
        ? slice.map((e) => h('tr', { class: 'is-click', onclick: () => showLog(e), tabindex: 0, onkeydown: (ev) => { if (ev.key === 'Enter') showLog(e); } },
            h('td', { class: 'ts mono', text: fmtDate(e.ts) }),
            h('td', {}, h('span', { class: `lvl lvl--${e.level}`, text: LEVEL[e.level] })),
            h('td', { class: 'src', text: SOURCE[e.source] || e.source }),
            h('td', { text: e.message })))
        : [h('tr', { class: 'empty-row' }, h('td', { colspan: 4, text: 'Nenhum registro encontrado com esses filtros.' }))]));
      info.textContent = `${rows.length} registro(s) · página ${logState.page + 1} de ${pages}`;
      prev.disabled = logState.page === 0;
      next.disabled = logState.page >= pages - 1;
    };
    prev.onclick = () => { logState.page--; fill(); };
    next.onclick = () => { logState.page++; fill(); };

    const level = h('select', { onchange: (e) => { logState.level = e.target.value; logState.page = 0; fill(); } },
      h('option', { value: '', text: 'Todos os níveis' }), Object.entries(LEVEL).map(([v, t]) => h('option', { value: v, text: t })));
    const source = h('select', { onchange: (e) => { logState.source = e.target.value; logState.page = 0; fill(); } },
      h('option', { value: '', text: 'Todas as origens' }), Object.entries(SOURCE).map(([v, t]) => h('option', { value: v, text: t })));
    const search = h('input', { type: 'search', placeholder: 'Buscar no texto…', oninput: (e) => { logState.q = e.target.value; logState.page = 0; fill(); } });
    level.value = logState.level; source.value = logState.source; search.value = logState.q;

    fill();
    return h('div', {},
      pageHead('Logs', 'Os registros mais recentes aparecem primeiro. Clique em uma linha para ver os detalhes técnicos.',
        h('button', { class: 'btn btn--outline', text: 'Atualizar', onclick: () => go('logs') }),
        h('button', { class: 'btn btn--primary', text: 'Exportar CSV', onclick: () => exportCsv(filteredLogs()) })),
      h('div', { class: 'toolbar' }, level, source, search,
        h('button', { class: 'btn btn--outline', text: 'Limpar filtros', onclick: () => { Object.assign(logState, { level: '', source: '', q: '', page: 0 }); go('logs'); } })),
      h('div', { class: 'logs' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', { text: 'Data e hora' }), h('th', { text: 'Nível' }), h('th', { text: 'Origem' }), h('th', { text: 'Mensagem' }))),
          tbody)),
      h('div', { class: 'pager' }, info, h('div', { class: 'actions' }, prev, next))
    );
  }

  /* ============================== Manutenção ============================== */
  async function runOp({ title, message, confirmText, danger, call, success }) {
    if (!(await confirmDialog({ title, message, confirmText, danger }))) return;
    try {
      const r = await call();
      toast(typeof success === 'function' ? success(r) : success);
      return r;
    } catch (e) { toast(e.message, true); }
  }

  async function renderMaintenance() {
    const [m, backups, o] = await Promise.all([api('GET', '/api/dev/maintenance'), api('GET', '/api/dev/backups'), api('GET', '/api/dev/overview')]);
    $('#maint-alert').hidden = !m.enabled;

    const toggle = h('input', { type: 'checkbox', checked: m.enabled });
    const msg = h('textarea', { rows: 3, maxlength: 1000 });
    msg.value = m.message;
    const frame = h('iframe', { class: 'preview-frame', title: 'Prévia da página de manutenção', src: '/?preview=manutencao' });

    toggle.addEventListener('change', async () => {
      const turningOn = toggle.checked;
      toggle.checked = !turningOn;
      const r = await runOp({
        title: turningOn ? 'Ativar modo manutenção?' : 'Desativar modo manutenção?',
        message: turningOn
          ? 'Os visitantes deixarão de ver o site e verão a página de aviso com o botão de WhatsApp. Os painéis continuam acessíveis.'
          : 'O site voltará a ficar disponível para todos os visitantes.',
        confirmText: turningOn ? 'Ativar manutenção' : 'Desativar',
        danger: turningOn,
        call: () => api('PUT', '/api/dev/maintenance', { enabled: turningOn, message: msg.value }),
        success: turningOn ? 'Modo manutenção ativado.' : 'Site novamente online.',
      });
      if (r) { toggle.checked = r.enabled; $('#maint-alert').hidden = !r.enabled; }
    });

    const autoBackup = h('input', { type: 'checkbox', checked: o.system.autoBackup });
    autoBackup.addEventListener('change', async () => {
      const on = autoBackup.checked;
      autoBackup.checked = !on;
      const r = await runOp({
        title: on ? 'Ativar backup automático?' : 'Desativar backup automático?',
        message: on ? 'Um backup do banco de dados e das imagens será gerado a cada 24 horas.' : 'Nenhum backup será gerado automaticamente.',
        confirmText: on ? 'Ativar' : 'Desativar',
        danger: !on,
        call: () => api('PUT', '/api/dev/settings', { autoBackup: on }),
        success: on ? 'Backup automático ativado.' : 'Backup automático desativado.',
      });
      if (r) autoBackup.checked = r.autoBackup;
    });

    const last = backups[0];
    const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

    return h('div', {},
      pageHead('Manutenção', 'Toda ação pede confirmação e fica registrada nos logs.'),
      h('div', { class: 'cols' },
        h('div', { class: 'card' },
          h('div', { class: 'card__head' }, h('h2', { text: 'Modo manutenção' }),
            h('label', { class: 'switch switch--danger' }, toggle, h('span', { class: 'switch__track' }), h('span', { text: 'Ativo' }))),
          h('p', { class: 'hint', text: 'Visitantes veem uma página de aviso com botão de WhatsApp. Quem está logado nos painéis continua vendo o site normal.' }),
          h('label', {}, 'Mensagem exibida aos visitantes', msg),
          h('div', { class: 'actions', style: 'justify-content:flex-start;margin-top:12px' },
            h('button', {
              class: 'btn btn--primary', text: 'Salvar mensagem',
              onclick: async () => {
                if (!msg.value.trim()) return toast('A mensagem não pode ficar vazia.', true);
                try { await api('PUT', '/api/dev/maintenance', { message: msg.value }); toast('Mensagem salva.'); frame.src = frame.src; } catch (e) { toast(e.message, true); }
              },
            }),
            h('a', { class: 'btn btn--outline', href: '/?preview=manutencao', target: '_blank', rel: 'noopener', text: 'Abrir prévia ↗' }))),
        h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Prévia da página' })), frame)
      ),
      h('h2', { text: 'Ações', style: 'margin:10px 0 14px;font-size:1.1rem' }),
      h('div', { class: 'ops' },
        h('div', { class: 'op' },
          h('h3', { text: 'Limpar cache' }),
          h('p', { text: 'Descarta a página pré-montada e força os navegadores a baixarem CSS e JavaScript atualizados.' }),
          h('button', {
            class: 'btn btn--outline', text: 'Limpar cache',
            onclick: () => runOp({ title: 'Limpar cache?', message: 'A próxima visita montará a página novamente. Não afeta dados.', confirmText: 'Limpar cache', call: () => api('POST', '/api/dev/cache/clear'), success: 'Cache limpo.' }),
          })),
        h('div', { class: 'op' },
          h('h3', { text: 'Gerar backup agora' }),
          h('p', { text: 'Copia o banco de dados e todas as imagens enviadas. São mantidos os 14 backups mais recentes.' }),
          h('button', {
            class: 'btn btn--primary', text: 'Gerar backup',
            onclick: async () => {
              const r = await runOp({ title: 'Gerar backup agora?', message: 'Será criada uma cópia do banco de dados e das imagens.', confirmText: 'Gerar backup', call: () => api('POST', '/api/dev/backup'), success: (b) => `Backup ${b.name} gerado.` });
              if (r) go('manutencao');
            },
          })),
        h('div', { class: 'op op--danger' },
          h('h3', { text: 'Restaurar último backup' }),
          h('p', { text: last ? `Volta o site para o estado de ${fmtDate(last.at)}. Alterações feitas depois serão perdidas.` : 'Nenhum backup disponível.' }),
          h('button', {
            class: 'btn btn--red', text: 'Restaurar backup', disabled: !last,
            onclick: async () => {
              const r = await runOp({
                title: 'Restaurar o último backup?',
                message: `ATENÇÃO: esta ação NÃO pode ser desfeita.\n\nO banco de dados e as imagens voltarão ao estado de ${fmtDate(last.at)}. Tudo o que foi alterado depois disso será perdido (inclusive senhas alteradas).`,
                confirmText: 'Sim, restaurar', danger: true,
                call: () => api('POST', '/api/dev/backup/restore'), success: 'Backup restaurado.',
              });
              if (r) go('manutencao');
            },
          })),
        h('div', { class: 'op op--danger' },
          h('h3', { text: 'Reiniciar aplicação' }),
          h('p', { text: o.system.supervised ? 'Encerra e inicia novamente o servidor. O site fica fora do ar por alguns segundos.' : 'Indisponível: o servidor não foi iniciado pelo supervisor (npm start).' }),
          h('button', {
            class: 'btn btn--red', text: 'Reiniciar', disabled: !o.system.supervised,
            onclick: async () => {
              const r = await runOp({
                title: 'Reiniciar a aplicação?', message: 'O site ficará indisponível por alguns segundos e todos precisarão recarregar a página.',
                confirmText: 'Reiniciar agora', danger: true, call: () => api('POST', '/api/dev/restart'), success: 'Reiniciando… a página será recarregada.',
              });
              if (r) waitRestart();
            },
          }))
      ),
      h('div', { class: 'card', style: 'margin-top:18px' },
        h('div', { class: 'card__head' }, h('h2', { text: 'Backups' }),
          h('label', { class: 'switch' }, autoBackup, h('span', { class: 'switch__track', style: '' }), h('span', { text: 'Backup automático diário' }))),
        backups.length
          ? h('div', { class: 'logs' }, h('table', {},
              h('thead', {}, h('tr', {}, h('th', { text: 'Data' }), h('th', { text: 'Tipo' }), h('th', { text: 'Imagens' }), h('th', { text: 'Tamanho' }), h('th', { text: 'Pasta' }))),
              h('tbody', {}, backups.map((b) => h('tr', {},
                h('td', { text: fmtDate(b.at) }), h('td', { text: b.reason + (b.user ? ` (${b.user})` : '') }),
                h('td', { text: String(b.images ?? '—') }), h('td', { text: b.bytes ? kb(b.bytes) : '—' }),
                h('td', { class: 'mono', text: `backups/${b.name}` }))))))
          : h('p', { class: 'hint', text: 'Nenhum backup gerado ainda.' }))
    );
  }

  function waitRestart() {
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const r = await fetch('/api/site', { cache: 'no-store' });
        if (r.ok && tries > 1) return location.reload();
      } catch { /* ainda reiniciando */ }
      if (tries < 40) setTimeout(tick, 1000);
      else toast('O servidor não voltou. Verifique o processo no servidor.', true);
    };
    setTimeout(tick, 1200);
  }

  /* ============================== Conta ============================== */
  function bindPasswordForm(f, err, onDone) {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (f.next.value !== f.confirm.value) { err.textContent = 'As senhas não conferem.'; err.hidden = false; return; }
      try {
        await api('PUT', '/api/password', { current: f.current.value, next: f.next.value });
        f.reset();
        toast('Senha alterada.');
        onDone && onDone();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  }

  function renderAccount() {
    const err = h('p', { class: 'form-error', hidden: true });
    const f = h('form', { class: 'stack' },
      h('label', {}, 'Senha atual', h('input', { name: 'current', type: 'password', autocomplete: 'current-password', required: true })),
      h('label', {}, 'Nova senha (mínimo 8 caracteres)', h('input', { name: 'next', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
      h('label', {}, 'Repita a nova senha', h('input', { name: 'confirm', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
      err,
      h('div', { class: 'actions', style: 'justify-content:flex-start' }, h('button', { type: 'submit', class: 'btn btn--primary', text: 'Alterar senha' })));
    bindPasswordForm(f, err);
    return h('div', {}, pageHead('Minha conta', 'Perfil Desenvolvedor.'), h('div', { class: 'card', style: 'max-width:520px' }, h('h2', { text: 'Alterar senha' }), f));
  }

  /* ============================== Navegação ============================== */
  const VIEWS = { geral: renderOverview, logs: renderLogs, manutencao: renderMaintenance, conta: renderAccount };
  let currentView = 'geral';

  async function go(view) {
    if (!VIEWS[view]) return;
    currentView = view;
    history.replaceState(null, '', `#${view}`);
    $$('#menu button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    try {
      $('#view').replaceChildren(await VIEWS[view]());
    } catch (e) { toast(e.message, true); }
  }

  function showOnly(id) { ['login-view', 'denied-view', 'password-view', 'app-view'].forEach((v) => ($(`#${v}`).hidden = v !== id)); }

  async function enter() {
    const me = await api('GET', '/api/me');
    if (me.mustChangePassword) return showOnly('password-view');
    if (me.role !== 'developer') return showOnly('denied-view');
    $('#who').textContent = `${me.username} · Desenvolvedor`;
    showOnly('app-view');
    const fromHash = location.hash.slice(1);
    go(VIEWS[fromHash] ? fromHash : 'geral');
  }

  $('#menu').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) go(b.dataset.goto); });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#login-error');
    err.hidden = true;
    try {
      await api('POST', '/api/login', { username: f.username.value, password: f.password.value, area: 'dev' });
      f.reset();
      await enter();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  const fp = $('#first-password-form');
  bindPasswordForm(fp, $('.form-error', fp), enter);

  const logout = async () => { await api('POST', '/api/logout').catch(() => {}); showOnly('login-view'); };
  $('#logout').addEventListener('click', logout);
  $('#denied-logout').addEventListener('click', logout);

  enter().catch(() => {});
})();
