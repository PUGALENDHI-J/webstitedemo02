/* Skyrah Impex — admin panel (vanilla JS, talks to /api on server.js) */
(function () {
  'use strict';

  /* ================================================================ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const site = p => /^https?:\/\//i.test(String(p || '')) ? String(p) : '../' + String(p || '').replace(/^\/+/, '');
  const inr = n => Number(n) ? '₹' + Number(n).toLocaleString('en-IN') : 'Ask us';
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const fmtDateTime = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>',
    quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5Z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.01"/>'
  };
  const ic = (n, extra) => '<svg class="i' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';

  /* ================================================================ state */
  const TOKEN_KEY = 'skyrah_admin_token';
  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* storage blocked */ }
  const setToken = t => { token = t || ''; try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } };
  let db = { settings: { social: {} }, categories: [], products: [], articles: [], faqs: [], testimonials: [] };
  let newEnquiries = 0, defaultPassword = false, enquiries = null;
  const ui = { productQuery: '', productCat: '', productStock: '', enqTab: 'all', enqQuery: '', enqOpen: null };

  /* ================================================================ api */
  class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
  async function api(path, opts) {
    opts = opts || {};
    let res;
    try {
      res = await fetch('/api/' + path, {
        method: opts.method || 'GET',
        headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      });
    } catch (e) {
      throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0);
    }
    if (opts.raw && res.ok) return res;
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== 'login') {
      await reauth();          // ask for the password again, keep everything on screen
      return api(path, opts);  // then retry the same request once signed in
    }
    if (!res.ok) throw new ApiError(data.error || 'Something went wrong (' + res.status + '). Please try again.', res.status);
    return data;
  }
  async function loadStore() {
    const r = await api('store');
    db = r.db; newEnquiries = r.newEnquiries; defaultPassword = r.defaultPassword;
    $('#pwBanner').hidden = !defaultPassword;
    renderNav();
  }

  /* ================================================================ toasts + confirm */
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.setAttribute('role', type === 'err' ? 'alert' : 'status');
    t.innerHTML = ic(type === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), type === 'err' ? 6000 : 3200);
  }
  let modalResolve = null, modalReturnFocus = null;
  function confirmBox(o) {
    $('#modalTitle').textContent = o.title || 'Are you sure?';
    $('#modalText').textContent = o.text || '';
    const ok = $('#modalOk');
    ok.textContent = o.ok || 'Delete';
    ok.className = 'btn ' + (o.danger === false ? 'btn-primary' : 'btn-danger');
    $('#modalCancel').textContent = o.cancel || 'Cancel';
    modalReturnFocus = document.activeElement;
    $('#modal').hidden = false;
    setTimeout(() => $('#modalCancel').focus(), 30);
    return new Promise(r => { modalResolve = r; });
  }
  function closeModal(v) {
    $('#modal').hidden = true;
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(v); }
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  }
  $('#modalOk').addEventListener('click', () => closeModal(true));
  $('#modalCancel').addEventListener('click', () => closeModal(false));
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(false); });

  /* ================================================================ login / re-auth */
  function setEye(btn, shown) { btn.innerHTML = ic(shown ? 'eyeOff' : 'eye'); btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password'); }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-eye]');
    if (!b) return;
    const inp = document.getElementById(b.dataset.eye);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    setEye(b, show);
  });
  $$('[data-eye]').forEach(b => setEye(b, false));

  function showLogin(msg) {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    const m = $('#loginMsg');
    m.hidden = !msg; m.textContent = msg || '';
    setTimeout(() => $('#loginPw').focus(), 30);
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#loginPw').value, btn = $('#loginBtn'), m = $('#loginMsg');
    if (!pw) { m.hidden = false; m.textContent = 'Please enter the admin password.'; return; }
    btn.setAttribute('aria-busy', 'true');
    try {
      const r = await api('login', { method: 'POST', body: { password: pw } });
      setToken(r.token);
      $('#loginPw').value = '';
      m.hidden = true;
      await startApp();
    } catch (err) {
      m.hidden = false; m.textContent = err.message;
      $('#loginPw').select();
    } finally { btn.removeAttribute('aria-busy'); }
  });

  let reauthPromise = null;
  function reauth() {
    if (reauthPromise) return reauthPromise;
    if ($('#appView').hidden) { setToken(''); showLogin('Please sign in.'); return Promise.reject(new ApiError('Please sign in.', 401)); }
    reauthPromise = new Promise((resolve, reject) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.style.zIndex = 300;
      wrap.innerHTML = '<form class="modal" novalidate><h2>Your session has ended</h2><p>For security, please enter the admin password again. Your unsaved work is still here.</p>' +
        '<div class="alert alert-err" hidden style="margin-bottom:12px"></div>' +
        '<label class="field"><span class="field-label">Password</span><span class="pw-wrap"><input type="password" id="reauthPw" autocomplete="current-password"><button type="button" class="pw-eye" data-eye="reauthPw"></button></span></label>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>Sign out</button><button class="btn btn-primary">Continue</button></div></form>';
      document.body.appendChild(wrap);
      setEye($('[data-eye]', wrap), false);
      const f = $('form', wrap), err = $('.alert', wrap);
      setTimeout(() => $('#reauthPw').focus(), 30);
      const done = () => { wrap.remove(); reauthPromise = null; };
      $('[data-x]', wrap).addEventListener('click', () => { done(); logout(); reject(new ApiError('Signed out.', 401)); });
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = $('.btn-primary', f);
        btn.setAttribute('aria-busy', 'true');
        try {
          const r = await api('login', { method: 'POST', body: { password: $('#reauthPw').value } });
          setToken(r.token); done(); resolve();
        } catch (ex) { err.hidden = false; err.textContent = ex.message; }
        finally { btn.removeAttribute('aria-busy'); }
      });
    });
    return reauthPromise;
  }
  function logout() {
    setToken('');
    forceCloseDrawer();
    settingsDirty = () => false;
    showLogin('');
  }

  /* ================================================================ navigation */
  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { group: 'Catalogue' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { group: 'Website content' },
    { id: 'journal', label: 'Journal', icon: 'book' },
    { id: 'faqs', label: 'FAQs', icon: 'help' },
    { id: 'testimonials', label: 'Testimonials', icon: 'quote' },
    { group: 'Customers' },
    { id: 'enquiries', label: 'Enquiries', icon: 'inbox' },
    { group: 'Settings' },
    { id: 'company', label: 'Company details', icon: 'building' },
    { id: 'account', label: 'Password & backup', icon: 'lock' }
  ];
  const routeId = () => { const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return NAV.some(n => n.id === r) ? r : 'dashboard'; };
  function renderNav() {
    const cur = routeId();
    $('#sideNav').innerHTML = NAV.map(n => n.group
      ? '<div class="nav-group">' + esc(n.group) + '</div>'
      : '<a class="side-link' + (n.id === cur ? ' active' : '') + '" href="#/' + n.id + '"' + (n.id === cur ? ' aria-current="page"' : '') + '>' + ic(n.icon) + '<span>' + n.label + '</span>' +
        (n.id === 'enquiries' && newEnquiries ? '<span class="count" aria-label="' + newEnquiries + ' new">' + newEnquiries + '</span>' : '') + '</a>').join('');
  }
  $('#viewSiteLink').innerHTML = ic('external') + '<span>View website</span>';
  $('#logoutBtn').innerHTML = ic('logout') + '<span>Sign out</span>';
  $('#logoutBtn').addEventListener('click', async () => {
    if (drawerDirty() && !(await confirmBox({ title: 'Discard changes?', text: 'You have unsaved changes. Sign out anyway?', ok: 'Sign out' }))) return;
    logout();
  });
  $('#menuBtn').innerHTML = ic('menu');
  const toggleSide = open => {
    $('#side').classList.toggle('open', open);
    $('#sideBackdrop').classList.toggle('open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  };
  $('#menuBtn').addEventListener('click', () => toggleSide(!$('#side').classList.contains('open')));
  $('#sideBackdrop').addEventListener('click', () => toggleSide(false));
  $('#sideNav').addEventListener('click', e => { if (e.target.closest('a')) toggleSide(false); });

  let settingsDirty = () => false;
  let lastHash = location.hash, skipHash = false;
  window.addEventListener('hashchange', async () => {
    if (skipHash) { skipHash = false; return; }
    if (settingsDirty() || drawerDirty()) {
      const target = location.hash;
      skipHash = true; location.hash = lastHash;
      if (!(await confirmBox({ title: 'Leave without saving?', text: 'Your changes on this page have not been saved.', ok: 'Leave page' }))) return;
      settingsDirty = () => false; forceCloseDrawer();
      skipHash = false; location.hash = target; return;
    }
    lastHash = location.hash;
    render();
  });
  window.addEventListener('beforeunload', e => { if (settingsDirty() || drawerDirty()) { e.preventDefault(); e.returnValue = ''; } });

  function setHeader(title, sub, actions) {
    $('#pageTitle').textContent = title;
    $('#pageSub').textContent = sub || '';
    $('#pageActions').innerHTML = actions || '';
    document.title = title + ' — Skyrah Impex admin';
  }

  async function render(skipReload) {
    settingsDirty = () => false;
    const id = routeId();
    const v = VIEWS[id];
    try {
      if (!skipReload) await loadStore(); // always show the latest data (other tabs, new enquiries)
      renderNav();
      await v();
    }
    catch (e) {
      if (e.status === 401) return;
      $('#content').innerHTML = '<div class="alert alert-err">' + esc(e.message) + ' <button type="button" class="btn btn-sm btn-ghost" id="retryBtn">Try again</button></div>';
      $('#retryBtn').onclick = render;
    }
    $('#content').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ================================================================ form building blocks */
  const attr = (k, v) => v === undefined || v === null || v === false ? '' : v === true ? ' ' + k : ' ' + k + '="' + esc(v) + '"';
  function fInput(o) {
    const id = 'f_' + o.name;
    return '<label class="field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + o.name + '"><span class="field-label">' + esc(o.label) + (o.required ? '' : ' <span class="opt">(optional)</span>') +
      (o.max && o.counter ? '<span class="counter" data-counter="' + id + '"></span>' : '') + '</span>' +
      '<input id="' + id + '" name="' + o.name + '" type="' + (o.type || 'text') + '"' + attr('value', o.value ?? '') + attr('placeholder', o.placeholder) + attr('maxlength', o.max) +
      attr('data-required', o.required) + attr('min', o.min) + attr('step', o.step) + attr('inputmode', o.inputmode) + attr('list', o.list) + attr('autocomplete', o.autocomplete || 'off') + '>' +
      (o.hint ? '<span class="field-hint">' + o.hint + '</span>' : '') + '<span class="field-err">' + esc(o.err || 'This field is required.') + '</span></label>';
  }
  function fText(o) {
    const id = 'f_' + o.name;
    return '<label class="field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + o.name + '"><span class="field-label">' + esc(o.label) + (o.required ? '' : ' <span class="opt">(optional)</span>') +
      (o.max && o.counter ? '<span class="counter" data-counter="' + id + '"></span>' : '') + '</span>' +
      '<textarea id="' + id + '" name="' + o.name + '"' + attr('rows', o.rows || 4) + attr('maxlength', o.max) + attr('placeholder', o.placeholder) + attr('data-required', o.required) + (o.tall ? ' class="tall"' : '') + '>' + esc(o.value ?? '') + '</textarea>' +
      (o.hint ? '<span class="field-hint">' + o.hint + '</span>' : '') + '<span class="field-err">' + esc(o.err || 'This field is required.') + '</span></label>';
  }
  function fSelect(o) {
    return '<label class="field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + o.name + '"><span class="field-label">' + esc(o.label) + '</span>' +
      '<select id="f_' + o.name + '" name="' + o.name + '"' + attr('data-required', o.required) + '>' + o.options.map(op => '<option value="' + esc(op[0]) + '"' + (String(op[0]) === String(o.value) ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select>' +
      (o.hint ? '<span class="field-hint">' + o.hint + '</span>' : '') + '<span class="field-err">' + esc(o.err || 'Please choose an option.') + '</span></label>';
  }
  const fCheck = o => '<label class="check"><input type="checkbox" name="' + o.name + '"' + (o.checked ? ' checked' : '') + '><span><strong>' + esc(o.label) + '</strong>' + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</span></label>';
  const section = (title, sub, inner) => '<div class="form-section"><h3>' + esc(title) + '</h3>' + (sub ? '<p class="sec-sub">' + sub + '</p>' : '<p class="sec-sub"></p>') + inner + '</div>';
  function fImage(o) {
    return '<div class="field" data-field="' + o.name + '"><span class="field-label">' + esc(o.label) + (o.required ? '' : ' <span class="opt">(optional)</span>') + '</span>' +
      '<div class="img-pick" data-img="' + o.name + '">' +
      '<div class="img-box' + (o.wide ? ' wide' : '') + (o.value ? ' filled' : '') + '">' + (o.value ? '<img src="' + esc(site(o.value)) + '" alt="">' : ic('image')) + '</div>' +
      '<div class="img-actions"><label class="btn btn-ghost btn-sm file-btn">' + ic('image') + '<span>' + (o.value ? 'Replace image' : 'Upload image') + '</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="' + esc(o.label) + '"></label>' +
      (o.required ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-img-clear' + (o.value ? '' : ' hidden') + '>Remove</button>') +
      '<span class="field-hint">' + (o.hint || 'JPG, PNG or WebP. Large photos are resized automatically.') + '</span></div>' +
      '<input type="hidden" name="' + o.name + '" value="' + esc(o.value || '') + '"' + attr('data-required', o.required) + '></div>' +
      '<span class="field-err">' + esc(o.err || 'Please upload an image.') + '</span></div>';
  }
  function fGallery(o) {
    return '<div class="field" data-field="' + o.name + '"><span class="field-label">' + esc(o.label) + ' <span class="opt">(optional)</span></span>' +
      '<div class="gallery" data-gallery="' + o.name + '"></div>' +
      '<label class="btn btn-ghost btn-sm file-btn">' + ic('plus') + '<span>Add photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="' + esc(o.label) + '"></label>' +
      '<span class="field-hint">' + esc(o.hint || '') + '</span>' +
      '<input type="hidden" name="' + o.name + '" value="' + esc(JSON.stringify(o.value || [])) + '"></div>';
  }

  /* --- image processing + upload --- */
  async function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('"' + file.name + '" is not a JPG, PNG or WebP image.');
    if (file.size > 25 * 1024 * 1024) throw new Error('"' + file.name + '" is larger than 25 MB. Please choose a smaller photo.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('"' + file.name + '" could not be opened. Try another file.')); i.src = url; });
      const max = 1600, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      let alpha = false;
      if (file.type !== 'image/jpeg') {
        const d = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; }
      }
      if (alpha) { const webp = c.toDataURL('image/webp', 0.88); return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.86); }
      let out = c.toDataURL('image/jpeg', 0.86);
      for (let q = 0.74; out.length > 3.2e6 && q > 0.4; q -= 0.12) out = c.toDataURL('image/jpeg', q); // stay under the 4.5 MB hosting request limit
      return out;
    } finally { URL.revokeObjectURL(url); }
  }
  async function uploadFile(file) {
    const data = await prepareImage(file);
    const r = await api('upload', { method: 'POST', body: { data, name: file.name } });
    return r.path;
  }
  function bindImagePickers(root, onChange) {
    $$('[data-img]', root).forEach(pick => {
      const box = $('.img-box', pick), hidden = $('input[type=hidden]', pick), file = $('input[type=file]', pick), lbl = $('.file-btn span', pick), clear = $('[data-img-clear]', pick);
      const show = p => {
        hidden.value = p || '';
        box.classList.toggle('filled', !!p);
        box.innerHTML = p ? '<img src="' + esc(site(p)) + '" alt="">' : ic('image');
        lbl.textContent = p ? 'Replace image' : 'Upload image';
        if (clear) clear.hidden = !p;
        pick.closest('.field').classList.remove('has-err');
        onChange && onChange();
      };
      file.addEventListener('change', async () => {
        const f = file.files[0]; file.value = '';
        if (!f) return;
        const busy = document.createElement('div'); busy.className = 'busy'; busy.textContent = 'Uploading…';
        box.appendChild(busy); setBusy(true);
        try { show(await uploadFile(f)); }
        catch (e) { busy.remove(); toast(e.message, 'err'); }
        finally { setBusy(false); }
      });
      if (clear) clear.addEventListener('click', () => show(''));
    });
    $$('[data-gallery]', root).forEach(gal => {
      const field = gal.closest('.field'), hidden = $('input[type=hidden]', field), file = $('input[type=file]', field);
      let list = []; try { list = JSON.parse(hidden.value) || []; } catch (e) { list = []; }
      const draw = () => {
        hidden.value = JSON.stringify(list);
        gal.innerHTML = list.map((p, i) => '<div class="g-item"><img src="' + esc(site(p)) + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">' + ic('x') + '</button></div>').join('');
        gal.hidden = !list.length;
        onChange && onChange();
      };
      gal.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { list.splice(+b.dataset.rm, 1); draw(); } });
      file.addEventListener('change', async () => {
        const files = Array.from(file.files); file.value = '';
        const room = 8 - list.length;
        if (files.length > room) toast('You can add up to 8 extra photos.', 'err');
        setBusy(true);
        for (const f of files.slice(0, Math.max(0, room))) {
          try { list.push(await uploadFile(f)); draw(); } catch (e) { toast(e.message, 'err'); }
        }
        setBusy(false);
      });
      draw();
    });
  }
  function bindCounters(root) {
    $$('[data-counter]', root).forEach(c => {
      const inp = document.getElementById(c.dataset.counter);
      const upd = () => { c.textContent = inp.value.length + ' / ' + inp.maxLength; };
      inp.addEventListener('input', upd); upd();
    });
  }
  function formData(form) {
    const o = {};
    $$('input[name], select[name], textarea[name]', form).forEach(el => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'hidden' && /^\[/.test(el.value)) { try { o[el.name] = JSON.parse(el.value); } catch (e) { o[el.name] = []; } }
      else o[el.name] = el.value;
    });
    return o;
  }
  /* client-side required-field check; returns true when ok */
  function validate(form) {
    let first = null;
    $$('[data-required]', form).forEach(el => {
      const f = el.closest('.field'), bad = !String(el.value).trim();
      if (f) f.classList.toggle('has-err', bad);
      if (bad && !first) first = el;
    });
    $$('input[type=email]', form).forEach(el => {
      if (el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) {
        const f = el.closest('.field'); f.classList.add('has-err'); $('.field-err', f).textContent = 'Enter a valid email address.';
        if (!first) first = el;
      }
    });
    if (first) {
      const f = first.closest('.field');
      (first.type === 'hidden' ? $('input[type=file]', f) || f : first).focus?.();
      f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  }
  document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('.field.has-err'); if (f) f.classList.remove('has-err'); });
  document.addEventListener('change', e => { const f = e.target.closest && e.target.closest('.field.has-err'); if (f) f.classList.remove('has-err'); });

  let busyCount = 0;
  function setBusy(on) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    const save = $('#drawerSave');
    if (save) save.disabled = busyCount > 0;
  }

  /* ================================================================ drawer (editor panel) */
  let drawerState = null;
  const drawerDirty = () => !!drawerState && !$('#drawer').hidden && JSON.stringify(formData($('#drawerForm'))) !== drawerState.snapshot;
  function openDrawer(o) {
    drawerState = { onSubmit: o.onSubmit, snapshot: '', returnFocus: document.activeElement };
    $('#drawerTitle').textContent = o.title;
    $('#drawerSave').textContent = o.saveLabel || 'Save';
    $('#drawerBody').innerHTML = '<div class="alert alert-err" id="drawerErr" role="alert" hidden></div>' + o.html;
    $('#drawer').hidden = false; $('#drawerBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    busyCount = 0; setBusy(false);
    bindImagePickers($('#drawerBody'));
    bindCounters($('#drawerBody'));
    o.onMount && o.onMount($('#drawerBody'));
    drawerState.snapshot = JSON.stringify(formData($('#drawerForm')));
    $('#drawerBody').scrollTop = 0;
    const first = $('#drawerBody input:not([type=hidden]):not([type=file]), #drawerBody textarea, #drawerBody select');
    if (first) first.focus({ preventScroll: true });
  }
  function forceCloseDrawer() {
    if ($('#drawer').hidden) return;
    $('#drawer').hidden = true; $('#drawerBackdrop').hidden = true;
    document.body.style.overflow = '';
    const rf = drawerState && drawerState.returnFocus;
    drawerState = null;
    if (rf && document.body.contains(rf)) rf.focus();
  }
  async function closeDrawer() {
    if (busyCount > 0) { toast('Please wait for the image to finish uploading.', 'err'); return; }
    if (drawerDirty() && !(await confirmBox({ title: 'Discard changes?', text: 'You have unsaved changes in this form.', ok: 'Discard' }))) return;
    forceCloseDrawer();
  }
  $('#drawerClose').innerHTML = ic('x');
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerCancel').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#modal').hidden) { closeModal(false); return; }
    if (document.querySelector('.modal-backdrop:not(#modal)')) return; // re-auth prompt stays open
    if (!$('#drawer').hidden) { closeDrawer(); return; }
    if ($('#side').classList.contains('open')) toggleSide(false);
  });
  /* keep keyboard focus inside the drawer while it is open */
  document.addEventListener('focusin', e => {
    if ($('#drawer').hidden || !$('#modal').hidden || document.querySelector('.modal-backdrop:not(#modal)')) return;
    if (!$('#drawer').contains(e.target) && !$('#toasts').contains(e.target)) $('#drawerClose').focus();
  });
  $('#drawerForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!drawerState || busyCount > 0) return;
    const form = $('#drawerForm'), err = $('#drawerErr'), btn = $('#drawerSave');
    err.hidden = true;
    if (!validate(form)) { err.hidden = false; err.textContent = 'Please fill in the highlighted fields.'; $('#drawerBody').scrollTop = 0; return; }
    btn.setAttribute('aria-busy', 'true');
    try {
      const msg = await drawerState.onSubmit(formData(form));
      forceCloseDrawer();
      await render();
      toast(msg || 'Saved.');
    } catch (ex) {
      if (ex.status === 401) return;
      err.hidden = false; err.textContent = ex.message;
      $('#drawerBody').scrollTo({ top: 0, behavior: 'smooth' });
    } finally { btn.removeAttribute('aria-busy'); }
  });

  /* generic actions shared by lists */
  async function removeItem(col, item, label, extra) {
    if (!(await confirmBox({ title: 'Delete ' + label + '?', text: (extra ? extra + ' ' : '') + 'This cannot be undone.' }))) return;
    try {
      await api(col + '/' + encodeURIComponent(item.id), { method: 'DELETE' });
      await render();
      toast('Deleted.');
    } catch (e) { if (e.status !== 401) toast(e.message, 'err'); }
  }
  async function move(col, sortedList, id, dir, sameGroup) {
    const i = sortedList.findIndex(x => x.id === id);
    let j = i + dir;
    if (sameGroup) while (j >= 0 && j < sortedList.length && !sameGroup(sortedList[j], sortedList[i])) j += dir;
    if (i < 0 || j < 0 || j >= sortedList.length) return;
    const ids = sortedList.map(x => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await api('reorder', { method: 'POST', body: { collection: col, ids } });
      await render();
      const btn = $('[data-move="' + dir + '"][data-id="' + CSS.escape(id) + '"]');
      if (btn && !btn.disabled) btn.focus();
    } catch (e) { if (e.status !== 401) toast(e.message, 'err'); }
  }
  const actionBtn = (act, id, icon, label, cls) => '<button type="button" class="icon-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-id="' + esc(id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + ic(icon) + '</button>';
  const moveBtns = (id, canUp, canDown, disabledNote) => '<div class="order-btns col-order"><span class="m-label">Order</span>' +
    '<button type="button" class="icon-btn" data-move="-1" data-id="' + esc(id) + '" aria-label="Move up" title="' + esc(disabledNote || 'Move up') + '"' + (canUp ? '' : ' disabled') + '>' + ic('up') + '</button>' +
    '<button type="button" class="icon-btn" data-move="1" data-id="' + esc(id) + '" aria-label="Move down" title="' + esc(disabledNote || 'Move down') + '"' + (canDown ? '' : ' disabled') + '>' + ic('down') + '</button></div>';

  /* ================================================================ VIEWS */
  const VIEWS = {};
  const catName = id => (db.categories.find(c => c.id === id) || {}).name || '—';
  const sortedCats = () => [...db.categories].sort(byOrder);
  const sortedProducts = () => {
    const cats = sortedCats();
    const ci = p => { const i = cats.findIndex(c => c.id === p.categoryId); return i < 0 ? 999 : i; };
    return [...db.products].sort((a, b) => ci(a) - ci(b) || byOrder(a, b));
  };

  /* ---------------- dashboard ---------------- */
  VIEWS.dashboard = async function () {
    setHeader('Dashboard', 'Welcome back — here is your website at a glance.', '<a class="btn btn-ghost" href="../index.html" target="_blank" rel="noopener">' + ic('external') + '<span class="lbl">View website</span></a>');
    try { enquiries = await api('enquiries'); } catch (e) { if (e.status === 401) throw e; enquiries = []; }
    const out = db.products.filter(p => p.inStock === false);
    const emptyCats = db.categories.filter(c => !db.products.some(p => p.categoryId === c.id));
    const noPrice = db.products.filter(p => !Number(p.price));
    const featured = db.products.filter(p => p.featured);
    const social = db.settings.social || {};
    const checks = [];
    if (defaultPassword) checks.push(['bad', 'You are using the default admin password. <a href="#/account">Change it now</a>.']);
    if (out.length) checks.push(['warn', plural(out.length, 'product') + ' marked out of stock: ' + out.map(p => esc(p.name)).join(', ') + '. <a href="#/products">Review</a>']);
    if (emptyCats.length) checks.push(['warn', 'Empty categories (hidden from the shop filters): ' + emptyCats.map(c => esc(c.name)).join(', ') + '.']);
    if (!featured.length) checks.push(['warn', 'No products are featured, so the home page shows the first six. <a href="#/products">Choose featured products</a>.']);
    if (noPrice.length) checks.push(['ok', plural(noPrice.length, 'product') + ' show “Ask us” instead of a price — customers ask on WhatsApp.']);
    if (!db.testimonials.length) checks.push(['ok', 'The testimonials section stays hidden until you <a href="#/testimonials">add a customer review</a>.']);
    if (!Object.values(social).some(Boolean)) checks.push(['ok', 'Add Instagram, Facebook or LinkedIn links in <a href="#/company">Company details</a> to show social icons.']);
    if (!checks.length) checks.push(['ok', 'Everything looks good.']);
    const latest = enquiries.slice(0, 5);
    $('#content').innerHTML =
      '<div class="stats">' +
      '<a class="stat" href="#/products"><div class="s-num">' + db.products.length + '</div><div class="s-lbl">Products · ' + (db.products.length - out.length) + ' in stock</div></a>' +
      '<a class="stat" href="#/categories"><div class="s-num">' + db.categories.length + '</div><div class="s-lbl">Categories</div></a>' +
      '<a class="stat" href="#/journal"><div class="s-num">' + db.articles.length + '</div><div class="s-lbl">Journal articles</div></a>' +
      '<a class="stat' + (newEnquiries ? ' hl' : '') + '" href="#/enquiries"><div class="s-num">' + newEnquiries + '</div><div class="s-lbl">New ' + (newEnquiries === 1 ? 'enquiry' : 'enquiries') + '</div></a>' +
      '</div>' +
      '<div class="dash-grid"><div>' +
      '<div class="panel"><div class="panel-head"><h2>Latest enquiries</h2><a class="btn btn-sm btn-ghost" href="#/enquiries">View all</a></div>' +
      (latest.length ? '<div class="list">' + latest.map(q => '<a class="row" style="grid-template-columns:12px minmax(0,1fr) auto;text-decoration:none" href="#/enquiries" data-open-enq="' + esc(q.id) + '">' +
        '<span class="new-dot' + (q.status === 'new' ? '' : ' read') + '" style="width:10px;height:10px;border-radius:50%;' + (q.status === 'new' ? 'background:var(--green)' : 'border:1.5px solid var(--line-strong)') + '"></span>' +
        '<span style="min-width:0"><span class="cell-title" style="display:block">' + esc(q.name) + ' · ' + esc(q.subject) + '</span><span class="cell-sub" style="display:block">' + esc(q.message) + '</span></span>' +
        '<span class="cell-muted">' + esc(fmtDate(q.createdAt)) + '</span></a>').join('') + '</div>'
        : '<div class="empty" style="padding:28px 10px"><strong>No enquiries yet</strong>Messages sent from the Contact page will appear here.</div>') +
      '</div>' +
      '<div class="panel"><div class="panel-head"><h2>Website health</h2></div><ul class="checklist">' + checks.map(c => '<li><span class="dot ' + (c[0] === 'ok' ? '' : c[0]) + '"></span><span>' + c[1] + '</span></li>').join('') + '</ul></div>' +
      '</div><div>' +
      '<div class="panel"><div class="panel-head"><h2>Quick actions</h2></div><div class="quick">' +
      '<a href="#/products" data-quick="product">' + ic('plus') + 'Add a product</a>' +
      '<a href="#/categories" data-quick="category">' + ic('folder') + 'Add a category</a>' +
      '<a href="#/journal" data-quick="article">' + ic('book') + 'Write an article</a>' +
      '<a href="#/company">' + ic('building') + 'Company details</a>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-head"><h2>Your company</h2><a class="btn btn-sm btn-ghost" href="#/company">Edit</a></div>' +
      '<div style="font-size:14px;line-height:1.7"><strong>' + esc(db.settings.legalName) + '</strong><br>' + esc(db.settings.director ? db.settings.director + (db.settings.directorTitle ? ', ' + db.settings.directorTitle : '') : '') +
      '<br>' + esc([db.settings.phone1, db.settings.phone2].filter(Boolean).join(' · ')) + '<br>' + esc(db.settings.email) + '<br><span class="cell-muted">' + esc(db.settings.address) + '</span></div></div>' +
      '</div></div>';
    $$('[data-quick]').forEach(a => a.addEventListener('click', () => { pendingQuick = a.dataset.quick; }));
    $$('[data-open-enq]').forEach(a => a.addEventListener('click', () => { ui.enqOpen = a.dataset.openEnq; ui.enqTab = 'all'; }));
  };
  let pendingQuick = null;
  const takeQuick = k => { if (pendingQuick === k) { pendingQuick = null; return true; } return false; };

  /* ---------------- products ---------------- */
  VIEWS.products = async function () {
    setHeader('Products', plural(db.products.length, 'product') + ' in ' + plural(db.categories.length, 'category').replace('categorys', 'categories'),
      '<button type="button" class="btn btn-primary" id="addProduct">' + ic('plus') + '<span class="lbl">Add product</span></button>');
    $('#addProduct').addEventListener('click', () => productEditor(null));
    const cats = sortedCats();
    $('#content').innerHTML =
      '<div class="toolbar">' +
      '<label class="search"><span class="sr-only">Search products</span>' + ic('search') + '<input type="search" id="pSearch" placeholder="Search by name, description or keyword" value="' + esc(ui.productQuery) + '"></label>' +
      '<label><span class="sr-only">Category</span><select id="pCat"><option value="">All categories</option>' + cats.map(c => '<option value="' + esc(c.id) + '"' + (ui.productCat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
      '<label><span class="sr-only">Stock</span><select id="pStock"><option value="">Any stock</option><option value="in"' + (ui.productStock === 'in' ? ' selected' : '') + '>In stock</option><option value="out"' + (ui.productStock === 'out' ? ' selected' : '') + '>Out of stock</option></select></label>' +
      '<span class="result" id="pCount"></span></div>' +
      '<div class="list" id="pList"></div>';
    const draw = () => {
      const q = ui.productQuery.trim().toLowerCase();
      const filtered = !!(q || ui.productCat || ui.productStock);
      const all = sortedProducts();
      const list = all.filter(p => (!ui.productCat || p.categoryId === ui.productCat) &&
        (!ui.productStock || (ui.productStock === 'in') === (p.inStock !== false)) &&
        (!q || [p.name, p.desc, catName(p.categoryId), ...(p.tags || [])].join(' ').toLowerCase().includes(q)));
      $('#pCount').textContent = list.length === all.length ? plural(all.length, 'product') : list.length + ' of ' + all.length + ' products';
      if (!db.products.length) {
        $('#pList').innerHTML = '<div class="empty"><strong>No products yet</strong>' + (db.categories.length ? 'Add your first product to show it in the shop.<br><button type="button" class="btn btn-primary" data-act="new">' + ic('plus') + 'Add product</button>' : 'Create a category first, then add products to it.<br><a class="btn btn-primary" href="#/categories">Go to categories</a>') + '</div>';
      } else if (!list.length) {
        $('#pList').innerHTML = '<div class="empty"><strong>No matching products</strong>Try a different search or filter.</div>';
      } else {
        const sameCat = (a, b) => a.categoryId === b.categoryId;
        $('#pList').innerHTML = '<div class="row head p-row"><span></span><span>Product</span><span>Category</span><span>Price</span><span>In stock</span><span class="col-order">Order</span><span style="text-align:right">Actions</span></div>' +
          list.map(p => {
            const idx = all.indexOf(p);
            const canUp = !filtered && all.slice(0, idx).some(x => sameCat(x, p));
            const canDown = !filtered && all.slice(idx + 1).some(x => sameCat(x, p));
            return '<div class="row p-row">' +
              '<img class="thumb col-media" src="' + esc(site(p.img)) + '" alt="" loading="lazy">' +
              '<div class="col-main" style="min-width:0"><div class="cell-title">' + esc(p.name) + (p.featured ? ' <span class="chip gold" title="Shown on the home page">★ Featured</span>' : '') + '</div><div class="cell-sub">' + esc(p.desc) + '</div></div>' +
              '<div class="col-x"><span class="chip">' + esc(catName(p.categoryId)) + '</span></div>' +
              '<div class="col-x"><span class="m-label">Price</span><span class="cell-muted">' + esc(inr(p.price)) + '</span></div>' +
              '<div class="col-x"><label class="switch"><input type="checkbox" data-stock="' + esc(p.id) + '"' + (p.inStock !== false ? ' checked' : '') + '><span class="track"></span><span>' + (p.inStock !== false ? 'In stock' : 'Out') + '</span></label></div>' +
              moveBtns(p.id, canUp, canDown, filtered ? 'Clear search and filters to reorder' : '') +
              '<div class="row-actions">' +
              actionBtn('feature', p.id, 'star', p.featured ? 'Remove from home page' : 'Feature on home page', p.featured ? 'on' : '') +
              '<a class="icon-btn" href="' + esc(site('product.html?slug=' + encodeURIComponent(p.slug))) + '" target="_blank" rel="noopener" aria-label="View on website" title="View on website">' + ic('external') + '</a>' +
              actionBtn('edit', p.id, 'edit', 'Edit ' + p.name) + actionBtn('delete', p.id, 'trash', 'Delete ' + p.name, 'danger') +
              '</div></div>';
          }).join('');
      }
    };
    draw();
    $('#pSearch').addEventListener('input', e => { ui.productQuery = e.target.value; draw(); });
    $('#pCat').addEventListener('change', e => { ui.productCat = e.target.value; draw(); });
    $('#pStock').addEventListener('change', e => { ui.productStock = e.target.value; draw(); });
    $('#pList').addEventListener('click', async e => {
      const b = e.target.closest('[data-act], [data-move]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'new') return productEditor(null);
      const p = db.products.find(x => x.id === b.dataset.id);
      if (!p) return;
      if (b.dataset.move) return move('products', sortedProducts(), p.id, +b.dataset.move, (a, c) => a.categoryId === c.categoryId);
      if (b.dataset.act === 'edit') return productEditor(p);
      if (b.dataset.act === 'delete') return removeItem('products', p, '“' + p.name + '”', 'It will be removed from the shop straight away.');
      if (b.dataset.act === 'feature') {
        b.disabled = true;
        try { await api('products/' + encodeURIComponent(p.id), { method: 'PATCH', body: { featured: !p.featured } }); await loadStore(); draw(); toast(p.featured ? 'Removed from the home page.' : 'Now featured on the home page.'); }
        catch (ex) { if (ex.status !== 401) toast(ex.message, 'err'); b.disabled = false; }
      }
    });
    $('#pList').addEventListener('change', async e => {
      const cb = e.target.closest('[data-stock]');
      if (!cb) return;
      cb.disabled = true;
      try { await api('products/' + encodeURIComponent(cb.dataset.stock), { method: 'PATCH', body: { inStock: cb.checked } }); await loadStore(); draw(); toast(cb.checked ? 'Marked in stock.' : 'Marked out of stock.'); }
      catch (ex) { cb.checked = !cb.checked; cb.disabled = false; if (ex.status !== 401) toast(ex.message, 'err'); }
    });
    if (takeQuick('product')) productEditor(null);
  };

  function productEditor(p) {
    if (!db.categories.length) { toast('Create a category first.', 'err'); location.hash = '#/categories'; return; }
    const v = p || { inStock: true, featured: false, origin: 'India', categoryId: ui.productCat || (sortedCats()[0] || {}).id };
    openDrawer({
      title: p ? 'Edit product' : 'Add a product',
      saveLabel: p ? 'Save changes' : 'Add product',
      html:
        section('Basics', 'Name, category and the short line shown on product cards.',
          fInput({ name: 'name', label: 'Product name', value: v.name, required: true, max: 80, placeholder: 'e.g. Nutmeg Powder' }) +
          fSelect({ name: 'categoryId', label: 'Category', value: v.categoryId, required: true, options: sortedCats().map(c => [c.id, c.name]) }) +
          fInput({ name: 'desc', label: 'Short description', value: v.desc, required: true, max: 160, counter: true, placeholder: 'One line, e.g. Finely ground, warm and aromatic nutmeg.' }) +
          fText({ name: 'long', label: 'Full description', value: v.long, max: 3000, rows: 5, hint: 'Shown on the product page under “Description”.' })) +
        section('Photos', 'Portrait photos (3:4) fill the product cards best.',
          fImage({ name: 'img', label: 'Main photo', value: v.img, required: true }) +
          fGallery({ name: 'gallery', label: 'Extra photos', value: v.gallery || [], hint: 'Up to 8 more photos for the product page gallery.' })) +
        section('Price & pack', 'Leave the price empty or 0 to show “Ask us” — customers then ask for the price on WhatsApp.',
          '<div class="grid-3">' +
          fInput({ name: 'weight', label: 'Pack size', value: v.weight, max: 60, placeholder: 'e.g. 100 g' }) +
          fInput({ name: 'price', label: 'Selling price (₹)', value: Number(v.price) || '', type: 'number', min: 0, step: '0.01', inputmode: 'decimal', placeholder: 'Ask us' }) +
          fInput({ name: 'mrp', label: 'MRP (₹)', value: Number(v.mrp) || '', type: 'number', min: 0, step: '0.01', inputmode: 'decimal', hint: 'Shown crossed out when higher than the price.' }) +
          '</div>') +
        section('Product details', 'Everything here is optional — empty fields are simply hidden on the website.',
          fText({ name: 'usage', label: 'How to use', value: v.usage, max: 2000, rows: 4, hint: 'One step per line. Shown as a list in the “How To Use” tab.' }) +
          fText({ name: 'storage', label: 'Storage', value: v.storage, max: 500, rows: 2 }) +
          fInput({ name: 'ingredients', label: 'Ingredients', value: v.ingredients, max: 500 }) +
          '<div class="grid-2">' + fInput({ name: 'shelfLife', label: 'Shelf life', value: v.shelfLife, max: 60, placeholder: 'e.g. 12 months' }) +
          fInput({ name: 'origin', label: 'Origin', value: v.origin, max: 60, placeholder: 'e.g. India' }) + '</div>' +
          fInput({ name: 'tags', label: 'Search keywords', value: (v.tags || []).join(', '), max: 400, hint: 'Comma separated — other names customers may search for, e.g. jathikai, jaiphal.' })) +
        section('Visibility', '',
          fCheck({ name: 'inStock', label: 'In stock', checked: v.inStock !== false, hint: 'When off, the product shows “Out of stock” and customers can send an enquiry instead.' }) +
          fCheck({ name: 'featured', label: 'Feature on the home page', checked: !!v.featured, hint: 'Up to six featured products appear in “Discover Skyrah Goodness” and the hero slideshow.' })) +
        section('Web address', '',
          fInput({ name: 'slug', label: 'Page address', value: v.slug, max: 70, placeholder: 'created from the product name', hint: 'Used in the link: product.html?slug=<b>' + esc(v.slug || 'your-product-name') + '</b>. Changing it breaks links you have already shared.' })),
      onSubmit: async d => {
        if (p) { await api('products/' + encodeURIComponent(p.id), { method: 'PUT', body: d }); return 'Product updated.'; }
        await api('products', { method: 'POST', body: d }); return 'Product added to the shop.';
      }
    });
  }

  /* ---------------- categories ---------------- */
  VIEWS.categories = async function () {
    setHeader('Categories', 'Group your products. The order here is the order on the website.',
      '<button type="button" class="btn btn-primary" id="addCat">' + ic('plus') + '<span class="lbl">Add category</span></button>');
    $('#addCat').addEventListener('click', () => categoryEditor(null));
    const cats = sortedCats();
    $('#content').innerHTML = '<div class="list" id="cList">' + (cats.length
      ? '<div class="row head c-row"><span></span><span>Category</span><span>Products</span><span class="col-order">Order</span><span style="text-align:right">Actions</span></div>' +
        cats.map((c, i) => {
          const n = db.products.filter(p => p.categoryId === c.id).length;
          return '<div class="row c-row"><img class="thumb lg col-media" src="' + esc(site(c.img)) + '" alt="" loading="lazy">' +
            '<div class="col-main" style="min-width:0"><div class="cell-title">' + esc(c.name) + '</div><div class="cell-sub wrap">' + esc(c.description || '—') + '</div></div>' +
            '<div class="col-x"><span class="chip' + (n ? '' : ' red') + '">' + plural(n, 'product') + '</span></div>' +
            moveBtns(c.id, i > 0, i < cats.length - 1) +
            '<div class="row-actions"><a class="icon-btn" href="' + esc(site('shop.html?cat=' + encodeURIComponent(c.name))) + '" target="_blank" rel="noopener" aria-label="View on website" title="View on website">' + ic('external') + '</a>' +
            actionBtn('edit', c.id, 'edit', 'Edit ' + c.name) + actionBtn('delete', c.id, 'trash', 'Delete ' + c.name, 'danger') + '</div></div>';
        }).join('')
      : '<div class="empty"><strong>No categories yet</strong>Categories group your products in the shop.<br><button type="button" class="btn btn-primary" data-act="new">' + ic('plus') + 'Add category</button></div>') + '</div>';
    $('#cList').addEventListener('click', e => {
      const b = e.target.closest('[data-act], [data-move]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'new') return categoryEditor(null);
      const c = db.categories.find(x => x.id === b.dataset.id);
      if (!c) return;
      if (b.dataset.move) return move('categories', sortedCats(), c.id, +b.dataset.move);
      if (b.dataset.act === 'edit') return categoryEditor(c);
      if (b.dataset.act === 'delete') {
        const n = db.products.filter(p => p.categoryId === c.id).length;
        if (n) return toast('“' + c.name + '” still has ' + plural(n, 'product') + '. Move them to another category or delete them first.', 'err');
        return removeItem('categories', c, '“' + c.name + '”');
      }
    });
    if (takeQuick('category')) categoryEditor(null);
  };
  function categoryEditor(c) {
    const v = c || {};
    openDrawer({
      title: c ? 'Edit category' : 'Add a category',
      saveLabel: c ? 'Save changes' : 'Add category',
      html: section('Category', '',
        fInput({ name: 'name', label: 'Category name', value: v.name, required: true, max: 60, placeholder: 'e.g. Spice Powders' }) +
        fInput({ name: 'description', label: 'Short description', value: v.description, max: 200, counter: true }) +
        fImage({ name: 'img', label: 'Category photo', value: v.img && v.img !== 'assets/img/logo.png' ? v.img : '', hint: 'Shown on the “Shop by Range” cards on the home page. Portrait photos work best.' })),
      onSubmit: async d => {
        if (c) { await api('categories/' + encodeURIComponent(c.id), { method: 'PUT', body: d }); return 'Category updated.'; }
        await api('categories', { method: 'POST', body: d }); return 'Category added.';
      }
    });
  }

  /* ---------------- journal ---------------- */
  VIEWS.journal = async function () {
    setHeader('Journal', 'Articles shown on the Journal page and the home page.',
      '<button type="button" class="btn btn-primary" id="addArticle">' + ic('plus') + '<span class="lbl">Write article</span></button>');
    $('#addArticle').addEventListener('click', () => articleEditor(null));
    const list = [...db.articles].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('#content').innerHTML = '<div class="list" id="aList">' + (list.length
      ? '<div class="row head a-row"><span></span><span>Article</span><span>Category</span><span>Date</span><span>Published</span><span style="text-align:right">Actions</span></div>' +
        list.map(a => '<div class="row a-row"><img class="thumb wide col-media" src="' + esc(site(a.img)) + '" alt="" loading="lazy">' +
          '<div class="col-main" style="min-width:0"><div class="cell-title">' + esc(a.title) + '</div><div class="cell-sub">' + esc(a.excerpt) + '</div></div>' +
          '<div class="col-x"><span class="chip">' + esc(a.cat) + '</span></div>' +
          '<div class="col-x"><span class="cell-muted">' + esc(fmtDate(a.date + 'T00:00:00')) + '</span></div>' +
          '<div class="col-x"><label class="switch"><input type="checkbox" data-pub="' + esc(a.id) + '"' + (a.published !== false ? ' checked' : '') + '><span class="track"></span><span>' + (a.published !== false ? 'Live' : 'Draft') + '</span></label></div>' +
          '<div class="row-actions">' + (a.published !== false ? '<a class="icon-btn" href="' + esc(site('journal-post.html?post=' + encodeURIComponent(a.slug))) + '" target="_blank" rel="noopener" aria-label="View on website" title="View on website">' + ic('external') + '</a>' : '') +
          actionBtn('edit', a.id, 'edit', 'Edit ' + a.title) + actionBtn('delete', a.id, 'trash', 'Delete ' + a.title, 'danger') + '</div></div>').join('')
      : '<div class="empty"><strong>No articles yet</strong>Share recipes, spice guides and company news.<br><button type="button" class="btn btn-primary" data-act="new">' + ic('plus') + 'Write article</button></div>') + '</div>';
    $('#aList').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'new') return articleEditor(null);
      const a = db.articles.find(x => x.id === b.dataset.id);
      if (!a) return;
      if (b.dataset.act === 'edit') return articleEditor(a);
      if (b.dataset.act === 'delete') return removeItem('articles', a, 'this article');
    });
    $('#aList').addEventListener('change', async e => {
      const cb = e.target.closest('[data-pub]');
      if (!cb) return;
      const a = db.articles.find(x => x.id === cb.dataset.pub);
      cb.disabled = true;
      try { await api('articles/' + encodeURIComponent(a.id), { method: 'PUT', body: Object.assign({}, a, { published: cb.checked }) }); await render(); toast(cb.checked ? 'Article is live.' : 'Article moved to drafts.'); }
      catch (ex) { cb.checked = !cb.checked; cb.disabled = false; if (ex.status !== 401) toast(ex.message, 'err'); }
    });
    if (takeQuick('article')) articleEditor(null);
  };
  function articleEditor(a) {
    const v = a || { date: today(), author: (db.settings.brand || 'Skyrah Impex') + ' Team', published: true };
    const cats = Array.from(new Set(db.articles.map(x => x.cat).filter(Boolean)));
    openDrawer({
      title: a ? 'Edit article' : 'Write an article',
      saveLabel: a ? 'Save changes' : 'Publish',
      html:
        '<datalist id="artCats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
        section('Article', '',
          fInput({ name: 'title', label: 'Title', value: v.title, required: true, max: 140 }) +
          '<div class="grid-2">' + fInput({ name: 'cat', label: 'Category', value: v.cat, required: true, max: 40, list: 'artCats', placeholder: 'e.g. Recipes & Tips' }) +
          fInput({ name: 'date', label: 'Date', value: v.date, required: true, type: 'date' }) + '</div>' +
          fImage({ name: 'img', label: 'Cover photo', value: v.img, required: true, wide: true }) +
          fText({ name: 'excerpt', label: 'Summary', value: v.excerpt, required: true, max: 300, counter: true, rows: 2, hint: 'One or two sentences shown under the title in search results and shares.' }) +
          fText({ name: 'body', label: 'Article text', value: v.body, required: true, max: 30000, rows: 14, tall: true }) +
          '<div class="help">Formatting: leave a blank line between paragraphs · <code>## Heading</code> for a sub-heading · <code>- item</code> for a bullet list · <code>&gt; text</code> for a highlighted quote.</div>') +
        section('Details', '',
          '<div class="grid-2">' + fInput({ name: 'author', label: 'Author', value: v.author, max: 80 }) +
          fInput({ name: 'readTime', label: 'Read time', value: v.readTime, max: 30, placeholder: 'worked out automatically' }) + '</div>' +
          fInput({ name: 'tags', label: 'Tags', value: (v.tags || []).join(', '), max: 400, hint: 'Comma separated, e.g. nutmeg, recipes' }) +
          fInput({ name: 'slug', label: 'Page address', value: v.slug, max: 70, placeholder: 'created from the title', hint: 'Used in the link: journal-post.html?post=<b>' + esc(v.slug || 'your-article-title') + '</b>' }) +
          fCheck({ name: 'published', label: 'Published', checked: v.published !== false, hint: 'Untick to keep this article as a draft that is not shown on the website.' })),
      onSubmit: async d => {
        if (!String(d.readTime).trim()) {
          const words = String(d.body).trim().split(/\s+/).filter(Boolean).length;
          d.readTime = Math.max(1, Math.round(words / 200)) + ' min read';
        }
        if (a) { await api('articles/' + encodeURIComponent(a.id), { method: 'PUT', body: d }); return 'Article saved.'; }
        await api('articles', { method: 'POST', body: d }); return d.published ? 'Article published.' : 'Draft saved.';
      }
    });
  }

  /* ---------------- FAQs ---------------- */
  VIEWS.faqs = async function () {
    setHeader('FAQs', 'Questions and answers on the FAQs page, grouped by topic.',
      '<button type="button" class="btn btn-primary" id="addFaq">' + ic('plus') + '<span class="lbl">Add question</span></button>');
    $('#addFaq').addEventListener('click', () => faqEditor(null));
    const list = [...db.faqs].sort(byOrder);
    $('#content').innerHTML = '<div class="list" id="fList">' + (list.length
      ? '<div class="row head f-row"><span>Question</span><span class="col-order">Order</span><span style="text-align:right">Actions</span></div>' +
        list.map((f, i) => '<div class="row f-row"><div class="col-main" style="min-width:0"><div class="cell-title"><span class="chip">' + esc(f.cat) + '</span> ' + esc(f.q) + '</div><div class="cell-sub">' + esc(f.a) + '</div></div>' +
          moveBtns(f.id, i > 0, i < list.length - 1) +
          '<div class="row-actions">' + actionBtn('edit', f.id, 'edit', 'Edit question') + actionBtn('delete', f.id, 'trash', 'Delete question', 'danger') + '</div></div>').join('')
      : '<div class="empty"><strong>No questions yet</strong><button type="button" class="btn btn-primary" data-act="new">' + ic('plus') + 'Add question</button></div>') + '</div>';
    $('#fList').addEventListener('click', e => {
      const b = e.target.closest('[data-act], [data-move]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'new') return faqEditor(null);
      const f = db.faqs.find(x => x.id === b.dataset.id);
      if (!f) return;
      if (b.dataset.move) return move('faqs', [...db.faqs].sort(byOrder), f.id, +b.dataset.move);
      if (b.dataset.act === 'edit') return faqEditor(f);
      if (b.dataset.act === 'delete') return removeItem('faqs', f, 'this question');
    });
  };
  function faqEditor(f) {
    const v = f || {};
    const topics = Array.from(new Set(db.faqs.map(x => x.cat).filter(Boolean)));
    openDrawer({
      title: f ? 'Edit question' : 'Add a question',
      saveLabel: f ? 'Save changes' : 'Add question',
      html: '<datalist id="faqTopics">' + topics.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
        section('Question', 'Topics become the filter buttons on the FAQs page.',
          fInput({ name: 'cat', label: 'Topic', value: v.cat, required: true, max: 40, list: 'faqTopics', placeholder: 'e.g. Shipping' }) +
          fInput({ name: 'q', label: 'Question', value: v.q, required: true, max: 200 }) +
          fText({ name: 'a', label: 'Answer', value: v.a, required: true, max: 2000, rows: 6 })),
      onSubmit: async d => {
        if (f) { await api('faqs/' + encodeURIComponent(f.id), { method: 'PUT', body: d }); return 'Question updated.'; }
        await api('faqs', { method: 'POST', body: d }); return 'Question added.';
      }
    });
  }

  /* ---------------- testimonials ---------------- */
  VIEWS.testimonials = async function () {
    setHeader('Testimonials', 'Customer reviews shown on the home page.',
      '<button type="button" class="btn btn-primary" id="addTesti">' + ic('plus') + '<span class="lbl">Add review</span></button>');
    $('#addTesti').addEventListener('click', () => testimonialEditor(null));
    const list = [...db.testimonials].sort(byOrder);
    $('#content').innerHTML =
      '<div class="alert alert-info" style="margin-bottom:16px">Only add genuine reviews from real customers, with their permission. The testimonials section appears on the home page automatically once there is at least one review, and stays hidden when the list is empty.</div>' +
      '<div class="list" id="tList">' + (list.length
        ? '<div class="row head t-row"><span>Review</span><span>Rating</span><span class="col-order">Order</span><span style="text-align:right">Actions</span></div>' +
          list.map((t, i) => '<div class="row t-row"><div class="col-main" style="min-width:0"><div class="cell-title">“' + esc(t.quote) + '”</div><div class="cell-sub">' + esc(t.name) + (t.place ? ' · ' + esc(t.place) : '') + '</div></div>' +
            '<div class="col-x"><span class="cell-muted">' + (t.rating ? '★'.repeat(t.rating) : 'No stars') + '</span></div>' +
            moveBtns(t.id, i > 0, i < list.length - 1) +
            '<div class="row-actions">' + actionBtn('edit', t.id, 'edit', 'Edit review') + actionBtn('delete', t.id, 'trash', 'Delete review', 'danger') + '</div></div>').join('')
        : '<div class="empty"><strong>No reviews yet</strong>When a customer sends you kind words, add them here.<br><button type="button" class="btn btn-primary" data-act="new">' + ic('plus') + 'Add review</button></div>') + '</div>';
    $('#tList').addEventListener('click', e => {
      const b = e.target.closest('[data-act], [data-move]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'new') return testimonialEditor(null);
      const t = db.testimonials.find(x => x.id === b.dataset.id);
      if (!t) return;
      if (b.dataset.move) return move('testimonials', [...db.testimonials].sort(byOrder), t.id, +b.dataset.move);
      if (b.dataset.act === 'edit') return testimonialEditor(t);
      if (b.dataset.act === 'delete') return removeItem('testimonials', t, 'this review');
    });
  };
  function testimonialEditor(t) {
    const v = t || { rating: 5 };
    openDrawer({
      title: t ? 'Edit review' : 'Add a review',
      saveLabel: t ? 'Save changes' : 'Add review',
      html: section('Review', '',
        fText({ name: 'quote', label: 'What the customer said', value: v.quote, required: true, max: 400, counter: true, rows: 4 }) +
        '<div class="grid-2">' + fInput({ name: 'name', label: 'Customer name', value: v.name, required: true, max: 60, placeholder: 'e.g. Priya R.' }) +
        fInput({ name: 'place', label: 'City / country', value: v.place, max: 60 }) + '</div>' +
        fSelect({ name: 'rating', label: 'Star rating', value: v.rating ?? 5, options: [[5, '★★★★★  5 stars'], [4, '★★★★  4 stars'], [3, '★★★  3 stars'], [2, '★★  2 stars'], [1, '★  1 star'], [0, 'Do not show stars']] })),
      onSubmit: async d => {
        d.rating = Number(d.rating);
        if (t) { await api('testimonials/' + encodeURIComponent(t.id), { method: 'PUT', body: d }); return 'Review updated.'; }
        await api('testimonials', { method: 'POST', body: d }); return 'Review added.';
      }
    });
  }

  /* ---------------- enquiries ---------------- */
  VIEWS.enquiries = async function () {
    setHeader('Enquiries', 'Messages sent from the Contact page.',
      '<button type="button" class="btn btn-ghost" id="refreshEnq">' + ic('inbox') + '<span class="lbl">Refresh</span></button>');
    $('#refreshEnq').addEventListener('click', async () => { await render(); });
    enquiries = await api('enquiries');
    const counts = { all: enquiries.length, new: 0, read: 0, replied: 0 };
    enquiries.forEach(q => { counts[q.status] = (counts[q.status] || 0) + 1; });
    const TABS = [['all', 'All'], ['new', 'New'], ['read', 'Read'], ['replied', 'Replied']];
    $('#content').innerHTML =
      '<div class="toolbar"><div class="tabs" role="tablist">' + TABS.map(t => '<button type="button" role="tab" class="tab' + (ui.enqTab === t[0] ? ' on' : '') + '" aria-selected="' + (ui.enqTab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + ' (' + (counts[t[0]] || 0) + ')</button>').join('') + '</div>' +
      '<label class="search"><span class="sr-only">Search enquiries</span>' + ic('search') + '<input type="search" id="eSearch" placeholder="Search name, email, phone or message" value="' + esc(ui.enqQuery) + '"></label></div>' +
      '<div class="list" id="eList"></div>';
    const draw = () => {
      const q = ui.enqQuery.trim().toLowerCase();
      const list = enquiries.filter(x => (ui.enqTab === 'all' || x.status === ui.enqTab) && (!q || [x.name, x.email, x.phone, x.subject, x.message, x.product].join(' ').toLowerCase().includes(q)));
      if (!list.length) {
        $('#eList').innerHTML = '<div class="empty"><strong>' + (enquiries.length ? 'Nothing here' : 'No enquiries yet') + '</strong>' + (enquiries.length ? 'Try another tab or search.' : 'When someone sends a message from the Contact page, it will appear here.') + '</div>';
        return;
      }
      $('#eList').innerHTML = list.map(x => {
        const open = ui.enqOpen === x.id;
        const digits = String(x.phone).replace(/\D/g, '');
        const wa = digits.length === 10 ? '91' + digits : digits;
        const reply = 'mailto:' + encodeURIComponent(x.email) + '?subject=' + encodeURIComponent('Re: ' + x.subject + (x.product ? ' — ' + x.product : '')) + '&body=' + encodeURIComponent('Dear ' + x.name + ',\n\nThank you for contacting ' + (db.settings.brand || 'us') + '.\n\n');
        return '<div class="enq' + (x.status === 'new' ? ' is-new' : '') + (open ? ' open' : '') + '">' +
          '<button type="button" class="enq-head" data-toggle="' + esc(x.id) + '" aria-expanded="' + open + '">' +
          '<span class="new-dot' + (x.status === 'new' ? '' : ' read') + '" title="' + (x.status === 'new' ? 'New' : x.status === 'replied' ? 'Replied' : 'Read') + '"></span>' +
          '<span style="min-width:0"><span class="cell-title" style="display:block">' + esc(x.name) + '</span><span class="cell-sub" style="display:block">' + esc(x.subject) + (x.product ? ' · ' + esc(x.product) : '') + '</span></span>' +
          '<span class="cell-sub enq-sub">' + esc(x.message) + '</span>' +
          '<span class="cell-muted enq-date">' + esc(fmtDateTime(x.createdAt)) + (x.status === 'replied' ? ' · <span class="chip green">Replied</span>' : '') + '</span>' +
          ic('chevron', 'chev') + '</button>' +
          (open ? '<div class="enq-body"><div class="enq-meta">' +
            '<span>' + ic('mail') + ' <a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a></span>' +
            '<span>' + ic('phone') + ' <a href="tel:' + esc(x.phone.replace(/[^\d+]/g, '')) + '">' + esc(x.phone) + '</a></span>' +
            '<span class="cell-muted">' + esc(fmtDateTime(x.createdAt)) + '</span></div>' +
            '<div class="enq-msg">' + esc(x.message) + '</div>' +
            '<div class="enq-actions">' +
            '<a class="btn btn-primary btn-sm" href="' + esc(reply) + '">' + ic('mail') + 'Reply by email</a>' +
            (wa.length >= 10 ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent('Hello ' + x.name + ', thank you for contacting ' + (db.settings.brand || 'us') + '.') + '">' + ic('chat') + 'WhatsApp</a>' : '') +
            (x.status !== 'replied' ? '<button type="button" class="btn btn-ghost btn-sm" data-status="replied" data-id="' + esc(x.id) + '">' + ic('check') + 'Mark as replied</button>' : '') +
            (x.status !== 'new' ? '<button type="button" class="btn btn-ghost btn-sm" data-status="new" data-id="' + esc(x.id) + '">Mark as new</button>' : '') +
            '<button type="button" class="btn btn-ghost btn-sm" data-del="' + esc(x.id) + '" style="color:var(--red)">' + ic('trash') + 'Delete</button>' +
            '</div></div>' : '') + '</div>';
      }).join('');
    };
    const setStatus = async (id, status, silent) => {
      await api('enquiries/' + encodeURIComponent(id), { method: 'PATCH', body: { status } });
      const x = enquiries.find(e => e.id === id); if (x) x.status = status;
      newEnquiries = enquiries.filter(e => e.status === 'new').length;
      renderNav();
      if (!silent) toast(status === 'replied' ? 'Marked as replied.' : 'Marked as new.');
    };
    draw();
    $$('.tab', $('#content')).forEach(t => t.addEventListener('click', () => { ui.enqTab = t.dataset.tab; render(); }));
    $('#eSearch').addEventListener('input', e => { ui.enqQuery = e.target.value; draw(); });
    $('#eList').addEventListener('click', async e => {
      const t = e.target.closest('[data-toggle]'), s = e.target.closest('[data-status]'), d = e.target.closest('[data-del]');
      try {
        if (t) {
          const id = t.dataset.toggle;
          ui.enqOpen = ui.enqOpen === id ? null : id;
          const x = enquiries.find(q => q.id === id);
          if (ui.enqOpen && x && x.status === 'new') await setStatus(id, 'read', true);
          draw();
          const head = $('[data-toggle="' + CSS.escape(id) + '"]'); head && head.focus();
        } else if (s) { await setStatus(s.dataset.id, s.dataset.status); draw(); }
        else if (d) {
          if (!(await confirmBox({ title: 'Delete this enquiry?', text: 'The message will be permanently removed.' }))) return;
          await api('enquiries/' + encodeURIComponent(d.dataset.del), { method: 'DELETE' });
          enquiries = enquiries.filter(q => q.id !== d.dataset.del);
          newEnquiries = enquiries.filter(q => q.status === 'new').length;
          renderNav(); render(); toast('Enquiry deleted.');
        }
      } catch (ex) { if (ex.status !== 401) toast(ex.message, 'err'); }
    });
  };

  /* ---------------- company details ---------------- */
  VIEWS.company = async function () {
    setHeader('Company details', 'Shown in the footer, Contact page, product pages and WhatsApp buttons across the website.');
    const s = db.settings, so = s.social || {};
    $('#content').innerHTML = '<form id="sForm" novalidate><div class="alert alert-err" id="sErr" role="alert" hidden style="margin-bottom:14px"></div>' +
      section('Company', '',
        '<div class="grid-2">' + fInput({ name: 'legalName', label: 'Registered company name', value: s.legalName, required: true, max: 120 }) +
        fInput({ name: 'brand', label: 'Brand name', value: s.brand, required: true, max: 60, hint: 'Short name used in page titles and WhatsApp messages.' }) +
        fInput({ name: 'tagline', label: 'Tagline', value: s.tagline, max: 120 }) +
        fInput({ name: 'businessLine', label: 'Business line', value: s.businessLine, max: 80, placeholder: 'e.g. Import & Export' }) +
        fInput({ name: 'director', label: 'Contact person', value: s.director, max: 80 }) +
        fInput({ name: 'directorTitle', label: 'Their title', value: s.directorTitle, max: 60, placeholder: 'e.g. Director' }) + '</div>') +
      section('Phone, WhatsApp & email', '',
        '<div class="grid-2">' + fInput({ name: 'phone1', label: 'Primary phone', value: s.phone1, required: true, max: 30, type: 'tel', placeholder: '+91 90254 48350' }) +
        fInput({ name: 'whatsapp', label: 'WhatsApp ordering number', value: s.whatsapp, required: true, max: 20, inputmode: 'numeric', hint: 'Country code + number, digits only, e.g. 919025448350. All “Order on WhatsApp” buttons use this.' }) +
        fInput({ name: 'email', label: 'Email', value: s.email, required: true, max: 120, type: 'email' }) +
        fInput({ name: 'website', label: 'Website', value: s.website, max: 120, placeholder: 'www.skyrahimpex.com' }) +
        fInput({ name: 'hours', label: 'Business hours', value: s.hours, max: 120 }) + '</div>') +
      section('Address', '',
        fText({ name: 'address', label: 'Address', value: s.address, required: true, max: 300, rows: 2 }) +
        fInput({ name: 'mapQuery', label: 'Map search text', value: s.mapQuery, max: 300, hint: 'What to search on Google Maps for the Contact page map. Leave empty to use the address.' })) +
      section('Registrations', 'Shown in the footer and on product pages when filled in.',
        '<div class="grid-3">' + fInput({ name: 'fssai', label: 'FSSAI licence no.', value: s.fssai, max: 40 }) +
        fInput({ name: 'gstin', label: 'GSTIN', value: s.gstin, max: 30 }) +
        fInput({ name: 'iec', label: 'IEC (Import Export Code)', value: s.iec, max: 30 }) + '</div>') +
      section('Shipping note', 'Shown in the “Shipping” tab on every product page.',
        fText({ name: 'shippingNote', label: 'Shipping text', value: s.shippingNote, max: 1000, rows: 3 })) +
      section('Social media', 'Icons appear in the footer and mobile menu only for links you fill in.',
        '<div class="grid-2">' + fInput({ name: 'instagram', label: 'Instagram link', value: so.instagram, max: 300, type: 'url', placeholder: 'https://instagram.com/…' }) +
        fInput({ name: 'facebook', label: 'Facebook link', value: so.facebook, max: 300, type: 'url', placeholder: 'https://facebook.com/…' }) +
        fInput({ name: 'linkedin', label: 'LinkedIn link', value: so.linkedin, max: 300, type: 'url', placeholder: 'https://linkedin.com/company/…' }) +
        fInput({ name: 'youtube', label: 'YouTube link', value: so.youtube, max: 300, type: 'url', placeholder: 'https://youtube.com/@…' }) + '</div>') +
      '<div class="settings-foot"><button type="button" class="btn btn-ghost" id="sReset">Undo changes</button><button class="btn btn-primary" id="sSave">Save company details</button></div></form>';
    const form = $('#sForm');
    const snap = JSON.stringify(formData(form));
    settingsDirty = () => document.body.contains(form) && JSON.stringify(formData(form)) !== snap;
    $('#sReset').addEventListener('click', () => { settingsDirty = () => false; render(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('#sErr'); err.hidden = true;
      if (!validate(form)) { err.hidden = false; err.textContent = 'Please fill in the highlighted fields.'; return; }
      const d = formData(form);
      const wa = String(d.whatsapp).replace(/\D/g, '');
      if (wa.length < 10 || wa.length > 15) { const f = $('[data-field="whatsapp"]'); f.classList.add('has-err'); $('.field-err', f).textContent = 'Enter 10–15 digits including the country code, e.g. 919025448350.'; $('#f_whatsapp').focus(); return; }
      let badUrl = null;
      ['instagram', 'facebook', 'linkedin', 'youtube'].forEach(k => { if (d[k] && !/^https:\/\/\S+$/i.test(d[k].trim()) && !badUrl) badUrl = k; });
      if (badUrl) { const f = $('[data-field="' + badUrl + '"]'); f.classList.add('has-err'); $('.field-err', f).textContent = 'Paste the full link, starting with https://'; $('#f_' + badUrl).focus(); return; }
      d.social = { instagram: d.instagram.trim(), facebook: d.facebook.trim(), linkedin: d.linkedin.trim(), youtube: d.youtube.trim() };
      const btn = $('#sSave'); btn.setAttribute('aria-busy', 'true');
      try {
        await api('settings', { method: 'PUT', body: d });
        settingsDirty = () => false;
        await render();
        toast('Company details saved. The website is updated.');
      } catch (ex) { if (ex.status !== 401) { err.hidden = false; err.textContent = ex.message; window.scrollTo({ top: 0, behavior: 'smooth' }); } }
      finally { btn.removeAttribute('aria-busy'); }
    });
  };

  /* ---------------- password & backup ---------------- */
  VIEWS.account = async function () {
    setHeader('Password & backup', 'Keep your admin panel secure and your content safe.');
    $('#content').innerHTML =
      '<form id="pwForm" novalidate class="form-section" style="max-width:560px"><h3>Change admin password</h3><p class="sec-sub">Use at least 8 characters. Changing it signs out every other device.</p>' +
      '<div class="alert alert-err" id="pwErr" role="alert" hidden style="margin-bottom:14px"></div>' +
      pwField('pwCur', 'Current password', 'current-password') + pwField('pwNew', 'New password', 'new-password', 'At least 8 characters — a short phrase is easy to remember and hard to guess.') + pwField('pwNew2', 'Repeat new password', 'new-password') +
      '<button class="btn btn-primary" id="pwSave">Update password</button></form>' +
      '<div class="form-section" style="max-width:560px"><h3>Backup</h3><p class="sec-sub">Download a copy of all products, categories, articles, FAQs, reviews, company details and enquiries. Automatic copies of your data are also kept on the server in <code>data/backups</code> every time you save.</p>' +
      '<button type="button" class="btn btn-ghost" id="dlBackup">' + ic('download') + 'Download backup</button></div>';
    $$('[data-eye]', $('#content')).forEach(b => setEye(b, false));
    $('#pwForm').addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('#pwErr'); err.hidden = true;
      const cur = $('#pwCur').value, n1 = $('#pwNew').value, n2 = $('#pwNew2').value;
      const fail = (msg, id) => { err.hidden = false; err.textContent = msg; $('#' + id).focus(); };
      if (!cur) return fail('Enter your current password.', 'pwCur');
      if (n1.length < 8) return fail('The new password must be at least 8 characters.', 'pwNew');
      if (n1 !== n2) return fail('The two new passwords do not match.', 'pwNew2');
      if (n1 === cur) return fail('The new password must be different from the current one.', 'pwNew');
      const btn = $('#pwSave'); btn.setAttribute('aria-busy', 'true');
      try {
        const r = await api('password', { method: 'POST', body: { current: cur, next: n1 } });
        setToken(r.token);
        e.target.reset();
        await render();
        toast('Password changed.');
      } catch (ex) { if (ex.status !== 401) fail(ex.message, 'pwCur'); }
      finally { btn.removeAttribute('aria-busy'); }
    });
    $('#dlBackup').addEventListener('click', async e => {
      const btn = e.currentTarget; btn.setAttribute('aria-busy', 'true');
      try {
        const res = await api('backup', { raw: true });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'skyrah-backup-' + today() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast('Backup downloaded.');
      } catch (ex) { if (ex.status !== 401) toast(ex.message, 'err'); }
      finally { btn.removeAttribute('aria-busy'); }
    });
  };
  function pwField(id, label, ac, hint) {
    return '<label class="field"><span class="field-label">' + label + '</span><span class="pw-wrap"><input type="password" id="' + id + '" autocomplete="' + ac + '"><button type="button" class="pw-eye" data-eye="' + id + '"></button></span>' + (hint ? '<span class="field-hint">' + hint + '</span>' : '') + '</label>';
  }

  /* ================================================================ start */
  async function startApp() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    await loadStore();
    lastHash = location.hash;
    await render(true);
  }
  (async function init() {
    if (!token) return showLogin('');
    try {
      const r = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (!r.ok) { setToken(''); return showLogin(r.status === 401 ? '' : 'Could not check your session. Please sign in.'); }
      await startApp();
    } catch (e) { showLogin('Cannot reach the server. Check your internet connection and reload the page.'); }
  })();
})();
