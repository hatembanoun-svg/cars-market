/* Cars Market DZ — تأثيرات: بطاقات 3D، ترجمة العناصر الثابتة، وحركة السكرول */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var isFr = function () { return !String(document.documentElement.lang || '').toLowerCase().startsWith('ar'); };

  // ───────── ترجمة العناصر التي تحمل data-ar / data-fr ─────────
  function applyI18n() {
    var fr = isFr();
    document.querySelectorAll('[data-ar][data-fr]').forEach(function (el) {
      var txt = fr ? el.getAttribute('data-fr') : el.getAttribute('data-ar');
      if (el.tagName === 'OPTGROUP') el.label = txt; // لا نستبدل محتواه (الخيارات بداخله)
      else el.textContent = txt;
    });
    document.querySelectorAll('[data-ar-ph][data-fr-ph]').forEach(function (el) {
      el.placeholder = fr ? el.getAttribute('data-fr-ph') : el.getAttribute('data-ar-ph');
    });
  }
  window.DarnaI18n = { apply: applyI18n };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyI18n); else applyI18n();

  // ───────── بطاقات 3D: ميل مع المؤشر (للشاشات التي فيها فأرة فقط) ─────────
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !reduce) {
    var cur = null;
    var reset = function (c) {
      c.classList.remove('tilting');
      c.style.removeProperty('--rx');
      c.style.removeProperty('--ry');
    };
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (cur && cur !== c) reset(cur);
      cur = c || null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      c.classList.add('tilting');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { if (cur) { reset(cur); cur = null; } });
  }

  // ───────── الزر العائم: يختفي كلما فُتحت نافذة (نشر/تفاصيل/فلاتر) ─────────
  function syncModalState() {
    var open = !!document.querySelector('.overlay.open, #filterDrawer.open');
    document.body.classList.toggle('modal-open', open);
  }
  document.querySelectorAll('.overlay, #filterDrawer').forEach(function (el) {
    new MutationObserver(syncModalState).observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  syncModalState();

  // ───────── حركة السكرول ─────────
  if (!reduce) {
    var root = document.documentElement;
    root.classList.add('js-reveal');

    document.querySelectorAll('.home-section-head, .owner-section, .home-viewall-wrap').forEach(function (el) { el.classList.add('reveal'); });

    // دخول متتابع للبطاقات والأقسام
    var revealIdx = 0;
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = ((revealIdx++ % 4) * 90) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 1000);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;

    function watch() {
      document.querySelectorAll('.reveal:not(.in), #homeGrid .card:not(.in)').forEach(function (el) {
        if (io) io.observe(el); else el.classList.add('in');
      });
    }
    watch();
    var grid = $('homeGrid');
    if (grid) new MutationObserver(watch).observe(grid, { childList: true });

    // الخريطة تتراجع، شريط التقدم، ميلان البطاقات حسب موضعها
    var stage = $('mapStage'), prog = $('scrollProgress'), cue = $('scrollCue'), ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      var docH = document.documentElement.scrollHeight;
      if (prog) prog.style.transform = 'scaleX(' + Math.min(1, y / Math.max(1, docH - vh)).toFixed(4) + ')';
      if (cue) cue.style.opacity = y > 40 ? '0' : '1';
      if (stage) {
        var r = stage.getBoundingClientRect();
        var p = r.height ? Math.max(0, Math.min(1, -r.top / (r.height * 0.85))) : 0;
        stage.style.setProperty('--p', p.toFixed(3));
      }
      if (grid) {
        grid.querySelectorAll('.card').forEach(function (c) {
          var b = c.getBoundingClientRect();
          if (b.bottom < 0 || b.top > vh) return;
          var d = ((b.top + b.height / 2) - vh / 2) / (vh / 2);
          c.style.setProperty('--sx', (Math.max(-1, Math.min(1, d)) * 7).toFixed(2) + 'deg');
        });
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }
})();
