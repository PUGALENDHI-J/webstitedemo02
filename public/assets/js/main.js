/* ==========================================================
   Skyrah Impex — shared site behaviour
   Loaded on every page after gsap, ScrollTrigger, products-data.js
   ========================================================== */

/* ---------- GSAP CDN fallback shim ----------
   If the GSAP / ScrollTrigger CDN scripts fail to load (blocked network,
   ad-blocker, offline), every .reveal / gsap.set(...,{opacity:0}) element
   on the page would otherwise stay permanently invisible and this whole
   script would throw on the very first line, breaking the mobile nav
   drawer too. This shim provides just enough of the API surface so that
   when GSAP is missing, elements simply appear in their final state
   (no animation) instead of vanishing or breaking navigation. */
if (typeof window.gsap === 'undefined') {
  (function () {
    function toElements(targets) {
      if (!targets) return [];
      if (typeof targets === 'string') return Array.prototype.slice.call(document.querySelectorAll(targets));
      if (targets.nodeType) return [targets];
      if (typeof targets.length === 'number') return Array.prototype.slice.call(targets);
      return null; // plain object target (e.g. counter animations)
    }
    function applyFinalVars(target, vars) {
      if (!vars) return;
      const els = toElements(target);
      if (els === null) {
        // plain object target used as an animation proxy (e.g. {v:0} -> {v:100})
        Object.keys(vars).forEach(function (k) {
          if (typeof vars[k] === 'number') target[k] = vars[k];
        });
        if (typeof vars.onUpdate === 'function') vars.onUpdate.call({ targets: function () { return [target]; } });
        if (typeof vars.onComplete === 'function') vars.onComplete();
        return;
      }
      els.forEach(function (el) {
        if (!el || !el.style) return;
        if ('opacity' in vars) el.style.opacity = vars.opacity;
        if ('clipPath' in vars) el.style.clipPath = vars.clipPath;
        // Build an explicit transform so we always win over any stylesheet
        // transform (e.g. .reveal{transform:translateY(50px)}) — inline
        // styles beat stylesheet rules, but only when given a real value,
        // not an empty string.
        const hasX = 'x' in vars, hasY = 'y' in vars, hasXP = 'xPercent' in vars, hasYP = 'yPercent' in vars,
          hasScale = 'scale' in vars, hasRotate = 'rotate' in vars;
        if (hasX || hasY || hasXP || hasYP || hasScale || hasRotate) {
          const parts = [];
          if (hasX || hasY) parts.push('translate(' + (hasX ? vars.x : 0) + 'px,' + (hasY ? vars.y : 0) + 'px)');
          if (hasXP || hasYP) parts.push('translate(' + (hasXP ? vars.xPercent : 0) + '%,' + (hasYP ? vars.yPercent : 0) + '%)');
          if (hasScale) parts.push('scale(' + vars.scale + ')');
          if (hasRotate) parts.push('rotate(' + vars.rotate + 'deg)');
          el.style.transform = parts.join(' ');
        }
      });
      if (typeof vars.onComplete === 'function') vars.onComplete();
    }
    const stub = {
      registerPlugin: function () {},
      set: function (target, vars) { applyFinalVars(target, vars); },
      to: function (target, vars) { applyFinalVars(target, vars); return stub.timeline(); },
      from: function () { return stub.timeline(); },
      timeline: function () {
        const tl = {
          to: function (target, vars) { applyFinalVars(target, vars); return tl; },
          set: function (target, vars) { applyFinalVars(target, vars); return tl; },
          fromTo: function (target, from, to) { applyFinalVars(target, to); return tl; }
        };
        return tl;
      },
      utils: {
        toArray: function (sel) { return toElements(sel) || []; }
      }
    };
    window.gsap = stub;
    window.ScrollTrigger = {
      create: function (cfg) { if (cfg && typeof cfg.onEnter === 'function') cfg.onEnter(); },
      refresh: function () {}
    };
  })();
}

gsap.registerPlugin(ScrollTrigger);

/* Decorative imagery site-wide: data-img/data-bg values are either a
   product slug or a real file path, resolved via resolveImageKey(). */
document.querySelectorAll("img[data-img]").forEach(function(el){
  const src = resolveImageKey(el.dataset.img);
  if(src) el.src = src;
});
document.querySelectorAll("[data-bg]").forEach(function(el){
  const src = resolveImageKey(el.dataset.bg);
  if(src){
    el.style.backgroundImage = "url(" + src + ")";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }
});

window.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.isMobile = window.matchMedia('(max-width:900px)').matches;

/* ---------- nav scroll state ---------- */
const nav = document.getElementById('mainNav');
if(nav){
  ScrollTrigger.create({
    start: 60, end: 99999,
    onUpdate: self => nav.classList.toggle('scrolled', self.scroll() > 60)
  });
}

