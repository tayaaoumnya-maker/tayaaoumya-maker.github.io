// script.js
(() => {
  'use strict';

  /* ---------- Utils ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* ---------- Accordions / See more ---------- */
  function initAccordions() {
    const toggles = $$('.see-more');
    toggles.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = btn.closest('.card');
        if (!card) return;
        card.classList.toggle('expanded');
        btn.textContent = card.classList.contains('expanded') ? 'Réduire' : 'Voir plus';
        btn.setAttribute('aria-expanded', card.classList.contains('expanded'));
      });
    });
  }

  /* ---------- Copy buttons ---------- */
  function initCopyButtons() {
    // If copy buttons exist inside .code blocks
    const codeBlocks = $$('.code');
    codeBlocks.forEach(code => {
      // add copy button if missing
      if (!$('.copy-btn', code)) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'copy-btn';
        c.textContent = 'Copier';
        c.setAttribute('aria-label', 'Copier le code');
        code.appendChild(c);
      }
    });

    on(document, 'click', async (ev) => {
      const btn = ev.target.closest?.('.copy-btn');
      if (!btn) return;
      const code = btn.closest('.code');
      let text = '';
      if (code) text = code.innerText.replace(/Copier|Copied|Copié/gi, '').trim();
      else {
        // fallback: try card body
        const card = btn.closest('.card');
        if (card) text = (card.querySelector('.card-body')?.innerText || '').trim();
      }
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = 'Copié ✓';
        setTimeout(() => btn.textContent = prev, 1500);
      } catch (err) {
        // fallback: select & execCommand
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); btn.textContent = 'Copié ✓'; }
        catch (e) { btn.textContent = 'Erreur'; }
        setTimeout(() => { btn.textContent = 'Copier'; document.body.removeChild(ta); }, 1200);
      }
    });
  }

  /* ---------- Live search (simple full-text) ---------- */
  function initSearch() {
    const searchInput = $('.search input');
    if (!searchInput) return;

    const cards = $$('.card');
    const normalize = s => s?.toString().toLowerCase?.() ?? '';

    const doFilter = debounce(() => {
      const q = normalize(searchInput.value).trim();
      if (!q) {
        cards.forEach(c => c.style.display = '');
        return;
      }
      const parts = q.split(/\s+/).filter(Boolean);
      cards.forEach(card => {
        const text = normalize(card.innerText);
        const matched = parts.every(p => text.includes(p));
        card.style.display = matched ? '' : 'none';
      });
    }, 160);

    on(searchInput, 'input', doFilter);
    on(searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') searchInput.value = '', searchInput.dispatchEvent(new Event('input'));
    });
  }

  /* ---------- Table of Contents: smooth scroll & active link ---------- */
  function initTOC() {
    const tocLinks = $$('.toc a');
    if (!tocLinks.length) return;

    // Smooth scroll
    tocLinks.forEach(a => {
      a.addEventListener('click', (ev) => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        ev.preventDefault();
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // update active immediately
        tocLinks.forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        history.replaceState(null, '', href);
      });
    });

    // Active on scroll (intersection observer)
    const headings = tocLinks
      .map(a => document.getElementById(a.getAttribute('href')?.slice(1)))
      .filter(Boolean);

    if (!headings.length) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) {
        const id = visible[0].target.id;
        tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    }, {
      root: null,
      rootMargin: '0px 0px -60% 0px', // consider heading "active" earlier
      threshold: [0, 0.1, 0.5, 1]
    });

    headings.forEach(h => observer.observe(h));
  }

  /* ---------- Initialize cards: add missing copy buttons and see-more as needed ---------- */
  function enhanceCards() {
    const cards = $$('.card');
    cards.forEach(card => {
      // add see-more if body overflows (approximation)
      const body = card.querySelector('.card-body');
      const btnExists = card.querySelector('.see-more');
      if (body && !btnExists) {
        const needs = body.scrollHeight > 180; // threshold
        if (needs) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'see-more';
          btn.textContent = 'Voir plus';
          btn.setAttribute('aria-expanded', 'false');
          card.appendChild(btn);
        }
      }

      // add copy for whole note (optional)
      if (!card.querySelector('.copy-card')) {
        const f = card.querySelector('.card-footer');
        if (f) {
          const cbtn = document.createElement('button');
          cbtn.type = 'button';
          cbtn.className = 'btn ghost copy-card';
          cbtn.textContent = 'Copier la note';
          cbtn.addEventListener('click', async () => {
            const text = (card.querySelector('.card-body')?.innerText || '').trim();
            try {
              await navigator.clipboard.writeText(text);
              cbtn.textContent = 'Copié ✓';
              setTimeout(() => cbtn.textContent = 'Copier la note', 1200);
            } catch {
              cbtn.textContent = 'Erreur';
              setTimeout(() => cbtn.textContent = 'Copier la note', 1200);
            }
          });
          f.prepend(cbtn);
        }
      }
    });
  }

  /* ---------- Keyboard accessibility: Enter on see-more ---------- */
  function initKeyboard() {
    on(document, 'keydown', (e) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        // focus search (Ctrl/Cmd+F mapped to internal search)
        const s = $('.search input');
        if (s) { e.preventDefault(); s.focus(); s.select(); }
      }
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initAccordions();
    initCopyButtons();
    initSearch();
    initTOC();
    enhanceCards();
    initKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})();
