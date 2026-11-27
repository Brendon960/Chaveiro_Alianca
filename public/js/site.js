(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('site-data').textContent);
  var S = DATA.settings, T = DATA.texts;
  var services = DATA.services, products = DATA.products, categories = DATA.categories;

  /* ---------------- Utilitários ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { append(el, x); });
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  var ICONS = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.44 9.43m8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.79.7.69 5.8.69 12.06c0 2 .52 3.96 1.52 5.68L.6 23.6l6-1.57a11.3 11.3 0 0 0 5.44 1.39h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8M16 7l3 3M19 4l2 2"/></svg>',
    chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    remote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="6" width="10" height="16" rx="5"/><circle cx="12" cy="11" r="1.5"/><circle cx="12" cy="16" r="1.5"/><path d="M9 3.5a5 5 0 0 1 6 0"/></svg>',
    shell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z"/><path d="M10 15v6h4v-6"/></svg>',
    blade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h12l4 3-4 3h-2v-2h-2v2H9v-2H7v2H3z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/></svg>',
    logo: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="13" height="17" rx="6"/><circle cx="11.5" cy="10" r="1.6" fill="currentColor"/><path d="M11.5 21v7M11.5 24h3.5M11.5 27h2.5"/><path d="M22 8a5 5 0 0 1 0 7M25 5a9 9 0 0 1 0 13"/></svg>'
  };
  function icon(name) {
    var s = document.createElement('span');
    s.className = 'i';
    s.innerHTML = ICONS[name] || '';
    return s;
  }


  var CAT_ICON = { chaves: 'key', controles: 'remote', carcacas: 'shell', laminas: 'blade', acessorios: 'tag' };
  var FEATURE_ICON = ['key', 'chip', 'user', 'shield'];
  var catName = function (id) {
    for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i].name;
    return '';
  };
  var isPlaceholder = function (s) { return /^\[.*\]$/.test(String(s || '').trim()); };
  var money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var WA_NUMBER = String(S.whatsapp || '').replace(/\D/g, '');

  /* ---------------- Registro de eventos (logs) ---------------- */
  function send(url, payload) {
    try {
      var body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
    } catch (e) { /* sem efeito para o visitante */ }
  }
  var reported = {};
  function reportOnce(key, payload) {
    if (reported[key] || Object.keys(reported).length > 15) return;
    reported[key] = true;
    send('/api/client-log', payload);
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') {
      reportOnce('img:' + t.src, { type: 'image', src: t.getAttribute('src'), page: location.pathname });
      var fb = t.getAttribute('data-fallback');
      if (fb && t.getAttribute('src') !== fb) t.src = fb;
      return;
    }
    if (e.message) reportOnce('js:' + e.message, { type: 'js', message: e.message, src: e.filename, line: e.lineno, page: location.pathname });
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var msg = (e.reason && e.reason.message) || String(e.reason);
    reportOnce('pr:' + msg, { type: 'js', message: msg, page: location.pathname });
  });

  function openWhatsApp(message, track) {
    send('/api/track', track);
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  /* ---------------- Textos e configurações ---------------- */
  $$('[data-t]').forEach(function (el) {
    var v = T[el.getAttribute('data-t')];
    if (typeof v === 'string') el.textContent = v;
  });
  $$('[data-s]').forEach(function (el) {
    var v = S[el.getAttribute('data-s')];
    if (typeof v === 'string') el.textContent = v;
  });
  $$('[data-icon]').forEach(function (el) { el.innerHTML = ICONS[el.getAttribute('data-icon')] || ''; });
  $('#year').textContent = new Date().getFullYear();

  ['#brand-logo', '#footer-logo'].forEach(function (sel) {
    var el = $(sel);
    if (S.logo) {
      el.classList.add('has-img');
      el.appendChild(h('img', { src: S.logo, alt: S.businessName }));
    } else {
      el.innerHTML = ICONS.logo;
    }
  });

  var heroImg = $('#hero-image');
  heroImg.setAttribute('data-fallback', '/img/hero-chave-inteligente.svg');
  if (T.heroImage) heroImg.src = T.heroImage;
  if (T.heroImage && T.heroImage.indexOf('/uploads/') === 0) heroImg.classList.add('is-photo');

  var badges = $('#hero-badges');
  (T.differentials || []).forEach(function (d) {
    if (d.title) badges.appendChild(h('li', {}, icon('check'), d.title));
  });

  /* ---------------- Serviços ---------------- */
  var grid = $('#services-grid');
  var featuredSteps = (T.steps || []).map(function (s) { return s.title; }).filter(Boolean);
  services.forEach(function (s, i) {
    var featured = !!s.highlight;
    var waLabel = s.whatsappService || s.title;
    grid.appendChild(
      h('article', { class: 'service' + (featured ? ' service--featured' : '') },
        h('div', { class: 'service__media' },
          featured ? h('span', { class: 'badge', text: 'Destaque' }) : null,
          h('img', { src: s.image || '/img/servicos/padrao.svg', 'data-fallback': '/img/servicos/padrao.svg', alt: s.title, loading: i < 2 ? 'eager' : 'lazy', width: 600, height: 400 })
        ),
        h('div', { class: 'service__body' },
          h('span', { class: 'service__num', text: String(i + 1).padStart(2, '0') }),
          h('h3', { text: s.title }),
          s.description ? h('p', { text: s.description }) : null,
          featured && featuredSteps.length
            ? h('ol', { class: 'service__list', 'aria-label': 'Passo a passo' },
                featuredSteps.map(function (t) { return h('li', {}, t); }))
            : null,
          h('button', { type: 'button', class: 'btn ' + (featured ? 'btn--primary btn--lg' : 'btn--outline'), 'data-quote': true, 'data-service': waLabel, 'data-origin': 'servico' },
            icon('wa'), featured ? 'Solicitar orçamento pelo WhatsApp' : 'Solicitar orçamento')
        )
      )
    );
  });

  /* ---------------- Passos e diferenciais ---------------- */
  var steps = $('#steps');
  (T.steps || []).forEach(function (st) {
    if (!st.title && !st.text) return;
    steps.appendChild(h('li', { class: 'step' }, h('h3', { text: st.title }), h('p', { text: st.text })));
  });

  var features = $('#features');
  (T.differentials || []).forEach(function (d, i) {
    if (!d.title && !d.text) return;
    features.appendChild(
      h('div', { class: 'feature' },
        h('div', { class: 'feature__icon' }, icon(FEATURE_ICON[i % FEATURE_ICON.length])),
        h('h3', { text: d.title }),
        h('p', { text: d.text })
      )
    );
  });

  /* ---------------- Catálogo ---------------- */
  var productsEl = $('#products');
  var tabsEl = $('#catalog-tabs');
  var emptyFilter = $('#empty-filter');

  function productCard(p) {
    var cat = catName(p.category);
    return h('article', { class: 'product', 'data-cat': p.category },
      h('div', { class: 'product__media' },
        h('img', { src: p.image || '/img/servicos/padrao.svg', 'data-fallback': '/img/servicos/padrao.svg', alt: p.name, loading: 'lazy' })
      ),
      h('div', { class: 'product__body' },
        h('span', { class: 'product__cat', text: cat }),
        h('h3', { text: p.name }),
        p.description ? h('p', { text: p.description }) : h('p'),
        typeof p.price === 'number'
          ? h('div', { class: 'product__price', text: money.format(p.price) })
          : h('div', { class: 'product__price product__price--ask', text: 'Preço sob consulta' }),
        h('button', {
          type: 'button', class: 'btn btn--outline btn--sm',
          onclick: function () {
            openWhatsApp(
              'Olá! Gostaria de consultar o produto: ' + p.name + (cat ? ' (' + cat + ')' : '') + '.',
              { service: 'Produto: ' + p.name, origin: 'catalogo', kind: 'produto' }
            );
          }
        }, icon('wa'), 'Consultar no WhatsApp')
      )
    );
  }

  if (products.length) {
    var cards = products.map(productCard);
    cards.forEach(function (c) { productsEl.appendChild(c); });
    var usedCats = categories.filter(function (c) { return products.some(function (p) { return p.category === c.id; }); });
    [{ id: '', name: 'Todos' }].concat(usedCats).forEach(function (c, i) {
      var t = h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false', text: c.name });
      t.addEventListener('click', function () {
        $$('.tab', tabsEl).forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
        t.setAttribute('aria-selected', 'true');
        var visible = 0;
        cards.forEach(function (card) {
          card.hidden = !!c.id && card.getAttribute('data-cat') !== c.id;
          if (!card.hidden) visible++;
        });
        emptyFilter.hidden = visible > 0;
      });
      tabsEl.appendChild(t);
    });
  } else {
    // Sem produtos cadastrados: mostra as categorias com botão de consulta.
    productsEl.classList.add('products--cats');
    categories.forEach(function (c) {
      productsEl.appendChild(
        h('div', { class: 'cat-card' },
          h('div', { class: 'cat-card__icon' }, icon(CAT_ICON[c.id] || 'tag')),
          h('h3', { text: c.name }),
          h('p', { text: 'Consulte disponibilidade e valores para o seu veículo.' }),
          h('button', { type: 'button', class: 'btn btn--outline btn--sm', 'data-quote': true, 'data-service': c.name, 'data-origin': 'catalogo' }, icon('wa'), 'Consultar no WhatsApp')
        )
      );
    });
  }

  /* ---------------- Contato ---------------- */
  var contact = $('#contact');
  function contactCard(opts) {
    var tag = opts.href ? 'a' : opts.quote ? 'button' : 'div';
    var attrs = { class: 'contact-card' + (opts.mod ? ' contact-card--' + opts.mod : '') };
    if (opts.href) { attrs.href = opts.href; if (/^https?:/.test(opts.href)) { attrs.target = '_blank'; attrs.rel = 'noopener'; } }
    if (opts.quote) { attrs.type = 'button'; attrs['data-quote'] = true; attrs['data-origin'] = 'contato'; }
    return h(tag, attrs,
      h('span', { class: 'contact-card__icon' }, icon(opts.icon)),
      h('span', {}, h('strong', { text: opts.title }), h('span', { class: isPlaceholder(opts.text) ? 'is-placeholder' : null, text: opts.text }))
    );
  }
  contact.appendChild(contactCard({ icon: 'wa', mod: 'wa', title: 'WhatsApp', text: formatPhone(S.whatsapp) || '[NÚMERO DO WHATSAPP]', quote: true }));
  if (S.phone) contact.appendChild(contactCard({ icon: 'phone', title: 'Telefone', text: S.phone, href: 'tel:' + S.phone.replace(/[^\d+]/g, '') }));
  if (S.email) contact.appendChild(contactCard({ icon: 'mail', title: 'E-mail', text: S.email, href: 'mailto:' + S.email }));
  if (S.address) contact.appendChild(contactCard({ icon: 'pin', title: 'Endereço', text: S.address + (S.city && !isPlaceholder(S.address) ? '\n' + S.city : ''), href: S.mapsUrl || null }));
  if (S.hours) contact.appendChild(contactCard({ icon: 'clock', title: 'Horário de atendimento', text: S.hours }));
  // Redes sociais: só a logo, clicável (o link não aparece como texto)
  var socials = [
    { url: socialUrl(S.instagram), icon: 'insta', name: 'Instagram', mod: 'insta' },
    { url: socialUrl(S.facebook), icon: 'fb', name: 'Facebook', mod: 'fb' },
  ].filter(function (s) { return s.url; });
  if (socials.length) {
    contact.appendChild(h('div', { class: 'contact-card contact-card--social' },
      h('span', {},
        h('strong', { text: 'Redes sociais' }),
        h('span', { class: 'social-links' }, socials.map(function (s) {
          return h('a', { class: 'social-link social-link--' + s.mod, href: s.url, target: '_blank', rel: 'noopener', 'aria-label': s.name + ' do ' + (S.businessName || 'Chaveiro Aliança BH'), title: s.name }, icon(s.icon));
        }))
      )
    ));
  }

  function socialUrl(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''; // bloqueia javascript:, data: etc.
    return 'https://' + v.replace(/^\/+/, '');
  }
  function formatPhone(d) {
    d = String(d || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('55') === 0 && d.length >= 12) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }

  /* ---------------- Formulários de orçamento (modal + orçamento rápido) ---------------- */
  function buildMessage(f) {
    return [
      T.whatsappIntro || 'Olá! Gostaria de solicitar um orçamento para serviço de chave automotiva.',
      '',
      'Marca do veículo: ' + f.brand.value.trim(),
      'Modelo: ' + f.model.value.trim(),
      'Ano: ' + f.year.value.trim(),
      'Serviço desejado: ' + f.service.value.trim()
    ].join('\n');
  }

  function ensureOption(select, value) {
    if (!value) return;
    var exists = $$('option', select).some(function (o) { return o.value === value; });
    if (!exists) select.insertBefore(h('option', { value: value, text: value }), select.lastChild);
  }

  var modal = $('#quote-modal');
  var modalForm = $('#modal-form');
  var lastFocus = null;

  $$('[data-quote-form]').forEach(function (form) {
    var sel = form.service;
    var preview = $('[data-preview]', form);
    sel.appendChild(h('option', { value: '', text: 'Selecione (opcional)' }));
    services.forEach(function (s) {
      sel.appendChild(h('option', { value: s.whatsappService || s.title, text: s.title }));
    });
    sel.appendChild(h('option', { value: 'Outro', text: 'Outro' }));

    form._update = function () { preview.textContent = buildMessage(form); };
    form.addEventListener('input', form._update);
    form.addEventListener('change', form._update);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      openWhatsApp(buildMessage(form), {
        service: form.service.value || '(não informado)',
        origin: form.getAttribute('data-origin') || 'modal',
        kind: 'servico'
      });
      if (form === modalForm) closeQuote();
    });
    form._update();
  });

  /* ---------------- Modal ---------------- */
  function openQuote(service, origin) {
    lastFocus = document.activeElement;
    ensureOption(modalForm.service, service);
    modalForm.service.value = service || '';
    modalForm.setAttribute('data-origin', origin || 'botao');
    modalForm._update();
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    closeNav();
    setTimeout(function () { modalForm.brand.focus(); }, 50);
  }
  function closeQuote() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-quote]');
    if (trigger) {
      e.preventDefault();
      openQuote(trigger.getAttribute('data-service') || '', trigger.getAttribute('data-origin'));
      return;
    }
    if (e.target.closest('[data-close]')) closeQuote();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeQuote();
  });

  /* ---------------- Menu e cabeçalho ---------------- */
  var nav = $('#nav'), toggle = $('#nav-toggle'), header = $('.header');
  function closeNav() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', closeNav); });
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
