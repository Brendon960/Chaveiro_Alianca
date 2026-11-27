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
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 3400);
  }

  async function api(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) {
      showLogin();
      throw new Error(data.error || 'Sessão expirada.');
    }
    if (res.status === 403 && data.mustChangePassword) {
      showFirstPassword();
      throw new Error(data.error);
    }
    if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const { url } = await api('POST', '/api/admin/upload', fd);
    return url;
  }

  function pickImage(accept) {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept: accept || 'image/jpeg,image/png,image/webp' });
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  /** Diálogo de confirmação. danger=true destaca em vermelho. */
  function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
    return new Promise((resolve) => {
      const close = (v) => { dlg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      const ok = h('button', { type: 'button', class: `btn ${danger ? 'btn--red' : 'btn--primary'}`, text: confirmText, onclick: () => close(true) });
      const dlg = h('div', { class: 'dialog' },
        h('div', { class: 'dialog__bg', onclick: () => close(false) }),
        h('div', { class: `dialog__box${danger ? ' is-danger' : ''}`, role: 'alertdialog', 'aria-modal': 'true' },
          h('h2', { text: title }),
          h('p', { text: message }),
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--outline', text: 'Cancelar', onclick: () => close(false) }), ok)
        )
      );
      document.addEventListener('keydown', onKey);
      document.body.append(dlg);
      ok.focus();
    });
  }

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const isPlaceholder = (s) => /^\[.*\]$/.test(String(s || '').trim());

  /* ============================== Estado ============================== */
  let DATA = null;
  let currentView = 'servicos';
  const ui = { productQuery: '', productCat: '' };

  async function loadData() {
    DATA = await api('GET', '/api/admin/data');
    $('#wa-alert').hidden = /^\d{12,13}$/.test(DATA.settings.whatsapp || '');
  }
  const catName = (id) => (DATA.categories.find((c) => c.id === id) || {}).name || '—';

  /* ============================== Campos de formulário ============================== */
  /**
   * Tipos: text, textarea, url, email, checkbox, select, image, price.
   * Retorna { el, values(), validate() }.
   */
  function buildFields(fields, values) {
    const getters = {};
    const validators = [];
    const el = h('div', { class: 'stack' });

    for (const f of fields) {
      if (f.type === 'group') {
        const inner = buildFields(f.fields, values);
        Object.assign(getters, inner.getters);
        validators.push(inner.validate);
        el.append(h('div', { class: f.cols === 2 ? 'grid-2' : 'stack' }, inner.el));
        continue;
      }
      const v = values[f.key];
      let field, get;

      switch (f.type) {
        case 'textarea': {
          const input = h('textarea', { rows: f.rows || 3, maxlength: f.max || 1500, placeholder: f.placeholder || '' });
          input.value = v || '';
          field = input;
          get = () => input.value;
          break;
        }
        case 'checkbox': {
          const input = h('input', { type: 'checkbox', checked: !!v });
          getters[f.key] = () => input.checked;
          el.append(h('label', { class: 'check' }, input, h('span', {}, f.label, f.hint ? h('small', { text: ` — ${f.hint}` }) : null)));
          continue;
        }
        case 'select': {
          const opts = typeof f.options === 'function' ? f.options() : f.options;
          const input = h('select', {}, opts.map((o) => h('option', { value: o.value, text: o.label })));
          input.value = v ?? opts[0].value;
          field = input;
          get = () => input.value;
          break;
        }
        case 'price': {
          const input = h('input', { inputmode: 'decimal', placeholder: '[PREÇO] — ex.: 150,00. Vazio = "Preço sob consulta"' });
          input.value = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '';
          field = h('div', { class: 'prefix' }, h('span', { text: 'R$' }), input);
          get = () => input.value.trim();
          break;
        }
        case 'image': {
          let url = v || '';
          const preview = h('div', { class: 'imgfield__preview' });
          const removeBtn = h('button', { type: 'button', class: 'btn btn--sm btn--danger', text: 'Remover' });
          const sync = () => {
            preview.style.backgroundImage = url ? `url("${url}")` : '';
            preview.textContent = url ? '' : 'Sem imagem';
            removeBtn.hidden = !url || url === f.fallback;
            preview.dispatchEvent(new Event('input', { bubbles: true }));
          };
          const upBtn = h('button', {
            type: 'button', class: 'btn btn--sm btn--outline', text: url ? 'Trocar imagem' : 'Enviar imagem',
            onclick: async () => {
              const file = await pickImage(f.accept);
              if (!file) return;
              upBtn.disabled = true;
              upBtn.textContent = 'Enviando…';
              try { url = await uploadFile(file); sync(); } catch (e) { toast(e.message, true); }
              upBtn.disabled = false;
              upBtn.textContent = url ? 'Trocar imagem' : 'Enviar imagem';
            },
          });
          removeBtn.addEventListener('click', () => { url = f.fallback || ''; sync(); });
          field = h('div', { class: 'imgfield' }, preview, h('div', { class: 'imgfield__btns' }, upBtn, removeBtn));
          queueMicrotask(sync);
          get = () => url;
          break;
        }
        default: {
          const input = h('input', { type: f.type || 'text', maxlength: f.max || 300, placeholder: f.placeholder || '' });
          input.value = Array.isArray(v) ? v.join(', ') : v || '';
          field = input;
          get = () => input.value;
        }
      }

      getters[f.key] = get;
      const err = h('span', { class: 'field-error', hidden: true });
      const label = h('label', {}, h('span', {}, f.label, f.required ? h('b', { class: 'req', text: ' *' }) : ''), field, f.hint ? h('span', { class: 'hint', text: f.hint }) : null, err);
      if (f.required) {
        validators.push(() => {
          const ok = String(get() || '').trim().length > 0;
          err.hidden = ok;
          err.textContent = ok ? '' : `${f.label.replace(/\s*\(.*\)/, '')} é obrigatório.`;
          label.classList.toggle('has-error', !ok);
          if (!ok) (field.focus ? field : $('input', field) || field).focus();
          return ok;
        });
      }
      el.append(label);
    }
    return {
      el,
      getters,
      values: () => Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()])),
      validate: () => validators.map((fn) => fn()).every(Boolean),
    };
  }

  /* ============================== Formulário lateral ============================== */
  function openDrawer({ title, fields, values, onSave, onDelete, preview, wide }) {
    const form = buildFields(fields, values);
    const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Salvar' });
    const close = () => { drawer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    let previewBox = null;
    if (preview) {
      previewBox = h('div', { class: 'live-preview' });
      const update = () => previewBox.replaceChildren(h('span', { class: 'live-preview__label', text: 'Prévia no site' }), preview(form.values()));
      form.el.addEventListener('input', update);
      form.el.addEventListener('change', update);
      queueMicrotask(update);
    }

    const drawer = h('div', { class: 'drawer' },
      h('div', { class: 'drawer__bg', onclick: close }),
      h('form', {
        class: `drawer__panel${wide ? ' drawer__panel--wide' : ''}`,
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          if (!form.validate()) return toast('Verifique os campos obrigatórios.', true);
          saveBtn.disabled = true;
          try { await onSave(form.values()); close(); } catch (err) { toast(err.message, true); }
          saveBtn.disabled = false;
        },
      },
        h('div', { class: 'drawer__head' }, h('h2', { text: title }), h('button', { type: 'button', class: 'btn btn--sm btn--outline', text: 'Fechar', onclick: close })),
        h('div', { class: `drawer__body${preview ? ' drawer__body--split' : ''}` }, form.el, previewBox),
        h('div', { class: 'drawer__foot actions' },
          onDelete ? h('button', { type: 'button', class: 'btn btn--danger', text: 'Remover', style: 'margin-right:auto', onclick: async () => { if (await onDelete()) close(); } }) : null,
          h('button', { type: 'button', class: 'btn btn--outline', text: 'Cancelar', onclick: close }),
          saveBtn
        )
      )
    );
    document.addEventListener('keydown', onKey);
    document.body.append(drawer);
    const first = $('input:not([type=checkbox]), textarea', drawer);
    if (first) first.focus();
  }

  /* ============================== Ações comuns ============================== */
  async function removeItem(key, item, label) {
    const name = item.title || item.name;
    const ok = await confirmDialog({
      title: `Remover ${label}?`,
      message: `"${name}" será removido(a) definitivamente. Para apenas tirar do site, use "Ocultar".`,
      confirmText: 'Remover',
      danger: true,
    });
    if (!ok) return false;
    try {
      await api('DELETE', `/api/admin/${key}/${item.id}`);
      toast(`${label[0].toUpperCase() + label.slice(1)} removido(a).`);
      await refresh();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  async function toggleItem(key, item) {
    try {
      await api('PUT', `/api/admin/${key}/${item.id}`, { ...item, active: !item.active });
      toast(item.active ? 'Ocultado do site (não foi apagado).' : 'Agora está visível no site.');
      await refresh();
    } catch (e) { toast(e.message, true); }
  }

  async function moveItem(key, list, i, dir) {
    const ids = list.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api('PUT', `/api/admin/${key}/reorder`, { ids }); await refresh(); } catch (e) { toast(e.message, true); }
  }

  const statusPill = (item, key) =>
    h('button', {
      type: 'button', class: `pill ${item.active ? 'pill--on' : 'pill--off'}`, title: 'Clique para alternar',
      text: item.active ? 'Visível' : 'Oculto', onclick: () => toggleItem(key, item),
    });

  const pageHead = (title, desc, ...actions) =>
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: title }), desc ? h('p', { text: desc }) : null), actions.length ? h('div', { class: 'actions' }, actions) : null);

  /* ============================== Serviços ============================== */
  const SERVICE_FIELDS = [
    { key: 'image', label: 'Imagem', type: 'image', accept: 'image/jpeg,image/png,image/webp', hint: 'Foto real de chave, controle ou equipamento. Proporção 3:2 (ex.: 1200×800).' },
    { key: 'title', label: 'Título', required: true, max: 120 },
    { key: 'description', label: 'Descrição', type: 'textarea', max: 1200 },
    { key: 'whatsappService', label: 'Texto de "Serviço desejado" na mensagem do WhatsApp', max: 120, hint: 'Se ficar vazio, usa o título.' },
    { key: 'active', label: 'Exibir no site', type: 'checkbox' },
    { key: 'highlight', label: 'Destaque', type: 'checkbox', hint: 'bloco maior com passo a passo' },
  ];

  function editService(item) {
    openDrawer({
      title: item ? 'Editar serviço' : 'Novo serviço',
      fields: SERVICE_FIELDS,
      values: item || { active: true, highlight: false },
      onSave: async (vals) => {
        if (item) await api('PUT', `/api/admin/services/${item.id}`, vals);
        else await api('POST', '/api/admin/services', vals);
        toast('Serviço salvo.');
        await refresh();
      },
      onDelete: item ? () => removeItem('services', item, 'serviço') : null,
    });
  }

  function renderServices() {
    const list = DATA.services;
    return h('div', {},
      pageHead('Serviços', 'A ordem desta lista é a ordem do site. Serviços ocultos não aparecem para os visitantes.',
        h('button', { class: 'btn btn--primary', text: '+ Novo serviço', onclick: () => editService(null) })),
      h('div', { class: 'table' },
        h('div', { class: 'table__head' }, h('span', { text: 'Ordem' }), h('span', { text: 'Imagem' }), h('span', { text: 'Título' }), h('span', { text: 'Status' }), h('span', { text: 'Ações' })),
        list.map((s, i) =>
          h('div', { class: `table__row${s.active ? '' : ' is-off'}` },
            h('span', { class: 'order' },
              h('button', { class: 'btn btn--sm btn--outline btn--icon', title: 'Subir', 'aria-label': 'Subir', text: '↑', disabled: i === 0, onclick: () => moveItem('services', list, i, -1) }),
              h('b', { text: String(i + 1) }),
              h('button', { class: 'btn btn--sm btn--outline btn--icon', title: 'Descer', 'aria-label': 'Descer', text: '↓', disabled: i === list.length - 1, onclick: () => moveItem('services', list, i, 1) })),
            h('img', { class: 'row__thumb', src: s.image || '/img/servicos/padrao.svg', alt: '' }),
            h('span', { class: 'row__info' }, h('strong', { text: s.title }), s.highlight ? h('span', { class: 'pill pill--star', text: 'Destaque' }) : null),
            h('span', {}, statusPill(s, 'services')),
            h('span', { class: 'row__tools' },
              h('button', { class: 'btn btn--sm btn--outline', text: 'Editar', onclick: () => editService(s) }),
              h('button', { class: 'btn btn--sm btn--danger', text: 'Remover', onclick: () => removeItem('services', s, 'serviço') }))
          )
        )
      )
    );
  }

  /* ============================== Produtos ============================== */
  const productFields = () => [
    { key: 'image', label: 'Foto do produto', type: 'image', accept: 'image/jpeg,image/png', hint: 'JPG ou PNG, de preferência quadrada (ex.: 1000×1000).' },
    { key: 'name', label: 'Nome do produto', required: true, max: 120 },
    { key: 'category', label: 'Categoria', type: 'select', options: () => DATA.categories.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'description', label: 'Descrição', type: 'textarea', max: 1500 },
    { key: 'price', label: 'Preço (opcional)', type: 'price' },
    { key: 'showPrice', label: 'Mostrar preço no site', type: 'checkbox', hint: 'desmarcado = "Preço sob consulta"' },
    { key: 'active', label: 'Produto visível no catálogo', type: 'checkbox' },
  ];

  function priceOf(vals) {
    let s = String(vals.price ?? '').replace(/[^\d,.]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function productPreview(vals) {
    const price = priceOf(vals);
    return h('article', { class: `pv-product${vals.active ? '' : ' is-off'}` },
      h('div', { class: 'pv-product__media' }, vals.image ? h('img', { src: vals.image, alt: '' }) : h('span', { text: 'Sem foto' })),
      h('div', { class: 'pv-product__body' },
        h('span', { class: 'pv-product__cat', text: catName(vals.category) }),
        h('h3', { class: !vals.name ? 'is-empty' : null, text: vals.name || 'Nome do produto' }),
        h('p', { text: vals.description || '' }),
        vals.showPrice && price != null
          ? h('div', { class: 'pv-product__price', text: money.format(price) })
          : h('div', { class: 'pv-product__price is-ask', text: 'Preço sob consulta' }),
        h('span', { class: 'pv-product__btn', text: 'Consultar no WhatsApp' })
      ),
      vals.active ? null : h('div', { class: 'pv-product__hidden', text: 'Oculto — não aparece no site' })
    );
  }

  function editProduct(item) {
    openDrawer({
      title: item ? 'Editar produto' : 'Novo produto',
      fields: productFields(),
      values: item || { active: true, showPrice: true, category: ui.productCat || DATA.categories[0].id },
      preview: productPreview,
      wide: true,
      onSave: async (vals) => {
        if (item) await api('PUT', `/api/admin/products/${item.id}`, vals);
        else await api('POST', '/api/admin/products', vals);
        toast(item ? 'Produto atualizado.' : 'Produto adicionado ao catálogo.');
        await refresh();
      },
      onDelete: item ? () => removeItem('products', item, 'produto') : null,
    });
  }

  function productCard(p) {
    const price = typeof p.price === 'number' ? money.format(p.price) : null;
    return h('article', { class: `pcard${p.active ? '' : ' is-off'}` },
      h('div', { class: 'pcard__media' },
        p.image ? h('img', { src: p.image, alt: '', loading: 'lazy' }) : h('span', { text: 'Sem foto' }),
        h('span', { class: `pill ${p.active ? 'pill--on' : 'pill--off'} pcard__status`, text: p.active ? 'Visível' : 'Oculto' })),
      h('div', { class: 'pcard__body' },
        h('span', { class: 'pcard__cat', text: catName(p.category) }),
        h('strong', { class: 'pcard__name', text: p.name }),
        p.description ? h('p', { class: 'pcard__desc', text: p.description }) : null,
        h('span', { class: 'pcard__price' },
          price && p.showPrice ? price : price ? `${price} · oculto no site` : 'Preço sob consulta')),
      h('div', { class: 'pcard__actions' },
        h('button', { class: 'btn btn--sm btn--outline', text: 'Editar', onclick: () => editProduct(p) }),
        h('button', { class: 'btn btn--sm btn--outline', text: p.active ? 'Ocultar' : 'Exibir', onclick: () => toggleItem('products', p) }),
        h('button', { class: 'btn btn--sm btn--danger', text: 'Remover', onclick: () => removeItem('products', p, 'produto') }))
    );
  }

  function manageCategories() {
    const close = () => drawer.remove();
    const body = h('div', { class: 'drawer__body' });
    const render = () => {
      const counts = Object.fromEntries(DATA.categories.map((c) => [c.id, DATA.products.filter((p) => p.category === c.id).length]));
      const input = h('input', { placeholder: 'Nome da nova categoria', maxlength: 60 });
      body.replaceChildren(
        h('p', { class: 'hint', text: 'Uma categoria só pode ser removida quando nenhum produto a utiliza.' }),
        h('div', { class: 'list' }, DATA.categories.map((c) =>
          h('div', { class: 'row' },
            h('div', { class: 'row__info' }, h('strong', { text: c.name }), h('span', { text: `${counts[c.id]} produto(s)` })),
            h('button', {
              class: 'btn btn--sm btn--danger', text: 'Remover', disabled: counts[c.id] > 0 || DATA.categories.length === 1,
              onclick: async () => {
                if (!(await confirmDialog({ title: 'Remover categoria?', message: `A categoria "${c.name}" será removida.`, confirmText: 'Remover', danger: true }))) return;
                try { await api('DELETE', `/api/admin/categories/${c.id}`); toast('Categoria removida.'); await refresh(); render(); } catch (e) { toast(e.message, true); }
              },
            })))),
        h('form', {
          class: 'inline-form',
          onsubmit: async (e) => {
            e.preventDefault();
            if (!input.value.trim()) return input.focus();
            try { await api('POST', '/api/admin/categories', { name: input.value }); toast('Categoria adicionada.'); await refresh(); render(); } catch (err) { toast(err.message, true); }
          },
        }, input, h('button', { type: 'submit', class: 'btn btn--primary', text: 'Adicionar' }))
      );
    };
    render();
    const drawer = h('div', { class: 'drawer' },
      h('div', { class: 'drawer__bg', onclick: close }),
      h('div', { class: 'drawer__panel' },
        h('div', { class: 'drawer__head' }, h('h2', { text: 'Categorias' }), h('button', { type: 'button', class: 'btn btn--sm btn--outline', text: 'Fechar', onclick: close })),
        body));
    document.body.append(drawer);
  }

  function renderProducts() {
    const grid = h('div', { class: 'pgrid' });
    const count = h('span', { class: 'hint' });
    const fill = () => {
      const q = ui.productQuery.trim().toLowerCase();
      const list = DATA.products.filter((p) => (!ui.productCat || p.category === ui.productCat) && (!q || p.name.toLowerCase().includes(q)));
      count.textContent = `${list.length} de ${DATA.products.length} produto(s)`;
      grid.replaceChildren(
        h('button', { type: 'button', class: 'pcard pcard--new', onclick: () => editProduct(null) }, h('span', { class: 'pcard__plus', text: '+' }), h('strong', { text: 'Novo produto' })),
        ...list.map(productCard),
        !list.length && DATA.products.length ? h('p', { class: 'hint pgrid__empty', text: 'Nenhum produto encontrado com esses filtros.' }) : null
      );
    };
    const search = h('input', { type: 'search', placeholder: 'Buscar por nome…', value: ui.productQuery, oninput: (e) => { ui.productQuery = e.target.value; fill(); } });
    const cat = h('select', { onchange: (e) => { ui.productCat = e.target.value; fill(); } },
      h('option', { value: '', text: 'Todas as categorias' }),
      DATA.categories.map((c) => h('option', { value: c.id, text: c.name })));
    cat.value = ui.productCat;
    fill();
    return h('div', {},
      pageHead('Produtos', 'Catálogo secundário. Sem carrinho: o cliente consulta pelo WhatsApp. Alterações aparecem no site imediatamente.',
        h('button', { class: 'btn btn--outline', text: 'Gerenciar categorias', onclick: manageCategories }),
        h('button', { class: 'btn btn--primary', text: '+ Adicionar produto', onclick: () => editProduct(null) })),
      h('div', { class: 'toolbar' }, search, cat, count),
      grid
    );
  }

  /* ============================== Textos do site ============================== */
  function pairsFields(key, labels) {
    return labels.map((lab, i) => ({
      type: 'group', cols: 2,
      fields: [
        { key: `${key}.${i}.title`, label: `${lab} — título`, max: 120 },
        { key: `${key}.${i}.text`, label: `${lab} — texto`, max: 400 },
      ],
    }));
  }

  const TEXT_SECTIONS = [
    {
      title: 'Banner principal (hero)',
      fields: [
        { key: 'heroEyebrow', label: 'Chamada acima do título' },
        { key: 'heroTitle', label: 'Título', max: 200 },
        { key: 'heroSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 },
        { type: 'group', cols: 2, fields: [
          { key: 'heroPrimaryButton', label: 'Botão principal (WhatsApp)' },
          { key: 'heroSecondaryButton', label: 'Botão secundário (rola até Serviços)' },
        ] },
        { key: 'heroImage', label: 'Imagem do banner', type: 'image', fallback: '/img/hero-chave-inteligente.svg', hint: 'Foto profissional de chave inteligente, controle ou equipamento de codificação. "Remover" volta para a ilustração padrão.' },
      ],
    },
    { title: 'Serviços', fields: [{ key: 'servicesEyebrow', label: 'Chamada' }, { key: 'servicesTitle', label: 'Título' }, { key: 'servicesSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 }] },
    { title: 'Passo a passo (também usado no serviço em destaque)', fields: [{ key: 'stepsTitle', label: 'Título da seção' }, ...pairsFields('steps', ['Passo 1', 'Passo 2', 'Passo 3'])] },
    { title: 'Orçamento rápido', fields: [{ key: 'quickEyebrow', label: 'Chamada' }, { key: 'quickTitle', label: 'Título' }, { key: 'quickSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 }] },
    { title: 'Diferenciais', fields: [{ key: 'differentialsTitle', label: 'Título' }, ...pairsFields('differentials', ['Diferencial 1', 'Diferencial 2', 'Diferencial 3', 'Diferencial 4'])] },
    { title: 'Catálogo', fields: [{ key: 'catalogEyebrow', label: 'Chamada' }, { key: 'catalogTitle', label: 'Título' }, { key: 'catalogSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 }] },
    { title: 'Faixa final (amarela)', fields: [{ key: 'ctaTitle', label: 'Título' }, { key: 'ctaText', label: 'Texto', type: 'textarea', rows: 2 }, { key: 'ctaButton', label: 'Texto do botão' }] },
    {
      title: 'Contato e rodapé',
      fields: [
        { key: 'contactEyebrow', label: 'Chamada' }, { key: 'contactTitle', label: 'Título' },
        { key: 'contactSubtitle', label: 'Subtítulo', type: 'textarea', rows: 2 },
        { key: 'footerText', label: 'Texto do rodapé', type: 'textarea', rows: 2 },
      ],
    },
    {
      title: 'Google (SEO)',
      fields: [
        { key: 'seoTitle', label: 'Título da página', hint: 'Aba do navegador e resultados do Google (ideal até 60 caracteres).' },
        { key: 'seoDescription', label: 'Descrição', type: 'textarea', rows: 2, hint: 'Ideal entre 120 e 160 caracteres.' },
      ],
    },
  ];

  function flatten(texts) {
    const flat = { ...texts };
    for (const k of ['steps', 'differentials']) (texts[k] || []).forEach((it, i) => { flat[`${k}.${i}.title`] = it.title; flat[`${k}.${i}.text`] = it.text; });
    return flat;
  }
  function unflatten(vals) {
    const out = {};
    for (const [k, v] of Object.entries(vals)) {
      const m = k.match(/^(\w+)\.(\d+)\.(title|text)$/);
      if (m) {
        out[m[1]] = out[m[1]] || [];
        out[m[1]][m[2]] = out[m[1]][m[2]] || {};
        out[m[1]][m[2]][m[3]] = v;
      } else out[k] = v;
    }
    return out;
  }

  function renderTexts() {
    const flat = flatten(DATA.texts);
    const forms = TEXT_SECTIONS.map((sec) => ({ sec, form: buildFields(sec.fields, flat) }));
    const save = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Salvar textos' });
    return h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true;
        const vals = Object.assign({}, ...forms.map((f) => f.form.values()));
        try {
          await api('PUT', '/api/admin/texts', { ...DATA.texts, ...unflatten(vals) });
          toast('Textos salvos. Já estão no site.');
          await refresh();
        } catch (err) { toast(err.message, true); }
        save.disabled = false;
      },
    },
      pageHead('Textos do site', 'Edite os textos de cada seção. Serviços e produtos têm abas próprias.'),
      forms.map(({ sec, form }) => h('div', { class: 'card' }, h('h2', { text: sec.title }), form.el)),
      h('div', { class: 'sticky-actions actions' }, save)
    );
  }

  /* ============================== Contato e WhatsApp ============================== */
  function renderContact() {
    const waForm = buildFields([
      { key: 'whatsapp', label: 'Número do WhatsApp', placeholder: '[NÚMERO DO WHATSAPP] — ex.: 5531999999999', hint: 'Somente números: 55 (Brasil) + DDD + número. Recebe todas as mensagens de orçamento do site.' },
    ], DATA.settings);
    const msgForm = buildFields([
      { key: 'whatsappIntro', label: 'Mensagem padrão do orçamento', type: 'textarea', rows: 2, max: 500, hint: 'O site acrescenta: Marca do veículo, Modelo, Ano e Serviço desejado.' },
    ], DATA.texts);
    const msgPreview = h('pre', { class: 'wa-preview' });
    const updateMsg = () => {
      msgPreview.textContent = `${msgForm.values().whatsappIntro}\n\nMarca do veículo:\nModelo:\nAno:\nServiço desejado:`;
    };
    msgForm.el.addEventListener('input', updateMsg);
    updateMsg();

    const addrForm = buildFields([
      { key: 'address', label: 'Endereço', type: 'textarea', rows: 2, max: 400, placeholder: '[ENDEREÇO]' },
      { key: 'city', label: 'Cidade / UF' },
      { key: 'mapsUrl', label: 'Link do Google Maps (opcional)', type: 'url', placeholder: 'https://maps.app.goo.gl/...' },
      { key: 'hours', label: 'Horário de atendimento', type: 'textarea', rows: 3, max: 400, placeholder: '[HORÁRIO] — ex.: Segunda a sexta: 8h às 18h' },
    ], DATA.settings);
    const otherForm = buildFields([
      { type: 'group', cols: 2, fields: [
        { key: 'phone', label: 'Telefone fixo (opcional)', placeholder: '(31) 3333-3333' },
        { key: 'email', label: 'E-mail (opcional)', type: 'email' },
      ] },
      { type: 'group', cols: 2, fields: [
        { key: 'instagram', label: 'Instagram (link)', type: 'url', placeholder: 'https://instagram.com/...' },
        { key: 'facebook', label: 'Facebook (link)', type: 'url', placeholder: 'https://facebook.com/...' },
      ] },
      { key: 'businessName', label: 'Nome da empresa', required: true },
      { key: 'logo', label: 'Logotipo (opcional)', type: 'image', accept: 'image/png,image/jpeg,image/webp', hint: 'PNG com fundo transparente ou branco.' },
    ], DATA.settings);

    const testBtn = h('button', {
      type: 'button', class: 'btn btn--outline', text: 'Testar número no WhatsApp',
      onclick: () => {
        const n = waForm.values().whatsapp.replace(/\D/g, '');
        if (!n) return toast('Informe o número primeiro.', true);
        window.open(`https://wa.me/${n}?text=${encodeURIComponent('Teste do site Chaveiro Aliança BH')}`, '_blank', 'noopener');
      },
    });
    const save = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Salvar' });

    return h('form', {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        if (!otherForm.validate()) return toast('Verifique os campos obrigatórios.', true);
        const vals = { ...waForm.values(), ...addrForm.values(), ...otherForm.values() };
        const digits = vals.whatsapp.replace(/\D/g, '');
        if (digits && (digits.length < 12 || digits.length > 13)) {
          return toast('WhatsApp inválido. Use 55 + DDD + número, ex.: 5531999999999.', true);
        }
        save.disabled = true;
        try {
          await api('PUT', '/api/admin/settings', vals);
          if (msgForm.values().whatsappIntro !== DATA.texts.whatsappIntro) {
            await api('PUT', '/api/admin/texts', { ...DATA.texts, whatsappIntro: msgForm.values().whatsappIntro });
          }
          toast('Informações salvas.');
          await refresh();
        } catch (err) { toast(err.message, true); }
        save.disabled = false;
      },
    },
      pageHead('Contato e WhatsApp', 'Campos com colchetes, como [ENDEREÇO], aparecem assim no site até serem preenchidos com a informação confirmada.'),
      h('div', { class: 'card' }, h('h2', { text: 'WhatsApp' }), waForm.el, h('div', { class: 'actions', style: 'justify-content:flex-start;margin:12px 0 18px' }, testBtn), msgForm.el,
        h('span', { class: 'hint', text: 'Prévia da mensagem:' }), msgPreview),
      h('div', { class: 'card' }, h('h2', { text: 'Endereço e horário de atendimento' }), addrForm.el),
      h('div', { class: 'card' }, h('h2', { text: 'Outros contatos e identidade' }), otherForm.el),
      h('div', { class: 'sticky-actions actions' }, save)
    );
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
    return h('div', {},
      pageHead('Minha conta', 'Ao trocar a senha, suas outras sessões abertas são encerradas.'),
      h('div', { class: 'card', style: 'max-width:520px' }, h('h2', { text: 'Alterar senha' }), f));
  }

  /* ============================== Navegação ============================== */
  const VIEWS = {
    servicos: renderServices,
    produtos: renderProducts,
    textos: renderTexts,
    contato: renderContact,
    conta: renderAccount,
  };

  function render() {
    $$('#menu button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === currentView));
    $('#view').replaceChildren(VIEWS[currentView]());
  }
  async function refresh() { await loadData(); render(); }
  function go(view) {
    if (!VIEWS[view]) return;
    currentView = view;
    history.replaceState(null, '', `#${view}`);
    render();
    window.scrollTo(0, 0);
  }

  function showOnly(id) { ['login-view', 'password-view', 'app-view'].forEach((v) => ($(`#${v}`).hidden = v !== id)); }
  function showLogin() { showOnly('login-view'); $('#login-form [name=username]').focus(); }
  function showFirstPassword() { showOnly('password-view'); $('#first-password-form [name=current]').focus(); }
  async function showApp(me) {
    await loadData();
    showOnly('app-view');
    if (me) $('#who').textContent = `${me.username} · ${me.role === 'developer' ? 'Desenvolvedor' : 'Administrador'}`;
    $('#dev-link').hidden = !(me && me.role === 'developer');
    const fromHash = location.hash.slice(1);
    currentView = VIEWS[fromHash] ? fromHash : 'servicos';
    render();
  }
  const enter = async () => showApp(await api('GET', '/api/me'));

  $('#menu').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) go(b.dataset.goto); });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = $('#login-error');
    err.hidden = true;
    try {
      const r = await api('POST', '/api/login', { username: f.username.value, password: f.password.value, area: 'admin' });
      f.reset();
      if (r.mustChangePassword) showFirstPassword();
      else await enter();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  const fp = $('#first-password-form');
  bindPasswordForm(fp, $('.form-error', fp), enter);

  $('#logout').addEventListener('click', async () => { await api('POST', '/api/logout').catch(() => {}); showLogin(); });

  (async function init() {
    try {
      const me = await api('GET', '/api/me');
      if (me.mustChangePassword) showFirstPassword();
      else await showApp(me);
    } catch { /* api() já mostra o login */ }
  })();
})();
