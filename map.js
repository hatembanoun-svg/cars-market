/* Cars Market DZ — خريطة السيارات (Leaflet + OpenStreetMap)
   يضع دبوساً لكل سيارة حسب الولاية، مع إزاحة ثابتة صغيرة حتى لا تتراكب الدبابيس. */
(function () {
  'use strict';

  var W = window.DZ_WILAYAS || [];
  var byCode = {};
  W.forEach(function (w) { byCode[w.code] = w; });

  function isFr() { return !String(document.documentElement.lang || '').toLowerCase().startsWith('ar'); }
  function t(ar, fr) { return isFr() ? fr : ar; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function lab(table, key) { var o = table && table[key]; return o ? (isFr() ? o.fr : o.ar) : (key || ''); }
  function wName(ad) { var w = byCode[ad.wilaya]; return w ? (isFr() ? w.fr : w.ar) : ''; }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // موضع السيارة: إحداثيات صريحة إن وُجدت، وإلا مركز ولايتها مع إزاحة ثابتة (~6 كم)
  function geoFor(ad) {
    var lat = parseFloat(ad.lat), lng = parseFloat(ad.lng);
    if (isFinite(lat) && isFinite(lng)) return { lat: lat, lng: lng, approx: false };
    var w = byCode[ad.wilaya];
    if (!w) return null;
    var h = hash(String(ad.id));
    var dx = ((h & 0xffff) / 0xffff - 0.5) * 0.12;
    var dy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.09;
    return { lat: w.lat + dy, lng: w.lng + dx, approx: true };
  }

  function createdMs(ad) {
    var c = ad.createdAt;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    return Number(c) || 0;
  }
  function priceOf(ad) { var n = Number(ad.price); return isFinite(n) ? n : 0; }
  function trim1(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ''); }
  // الجزائريون يقولون "مليون" بالسنتيم: 1 دج = 100 سنتيم
  function shortPrice(ad) {
    var p = priceOf(ad);
    if (!p) return '';
    var c = p * 100;
    return c >= 1e9 ? trim1(c / 1e9) + (isFr() ? ' Md' : ' مليار') : trim1(c / 1e6) + (isFr() ? ' M' : ' مليون');
  }
  function longPrice(ad) {
    var p = priceOf(ad);
    if (!p) return t('السعر عند الاتصال', 'Prix sur demande');
    var c = p * 100;
    var cent = c >= 1e9 ? trim1(c / 1e9) + (isFr() ? ' Md de centimes' : ' مليار سنتيم') : trim1(c / 1e6) + (isFr() ? ' M de centimes' : ' مليون سنتيم');
    return p.toLocaleString('fr-DZ') + ' DA · ' + cent;
  }
  function ago(ms) {
    if (!ms) return '';
    var m = Math.max(1, Math.round((Date.now() - ms) / 60000));
    if (m < 60) return isFr() ? 'il y a ' + m + ' min' : 'منذ ' + m + ' د';
    var h = Math.round(m / 60);
    if (h < 24) return isFr() ? 'il y a ' + h + ' h' : 'منذ ' + h + ' س';
    var d = Math.round(h / 24);
    return isFr() ? 'il y a ' + d + ' j' : 'منذ ' + d + ' يوم';
  }
  function isFeat(ad) { return typeof window.CM_isFeatured === 'function' ? window.CM_isFeatured(ad) : !!ad.feat; }
  function isNew(ad) { return Date.now() - createdMs(ad) < 72 * 3600 * 1000; }
  function imgOk(v) { return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+\/=\s]+$/i.test(String(v || '')); }

  var map = null, layer = null, meDot = null;
  var markers = {}, byId = {};
  var state = { list: [], loaded: false, error: false, lastKey: '' };
  var tickerTimer = null, tickerIdx = 0;
  var ALGERIA = [28.6, 2.6];

  function makeLayer() {
    if (typeof L.markerClusterGroup === 'function') {
      return L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 46, chunkedLoading: true,
        iconCreateFunction: function (c) {
          return L.divIcon({ html: '<span>' + c.getChildCount() + '</span>', className: 'dm-cluster', iconSize: [42, 42] });
        }
      });
    }
    return L.layerGroup();
  }

  function carTitle(ad) {
    return ad.title || [ad.brand, ad.model, ad.year].filter(Boolean).join(' ') || t('سيارة', 'Voiture');
  }

  function popupHTML(ad) {
    var first = ad.imgBase64 || (ad.imgs && ad.imgs[0]);
    var img = imgOk(first) ? '<img class="dm-pop-img" src="' + esc(first) + '" alt="" loading="lazy">' : '<div class="dm-pop-img dm-pop-ph">🚗</div>';
    var specs = [];
    if (ad.year) specs.push('📅 ' + esc(ad.year));
    if (ad.km != null && ad.km !== '') specs.push('🛣️ ' + Number(ad.km).toLocaleString('fr-DZ') + ' km');
    if (ad.fuel) specs.push('⛽ ' + esc(lab(window.CM_FUEL, ad.fuel)));
    if (ad.gearbox) specs.push('⚙️ ' + esc(lab(window.CM_GEAR, ad.gearbox)));
    return '<div class="dm-pop" data-id="' + esc(ad.id) + '">' + img +
      '<div class="dm-pop-body">' +
      (isFeat(ad) ? '<div class="dm-pop-note">⭐ ' + t('إعلان مميز', 'Annonce sponsorisée') + '</div>' : '') +
      '<div class="dm-pop-title">' + esc(carTitle(ad)) + '</div>' +
      '<div class="dm-pop-price">' + esc(longPrice(ad)) + '</div>' +
      '<div class="dm-pop-meta">📍 ' + esc(wName(ad) || t('الجزائر', 'Algérie')) + (specs.length ? ' · ' + specs.join(' · ') : '') + '</div>' +
      '<div class="dm-pop-actions">' +
      '<button type="button" class="dm-btn dm-wa" data-act="wa">WhatsApp</button>' +
      '<button type="button" class="dm-btn dm-call" data-act="call">📞 ' + t('اتصل', 'Appeler') + '</button>' +
      '</div>' +
      '<button type="button" class="dm-more" data-act="more">' + t('عرض التفاصيل ←', 'Voir les détails →') + '</button>' +
      '</div></div>';
  }

  function pinIcon(ad) {
    var cls = 'dm-pin-label sale' + (isFeat(ad) ? ' feat' : '') + (isNew(ad) ? ' fresh' : '') + (ad.__approx ? ' approx' : '');
    return L.divIcon({
      html: '<span class="' + cls + '">' + esc(shortPrice(ad) || '🚗') + '</span>',
      className: 'dm-pin', iconSize: [0, 0], iconAnchor: [0, 0]
    });
  }

  function setState(s) {
    state.loaded = (s === 'ready');
    state.error = (s === 'error');
    var ov = $('mapOverlay');
    if (!ov) return;
    if (s === 'loading') {
      ov.className = 'dm-overlay show';
      ov.innerHTML = '<div class="dm-spin"></div><div>' + t('جارٍ تحميل السيارات…', 'Chargement des voitures…') + '</div>';
    } else if (s === 'error') {
      ov.className = 'dm-overlay show';
      ov.innerHTML = '<div>⚠️ ' + t('تعذّر تحميل الإعلانات', 'Impossible de charger les annonces') + '</div><button type="button" class="dm-btn dm-call" data-action="retry">' + t('إعادة المحاولة', 'Réessayer') + '</button>';
    } else {
      ov.className = 'dm-overlay';
      ov.innerHTML = '';
    }
  }

  function updateChip(mapped, fresh) {
    var chip = $('mapLive');
    if (!chip) return;
    if (!mapped) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.innerHTML = '<i></i><b>' + mapped + '</b> ' + t('سيارة على الخريطة', 'voitures sur la carte') +
      (fresh ? ' <em>· ' + fresh + ' ' + t('جديدة', fresh > 1 ? 'nouvelles' : 'nouvelle') + '</em>' : '');
  }

  function fitAll(pts) {
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 10 });
    else if (pts.length === 1) map.setView(pts[0], 10);
    else map.setView(ALGERIA, 5);
  }

  function render(list) {
    state.list = list || [];
    if (!map) return;
    if (layer) map.removeLayer(layer);
    layer = makeLayer();
    markers = {}; byId = {};
    var pts = [], fresh = 0;

    state.list.forEach(function (ad) {
      var g = geoFor(ad);
      if (!g) return;
      ad.__approx = !!g.approx;
      byId[ad.id] = ad;
      var m = L.marker([g.lat, g.lng], { icon: pinIcon(ad), riseOnHover: true, zIndexOffset: isFeat(ad) ? 1000 : 0 })
        .bindPopup(popupHTML(ad), { maxWidth: 280, minWidth: 240, autoPanPadding: [16, 70] });
      layer.addLayer(m);
      markers[ad.id] = m;
      pts.push([g.lat, g.lng]);
      if (isNew(ad)) fresh++;
    });
    map.addLayer(layer);
    updateChip(pts.length, fresh);

    var empty = $('mapEmpty');
    if (empty) empty.hidden = pts.length > 0 || !state.loaded;

    var key = Object.keys(markers).sort().join(',');
    if (key !== state.lastKey) { state.lastKey = key; fitAll(pts); }
    renderTicker();
  }

  function renderTicker() {
    var el = $('mapTicker');
    if (!el) return;
    var items = state.list.slice().sort(function (a, b) { return createdMs(b) - createdMs(a); }).slice(0, 6);
    clearInterval(tickerTimer);
    if (!items.length) { el.hidden = true; return; }
    el.hidden = false;
    var box = el.querySelector('.tk-track');
    box.innerHTML = items.map(function (ad, i) {
      return '<button type="button" class="tk-item' + (i === 0 ? ' on' : '') + '" data-id="' + esc(ad.id) + '">' +
        (Date.now() - createdMs(ad) < 7 * 86400000 ? '<span class="tk-new">' + t('جديد', 'Nouveau') + '</span> ' : '') +
        '<b>' + esc(carTitle(ad)) + '</b> · ' + esc(wName(ad) || t('الجزائر', 'Algérie')) +
        (shortPrice(ad) ? ' · <strong>' + esc(shortPrice(ad)) + '</strong>' : '') +
        (createdMs(ad) ? ' <small>' + ago(createdMs(ad)) + '</small>' : '') + '</button>';
    }).join('');
    tickerIdx = 0;
    if (items.length > 1) {
      tickerTimer = setInterval(function () {
        if (el.matches(':hover')) return;
        var nodes = box.querySelectorAll('.tk-item');
        nodes[tickerIdx].classList.remove('on');
        tickerIdx = (tickerIdx + 1) % nodes.length;
        nodes[tickerIdx].classList.add('on');
      }, 3600);
    }
  }

  function focusAd(id) {
    var m = markers[id];
    var stage = $('mapStage');
    if (!m || !map) return;
    if (stage) {
      var top = stage.getBoundingClientRect().top + window.scrollY - 54;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    var open = function () { m.openPopup(); };
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 11), { animate: true });
    if (layer && typeof layer.zoomToShowLayer === 'function') layer.zoomToShowLayer(m, open); else open();
  }

  function nearMe() {
    var btn = $('mapNear');
    if (!navigator.geolocation) return;
    if (btn) btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (btn) btn.classList.remove('busy');
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (meDot) map.removeLayer(meDot);
      meDot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#0284C7', fillOpacity: 1 }).addTo(map);
      var nearest = null, nd = Infinity;
      Object.keys(markers).forEach(function (id) {
        var d = map.distance(ll, markers[id].getLatLng());
        if (d < nd) { nd = d; nearest = id; }
      });
      if (nearest) {
        map.fitBounds(L.latLngBounds([ll, markers[nearest].getLatLng()]).pad(0.5), { maxZoom: 12 });
        setTimeout(function () { markers[nearest] && markers[nearest].openPopup(); }, 450);
      } else {
        map.setView(ll, 10);
      }
    }, function () { if (btn) btn.classList.remove('busy'); }, { enableHighAccuracy: true, timeout: 9000 });
  }

  function bind() {
    var root = $('homeMap');
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var pop = b.closest('.dm-pop');
      var ad = pop && byId[pop.dataset.id];
      if (!ad) return;
      if (b.dataset.act === 'wa' && window.openWA) window.openWA(ad.phone || '', carTitle(ad), ad.id);
      else if (b.dataset.act === 'call' && window.dial) window.dial(ad.phone || '');
      else if (b.dataset.act === 'more' && window.openD) window.openD(ad.id);
    });
    var tk = $('mapTicker');
    if (tk) tk.addEventListener('click', function (e) {
      var b = e.target.closest('.tk-item');
      if (b) focusAd(b.dataset.id);
    });
    var near = $('mapNear');
    if (near) near.addEventListener('click', nearMe);
    var reset = $('mapReset');
    if (reset) reset.addEventListener('click', function () {
      fitAll(Object.keys(markers).map(function (id) { return markers[id].getLatLng(); }));
    });
    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur', function () { map.scrollWheelZoom.disable(); });
    document.addEventListener('mouseover', function (e) {
      var c = e.target.closest && e.target.closest('.card[data-id]');
      var m = c && markers[c.dataset.id];
      if (m && m._icon) m._icon.classList.add('dm-pin-active');
    });
    document.addEventListener('mouseout', function (e) {
      var c = e.target.closest && e.target.closest('.card[data-id]');
      var m = c && markers[c.dataset.id];
      if (m && m._icon) m._icon.classList.remove('dm-pin-active');
    });
  }

  function init() {
    var el = $('homeMap');
    if (!el) return;
    if (!window.L) {
      el.innerHTML = '<div class="dm-fallback">' + t('تعذّر تحميل الخريطة. الإعلانات متوفرة في الأسفل.', 'La carte est indisponible. Les annonces sont plus bas.') + '</div>';
      return;
    }
    map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 5, maxZoom: 18, scrollWheelZoom: false, worldCopyJump: false }).setView(ALGERIA, 5);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.control.attribution({ position: 'topleft', prefix: false }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    bind();
    setState(state.loaded ? 'ready' : 'loading');
    if (state.loaded) render(state.list);
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  // الاسم القديم "DarnaMap" يبقى كما هو ليتوافق مع app.js
  window.DarnaMap = {
    render: function (list) { state.loaded = true; state.list = list || []; setState('ready'); render(list); },
    setState: setState,
    focus: focusAd,
    relabel: function () { if (map && state.loaded) render(state.list); },
    // تُستدعى عند إظهار الخريطة بعد إخفائها (تبويب قطع الغيار) كي يعيد Leaflet حساب الحجم
    invalidate: function () { if (map) map.invalidateSize(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