/* ---------- generic reveal-on-scroll ---------- */
gsap.utils.toArray('.reveal').forEach(el=>{
  gsap.to(el, {
    opacity:1, y:0, duration:1, ease:'cubic-bezier(0.16,1,0.3,1)',
    scrollTrigger:{trigger:el, start:'top 85%'}
  });
});

/* ---------- mark active nav link ---------- */
(function(){
  const here = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[href]').forEach(a=>{
    const href = a.getAttribute('href').split('/').pop();
    if(href === here) a.classList.add('active');
  });
})();

/* ---------- simple toast helper (used on shop / product pages) ---------- */
function showToast(msg){
  let t = document.querySelector('.toast');
  if(!t){
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2400);
}

/* ---------- graceful missing-image fallback ----------
   Attach onerror="handleImgError(this)" to any <img> whose src comes from
   product/asset data, so a broken file never shows the browser's broken-image icon. */
window.handleImgError = function(img){
  if(img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  img.src = 'assets/img/logo.png';
  img.alt = img.alt || (typeof SITE !== 'undefined' ? SITE.brand : '');
  img.classList.add('img-fallback');
};

/* ==========================================================
   SITE SEARCH
   Works entirely against the existing PRODUCTS catalogue
   (assets/js/products-data.js), on every page. Matches are
   case-insensitive, partial, and check name/category/
   description/tags. No duplicate product data is created.
   ========================================================== */
(function(){
  if(typeof PRODUCTS === 'undefined') return; // safety: products-data.js must load first

  /* ---- build overlay markup once and append to body ---- */
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'searchOverlay';
  overlay.innerHTML = `
    <div class="search-overlay-backdrop" id="searchOverlayBackdrop"></div>
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search products">
      <div class="search-panel-head">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="search-input" id="searchInput" placeholder="Search products…" autocomplete="off" aria-label="Search products">
        <button type="button" class="search-close" id="searchCloseBtn" aria-label="Close search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 16M20 4 4 20"/></svg>
        </button>
      </div>
      <div class="search-results" id="searchResults">
        <div class="search-hint">Start typing a product name — e.g. "nutmeg" or "powder".</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const searchBackdrop = document.getElementById('searchOverlayBackdrop');
  const searchCloseBtn = document.getElementById('searchCloseBtn');

  function openSearch(){
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(()=> searchInput.focus(), 50);
  }
  function closeSearch(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* Every "Search" icon in the header (desktop nav + any duplicate in a
     mobile drawer) opens the same overlay — normalized via aria-label so
     it keeps working even if markup on a page differs slightly. */
  document.querySelectorAll('#searchToggle, [aria-label="Search"]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      openSearch();
    });
  });

  searchCloseBtn.addEventListener('click', closeSearch);
  searchBackdrop.addEventListener('click', closeSearch);
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
  });

  function renderResults(query){
    const q = query.trim().toLowerCase();
    if(!q){
      searchResults.innerHTML = '<div class="search-hint">Start typing a product name — e.g. "nutmeg" or "powder".</div>';
      return;
    }
    const matches = PRODUCTS.filter(p=>{
      const haystack = [p.name, p.cat, p.desc, ...(p.tags||[])].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    if(matches.length === 0){
      searchResults.innerHTML = `<div class="search-empty">No products found for "${escHtml(query.trim())}".</div>`;
      return;
    }
    searchResults.innerHTML = matches.map(p => `
      <a class="search-result-item" href="${productUrl(p)}">
        <div class="search-result-thumb"><img src="${escHtml(resolveProductImage(p))}" alt="${escHtml(p.name)}" onerror="handleImgError(this)"></div>
        <div class="search-result-info">
          <h4>${escHtml(p.name)}</h4>
          <p>${escHtml(p.cat)}${p.weight ? ' &middot; ' + escHtml(p.weight) : ''}</p>
        </div>
        <div class="search-result-price">${formatINR(p.price)}</div>
      </a>
    `).join('');
  }

  searchInput.addEventListener('input', ()=> renderResults(searchInput.value));

  /* keyboard shortcut: "/" opens search when not already typing somewhere */
  document.addEventListener('keydown', (e)=>{
    if(e.key === '/' && !overlay.classList.contains('open')){
      const tag = (e.target.tagName||'').toLowerCase();
      if(tag !== 'input' && tag !== 'textarea'){
        e.preventDefault();
        openSearch();
      }
    }
  });
})();

window.addEventListener('load', ()=> ScrollTrigger.refresh());

/* ---------- SCROLL TO TOP BUTTON ---------- */
(function(){
  const btn = document.createElement('button');
  btn.className = 'scroll-top-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(btn);

  function toggleVisibility(){
    btn.classList.toggle('visible', window.scrollY > 400);
  }
  window.addEventListener('scroll', toggleVisibility, { passive:true });
  toggleVisibility();

  btn.addEventListener('click', ()=>{
    window.scrollTo({ top:0, behavior:'smooth' });
  });
})();
