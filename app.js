import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, onSnapshot, query, orderBy, limit, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════
// إعدادات الموقع — عدّل هذه القيم فقط
// ══════════════════════════════════════════════════════
const SITE_NAME = 'Cars Market DZ';
// رقم واتساب صاحب الموقع بالصيغة الدولية بدون + (مثال: 2135XXXXXXXX). يُستعمل لطلبات الإعلان المميز.
const OWNER_WHATSAPP = '213562517768';
const FEAT_DAYS = 7;       // مدة الإعلان المميز
const FEAT_PRICE = 500;    // سعره بالدينار

const firebaseConfig = {
  apiKey: "AIzaSyCSuh7v3c4Iz7UO5PzMxM1pTybUhVdsqx0",
  authDomain: "cars-market-da3d7.firebaseapp.com",
  projectId: "cars-market-da3d7",
  storageBucket: "cars-market-da3d7.firebasestorage.app",
  messagingSenderId: "863229375569",
  appId: "1:863229375569:web:29073b3a194ad5a917f470"
};

const app = initializeApp(firebaseConfig);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = getFirestore(app);
}
const adsCol = collection(db, "clients"); // اسم المجموعة كما في القواعد المنشورة

// ══════════════════════════════════════════════════════
// اللغة والنصوص
// ══════════════════════════════════════════════════════
let currentLang = 'ar';
try { const s = localStorage.getItem('cm_lang'); if (s === 'fr' || s === 'ar') currentLang = s; } catch (e) {}
const $ = id => document.getElementById(id);
const fr = () => currentLang === 'fr';
const t = (ar, f) => (currentLang === 'fr' ? f : ar);

const WILAYAS = window.DZ_WILAYAS || [];
const BRANDS = window.CM_BRANDS || [];
const FUEL = window.CM_FUEL || {};
const GEAR = window.CM_GEAR || {};
const SELLER = window.CM_SELLER || {};
const lab = (table, key) => { const o = table[key]; return o ? (fr() ? o.fr : o.ar) : (key || ''); };
const wilayaByCode = code => WILAYAS.find(w => w.code === Number(code));
const wName = code => { const w = wilayaByCode(code); return w ? (fr() ? w.fr : w.ar) : ''; };
const wLabel = w => `${String(w.code).padStart(2, '0')} - ${fr() ? w.fr : w.ar}`;

const escHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeImgSrc = v => {
  const s = String(v == null ? '' : v);
  return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+\/=\s]+$/i.test(s) ? s : '';
};
const adImages = ad => {
  const arr = Array.isArray(ad.imgs) ? ad.imgs.slice() : [];
  if (!arr.length && ad.imgBase64) arr.push(ad.imgBase64);
  return arr.map(safeImgSrc).filter(Boolean);
};

// ══════════════════════════════════════════════════════
// الإعلان المميز (يُفعَّل يدوياً من لوحة Firebase: feat=true و featUntil="YYYY-MM-DD")
// ══════════════════════════════════════════════════════
function featEnd(ad) {
  const v = ad.featUntil;
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime() : 0;
}
const isFeatured = ad => ad.feat === true && featEnd(ad) > Date.now();
window.CM_isFeatured = isFeatured;

// ══════════════════════════════════════════════════════
// تنسيق الأسعار والأرقام
// ══════════════════════════════════════════════════════
const trim1 = n => String(Math.round(n * 10) / 10).replace(/\.0$/, '');
const fmt = n => Number(n || 0).toLocaleString('fr-DZ');
function centimes(price) {
  const c = Number(price || 0) * 100;
  if (!c) return '';
  return c >= 1e9 ? trim1(c / 1e9) + t(' مليار سنتيم', ' Md de centimes') : trim1(c / 1e6) + t(' مليون سنتيم', ' M de centimes');
}
const carTitle = ad => ad.title || [ad.brand, ad.model, ad.year].filter(Boolean).join(' ') || t('سيارة', 'Voiture');

// ══════════════════════════════════════════════════════
// البحث: عربي/لاتيني، مع مرادفات الماركات الشائعة
// ══════════════════════════════════════════════════════
const BRAND_ALIASES = {
  'رونو': 'renault', 'رينو': 'renault', 'بيجو': 'peugeot', 'داسيا': 'dacia', 'سيتروين': 'citroen', 'فيات': 'fiat',
  'فولكسفاغن': 'volkswagen', 'فولكس': 'volkswagen', 'غولف': 'golf', 'هيونداي': 'hyundai', 'هيوندي': 'hyundai', 'كيا': 'kia',
  'تويوتا': 'toyota', 'سوزوكي': 'suzuki', 'شيفروليه': 'chevrolet', 'شيفرولي': 'chevrolet', 'سيات': 'seat', 'سكودا': 'skoda',
  'مرسيدس': 'mercedes', 'بيام': 'bmw', 'اودي': 'audi', 'نيسان': 'nissan', 'فورد': 'ford', 'اوبل': 'opel', 'شيري': 'chery',
  'جيلي': 'geely', 'ميتسوبيشي': 'mitsubishi', 'مازدا': 'mazda', 'هوندا': 'honda', 'جيب': 'jeep', 'فولفو': 'volvo',
  'ميني': 'mini', 'لادا': 'lada', 'كليو': 'clio', 'سيمبول': 'symbol', 'ستيبواي': 'stepway', 'سانديرو': 'sandero'
};
function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function haystack(ad) {
  const w = wilayaByCode(ad.wilaya);
  return norm([ad.brand, ad.model, ad.title, ad.year, ad.desc, w && w.ar, w && w.fr, lab(FUEL, ad.fuel), FUEL[ad.fuel] && FUEL[ad.fuel].fr,
    FUEL[ad.fuel] && FUEL[ad.fuel].ar, GEAR[ad.gearbox] && GEAR[ad.gearbox].ar, GEAR[ad.gearbox] && GEAR[ad.gearbox].fr].join(' '));
}
function adMatchesSearch(ad, raw) {
  const tokens = norm(raw).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const hay = ad.__hay || (ad.__hay = haystack(ad));
  return tokens.every(tok => hay.includes(BRAND_ALIASES[tok] || tok));
}

// ══════════════════════════════════════════════════════
// الحالة والفلاتر (حالة واحدة مركزية لكل عناصر data-f)
// ══════════════════════════════════════════════════════
const PAGE_MODE = document.body.dataset.mode === 'listings' ? 'listings' : 'home';
let DATA = [];
let displayList = [];
let dataLoaded = false;
let dataLoadError = false;
const F = { q: '', brand: '', wilaya: '', fuel: 'all', gear: 'all', seller: 'all', ymin: 0, pmin: 0, pmax: Infinity, kmax: Infinity };

function applyFilters() {
  displayList = DATA.filter(ad => {
    if (F.brand && ad.brand !== F.brand) return false;
    if (F.wilaya && Number(ad.wilaya) !== Number(F.wilaya)) return false;
    if (F.fuel !== 'all' && ad.fuel !== F.fuel) return false;
    if (F.gear !== 'all' && ad.gearbox !== F.gear) return false;
    if (F.seller !== 'all' && ad.seller !== F.seller) return false;
    if (F.ymin && Number(ad.year) < F.ymin) return false;
    const price = Number(ad.price) || 0;
    if (price < F.pmin || price > F.pmax) return false;
    if (F.kmax !== Infinity && Number(ad.km) > F.kmax) return false;
    if (F.q && !adMatchesSearch(ad, F.q)) return false;
    return true;
  });
  sortAndRender();
}

function sortAndRender() {
  const s = $('srt') ? $('srt').value : 'new';
  const by = {
    new: (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
    pa: (a, b) => (a.price || 0) - (b.price || 0),
    pd: (a, b) => (b.price || 0) - (a.price || 0),
    ya: (a, b) => (b.year || 0) - (a.year || 0),
    km: (a, b) => (a.km || 0) - (b.km || 0)
  }[s] || ((a, b) => 0);
  displayList.sort((a, b) => (isFeatured(b) - isFeatured(a)) || by(a, b)); // المميز دائماً في الأعلى
  if (PAGE_MODE === 'home') {
    renderHomePreview();
    if (window.DarnaMap && dataLoaded) window.DarnaMap.render(displayList);
  } else {
    renderAds(displayList);
  }
}
window.sl = () => sortAndRender();

// ══════════════════════════════════════════════════════
// بطاقة السيارة
// ══════════════════════════════════════════════════════
function buildCardHTML(ad) {
  const safeId = escHtml(ad.id);
  const imgs = adImages(ad);
  const feat = isFeatured(ad);
  const imgHtml = imgs.length
    ? `<img src="${imgs[0]}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>${imgs.length > 1 ? `<span class="c-count">📷 ${imgs.length}</span>` : ''}`
    : `<div class="cimg-ph" style="background:linear-gradient(135deg,#E0F2FE,#BAE6FD)">🚗</div>`;
  const sellerColor = ad.seller === 'dealer' ? '#0284C7' : '#64748B';
  return `
  <div class="card${feat ? ' card-feat' : ''}" data-id="${safeId}">
    <div class="cimg">
      ${imgHtml}
      ${ad.seller ? `<span class="bt" style="background:${sellerColor}">${escHtml(lab(SELLER, ad.seller))}</span>` : ''}
      ${$('homeMap') ? `<button type="button" class="c-onmap" data-act="map" aria-label="${t('عرض على الخريطة', 'Voir sur la carte')}">📍</button>` : ''}
      ${feat ? `<span class="bo feat-badge">⭐ ${t('مميز', 'Sponsorisé')}</span>` : ''}
    </div>
    <div class="cbody">
      <div class="ctitle">${escHtml(carTitle(ad))}</div>
      <div class="cloc">📍 ${escHtml(wName(ad.wilaya) || t('الجزائر', 'Algérie'))}</div>
      <div class="cspecs">
        ${ad.year ? `<span>📅 ${escHtml(ad.year)}</span>` : ''}
        ${ad.km != null && ad.km !== '' ? `<span>🛣️ ${fmt(ad.km)} km</span>` : ''}
        ${ad.fuel ? `<span>⛽ ${escHtml(lab(FUEL, ad.fuel))}</span>` : ''}
        ${ad.gearbox ? `<span>⚙️ ${escHtml(lab(GEAR, ad.gearbox))}</span>` : ''}
      </div>
      <div class="cfoot">
        <div class="price">${ad.price ? fmt(ad.price) : '—'} <small>DA</small>${ad.price ? `<div class="price-cent">${escHtml(centimes(ad.price))}</div>` : ''}</div>
      </div>
      <div class="cacts">
        <button type="button" class="btn-wa" data-act="wa">💬 ${t('واتساب', 'WhatsApp')}</button>
        <button type="button" class="btn-call" data-act="call">📞 ${t('اتصال', 'Appeler')}</button>
      </div>
    </div>
  </div>`;
}

document.addEventListener('click', e => {
  const card = e.target.closest('.card[data-id]');
  if (!card) return;
  const id = card.dataset.id;
  const actEl = e.target.closest('[data-act]');
  if (!actEl) { window.openD(id); return; }
  const ad = findAd(id);
  if (!ad) return;
  if (actEl.dataset.act === 'map') { if (window.DarnaMap) window.DarnaMap.focus(id); }
  else if (actEl.dataset.act === 'wa') openWA(ad.phone, carTitle(ad), ad.id);
  else if (actEl.dataset.act === 'call') dial(ad.phone);
});

function findAd(id) { return DATA.find(x => String(x.id) === String(id)); }

function renderAds(list) {
  const grid = $('grid');
  if (!grid) return;
  if ($('rn')) $('rn').textContent = list.length;
  if ($('liveAdCount')) $('liveAdCount').textContent = DATA.length;
  if (!dataLoaded) { grid.innerHTML = skeletonCardsHTML(6); return; }
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🔍</div><h3>${t('لا توجد سيارات مطابقة', 'Aucune voiture trouvée')}</h3><p>${t('جرّب تغيير الفلاتر أو البحث', 'Essayez de modifier les filtres ou la recherche')}</p></div>`;
    return;
  }
  grid.innerHTML = list.map(buildCardHTML).join('');
}

// ══════════════════════════════════════════════════════
// الصفحة الرئيسية: معاينة آخر السيارات
// ══════════════════════════════════════════════════════
const HOME_PREVIEW_COUNT = 6;
function skeletonCardsHTML(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<div class="skeleton-card"><div class="sk-img"></div><div class="sk-line w60"></div><div class="sk-line w40"></div></div>`;
  return out;
}
const filtersActive = () => !!(F.q.trim() || F.brand || F.wilaya || F.fuel !== 'all' || F.gear !== 'all' || F.seller !== 'all' || F.ymin || F.pmin || F.pmax !== Infinity || F.kmax !== Infinity);

function buildListingsUrl() {
  const p = new URLSearchParams();
  if (F.q.trim()) p.set('q', F.q.trim());
  if (F.brand) p.set('brand', F.brand);
  if (F.wilaya) p.set('wilaya', F.wilaya);
  if (F.fuel !== 'all') p.set('fuel', F.fuel);
  if (F.gear !== 'all') p.set('gear', F.gear);
  return 'listings.html' + (p.toString() ? '?' + p.toString() : '');
}

function renderHomeLoading() {
  const grid = $('homeGrid');
  if (!grid) return;
  grid.innerHTML = skeletonCardsHTML(HOME_PREVIEW_COUNT);
  if (window.DarnaMap) window.DarnaMap.setState('loading');
  const title = $('homeSectionTitle');
  if (title) title.textContent = t('جارٍ تحميل السيارات...', 'Chargement des annonces…');
}
window.retryLoadAds = function () { dataLoadError = false; renderHomeLoading(); startFirebaseListener(); };

function renderHomeError() {
  const grid = $('homeGrid');
  if (window.DarnaMap) window.DarnaMap.setState('error');
  if (!grid) return;
  grid.innerHTML = `<div class="home-status-box"><div class="icon">⚠️</div><div>${t('تعذّر تحميل الإعلانات.', 'Impossible de charger les annonces.')}</div><button class="btn-retry" onclick="retryLoadAds()">${t('إعادة المحاولة', 'Réessayer')}</button></div>`;
}

function renderHomePreview() {
  const grid = $('homeGrid');
  if (!grid) return;
  if (dataLoadError) { renderHomeError(); return; }
  if (!dataLoaded) { renderHomeLoading(); return; }
  const total = displayList.length;
  const active = filtersActive();
  const title = $('homeSectionTitle');
  if (title) {
    title.innerHTML = active
      ? `${t('نتائج البحث', 'Résultats')} <span class="cnt">— ${total}</span>`
      : `${t('أحدث السيارات', 'Dernières voitures')} <span class="cnt">— ${total} ${t(total > 1 ? 'إعلانات' : 'إعلان', total > 1 ? 'annonces' : 'annonce')}</span>`;
  }
  const btn = $('homeViewAllBtn');
  if (btn) {
    btn.href = buildListingsUrl();
    btn.textContent = active ? t('عرض جميع النتائج ←', 'Voir tous les résultats →') : t('عرض جميع السيارات ←', 'Voir toutes les voitures →');
  }
  const items = displayList.slice(0, HOME_PREVIEW_COUNT);
  if (!items.length) {
    grid.innerHTML = `<div class="home-status-box"><div class="icon">🔍</div><div>${t('لا توجد سيارات مطابقة', 'Aucune voiture trouvée')}</div><div style="font-size:12px;margin-top:4px">${t('جرّب فلتراً آخر', 'Essayez un autre filtre')}</div></div>`;
    return;
  }
  grid.innerHTML = items.map(buildCardHTML).join('');
  requestAnimationFrame(updateHomeArrows);
}
window.homeScroll = function (dir) {
  const grid = $('homeGrid');
  if (!grid) return;
  const card = grid.querySelector('.card');
  grid.scrollBy({ left: dir * (card ? card.getBoundingClientRect().width + 16 : 300), behavior: 'smooth' });
};
function updateHomeArrows() {
  const grid = $('homeGrid'), p = $('homeArrowPrev'), n = $('homeArrowNext');
  if (!grid || !p || !n) return;
  const over = grid.scrollWidth > grid.clientWidth + 4;
  p.style.visibility = n.style.visibility = over ? 'visible' : 'hidden';
}

// ══════════════════════════════════════════════════════
// نافذة التفاصيل
// ══════════════════════════════════════════════════════
let currentAdId = null;
window.openD = function (id) {
  const ad = findAd(id);
  if (!ad) return;
  currentAdId = ad.id;
  const imgs = adImages(ad);
  const mimg = $('mimg');
  const showImg = i => {
    mimg.style.background = '';
    mimg.innerHTML = `<img src="${imgs[i]}" alt="${escHtml(carTitle(ad))}" style="width:100%;height:100%;object-fit:cover"/>`;
    document.querySelectorAll('#mthumbs img').forEach((el, k) => el.classList.toggle('on', k === i));
  };
  if (imgs.length) showImg(0);
  else { mimg.style.background = 'linear-gradient(135deg,#E0F2FE,#BAE6FD)'; mimg.innerHTML = '<div class="mimg-ph" style="background:transparent">🚗</div>'; }
  const th = $('mthumbs');
  if (th) {
    th.innerHTML = imgs.length > 1 ? imgs.map((s, i) => `<img src="${s}" alt="" data-i="${i}"${i === 0 ? ' class="on"' : ''}/>`).join('') : '';
    th.onclick = e => { const im = e.target.closest('img[data-i]'); if (im) showImg(Number(im.dataset.i)); };
  }

  $('mtt').textContent = carTitle(ad);
  $('mbg').innerHTML = `
    ${isFeatured(ad) ? `<span style="background:linear-gradient(135deg,#F0C855,#C9A84C);color:#033a5a;padding:5px 13px;border-radius:50px;font-weight:800">⭐ ${t('مميز', 'Sponsorisé')}</span>` : ''}
    ${ad.seller ? `<span style="background:${ad.seller === 'dealer' ? '#0284C7' : '#64748B'};color:#fff;padding:5px 13px;border-radius:50px">${escHtml(lab(SELLER, ad.seller))}</span>` : ''}`;
  $('mds').textContent = ad.desc || t('لا يوجد وصف إضافي.', 'Aucune description.');
  const spec = (icon, val, label) => `<div class="mspec"><strong>${icon} ${escHtml(val)}</strong>${label}</div>`;
  $('msp').innerHTML = [
    spec('💰', ad.price ? fmt(ad.price) + ' DA' : '—', `${t('السعر', 'Prix')}${ad.price ? ' · ' + escHtml(centimes(ad.price)) : ''}`),
    spec('🚗', [ad.brand, ad.model].filter(Boolean).join(' ') || '—', t('الماركة والموديل', 'Marque et modèle')),
    spec('📅', ad.year || '—', t('سنة الصنع', 'Année')),
    spec('🛣️', ad.km != null && ad.km !== '' ? fmt(ad.km) + ' km' : '—', t('الكيلومترات', 'Kilométrage')),
    spec('⛽', lab(FUEL, ad.fuel) || '—', t('الوقود', 'Carburant')),
    spec('⚙️', lab(GEAR, ad.gearbox) || '—', t('ناقل الحركة', 'Boîte de vitesses')),
    spec('📍', wName(ad.wilaya) || '—', t('الولاية', 'Wilaya')),
    spec('📅', ad.date || '—', t('تاريخ النشر', 'Publié le'))
  ].join('');
  if ($('mviewsNum')) $('mviewsNum').textContent = ad.views || 0;
  $('shareLinkLabel').textContent = t('نسخ رابط الإعلان', 'Copier le lien');
  $('mcall').textContent = '📞 ' + t('اتصل الآن', 'Appeler');
  $('socialBtns').innerHTML = `
    <button type="button" class="social-icon fb">📘 ${t('فيسبوك', 'Facebook')}</button>
    <button type="button" class="social-icon messenger">💬 ${t('ماسنجر', 'Messenger')}</button>
    <button type="button" class="social-icon whatsapp">💚 ${t('واتساب', 'WhatsApp')}</button>`;
  const sb = $('socialBtns');
  sb.querySelector('.fb').onclick = () => shareFB(ad.id);
  sb.querySelector('.messenger').onclick = () => shareMessenger(ad.id);
  sb.querySelector('.whatsapp').onclick = () => shareWA(ad.id);
  $('mcall').onclick = () => dial(ad.phone);
  $('mwa').onclick = () => openWA(ad.phone, carTitle(ad), ad.id);
  updateDoc(doc(db, 'clients', String(ad.id)), { views: (ad.views || 0) + 1 }).catch(() => {});
  $('dm').classList.add('open');
};

// ══════════════════════════════════════════════════════
// مشاركة واتصال
// ══════════════════════════════════════════════════════
window.adShareUrl = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html#ad-${encodeURIComponent(String(id))}`;
const adShareText = ad => `🚗 ${carTitle(ad)}\n📍 ${wName(ad.wilaya)}\n💰 ${fmt(ad.price)} DA`;
window.copyAdLink = function () {
  const link = adShareUrl(currentAdId);
  navigator.clipboard.writeText(link).then(() => toast(t('✅ تم نسخ الرابط', '✅ Lien copié'))).catch(() => toast(link));
};
window.shareWA = id => { const ad = findAd(id); if (ad) window.open('https://wa.me/?text=' + encodeURIComponent(adShareText(ad) + '\n' + adShareUrl(id)), '_blank', 'noopener'); };
window.shareFB = id => window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(adShareUrl(id)), '_blank', 'noopener');
window.shareMessenger = id => {
  const url = adShareUrl(id);
  const copy = () => navigator.clipboard.writeText(url).then(() => toast(t('✅ تم نسخ الرابط — الصقه في ماسنجر', '✅ Lien copié — collez-le dans Messenger'))).catch(() => {});
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.location.href = 'fb-messenger://share/?link=' + encodeURIComponent(url);
    setTimeout(() => { if (!document.hidden) copy(); }, 1600);
  } else { window.open('https://www.messenger.com/', '_blank', 'noopener'); copy(); }
};
function intlPhone(p) {
  let c = String(p == null ? '' : p).replace(/\D/g, '');
  if (c.startsWith('00')) c = c.slice(2);
  if (c.startsWith('0')) c = '213' + c.slice(1);
  return c;
}
window.openWA = function (phone, title, adId) {
  const clean = intlPhone(phone);
  if (!clean) { toast(t('⚠️ رقم الهاتف غير متوفر', '⚠️ Numéro indisponible'), 'red'); return; }
  const ad = adId != null ? findAd(adId) : null;
  let msg = `السلام عليكم، أنا مهتم بإعلانك "${title}" على ${SITE_NAME}.`;
  if (ad && Number(ad.price)) msg += `\nالسعر المعلن: ${fmt(ad.price)} دج`;
  if (adId != null) msg += `\n${adShareUrl(adId)}`;
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
};
window.dial = function (num) {
  const digits = String(num == null ? '' : num).replace(/\D/g, '');
  if (!digits) return;
  toast(t('📞 جارٍ الاتصال بـ ', '📞 Appel vers ') + digits);
  setTimeout(() => { window.location.href = `tel:${digits}`; }, 600);
};
window.cm = id => $(id).classList.remove('open');
window.cov = (e, id) => { if (e.target.id === id) window.cm(id); };
window.toast = function (msg, cls) {
  const el = $('tst');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (cls ? ' ' + cls : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
};
const toast = window.toast;

// ══════════════════════════════════════════════════════
// الإعلان المميز: طلب التفعيل عبر واتساب
// ══════════════════════════════════════════════════════
const ownerConfigured = () => /^\d{11,14}$/.test(OWNER_WHATSAPP) && !/^2130{8,}$/.test(OWNER_WHATSAPP);
window.requestFeatured = function (id) {
  const ad = id ? findAd(id) : null;
  const ref = id || '';
  const msg = `السلام عليكم، أريد تمييز إعلاني على ${SITE_NAME} لمدة ${FEAT_DAYS} أيام مقابل ${FEAT_PRICE} دج.` +
    (ref ? `\nرقم الإعلان: ${ref}` : '') + (ad ? `\n${carTitle(ad)}` : '') + '\nكيف أدفع؟';
  if (!ownerConfigured()) { toast(t('⚠️ لم يُضبط رقم واتساب صاحب الموقع بعد', '⚠️ Numéro WhatsApp du site non configuré'), 'red'); return; }
  window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
};
function showFeatPrompt(id) {
  const box = $('featPrompt');
  if (!box) return;
  const idEl = $('featAdId'); if (idEl) idEl.textContent = id;
  const go = $('featGo'); if (go) go.onclick = () => { window.requestFeatured(id); window.cm('featPrompt'); };
  box.classList.add('open');
}

// ══════════════════════════════════════════════════════
// نموذج النشر
// ══════════════════════════════════════════════════════
const MAX_IMGS = 4;
let postImgs = [];

function fillPostSelects() {
  const keep = id => ($(id) ? $(id).value : '');
  const set = (id, html, val) => { const el = $(id); if (!el) return; el.innerHTML = html; if (val) el.value = val; };
  const yearNow = new Date().getFullYear() + 1;
  let years = '';
  for (let y = yearNow; y >= 1980; y--) years += `<option value="${y}">${y}</option>`;
  set('pbrand', `<option value="">${t('اختر الماركة', 'Choisir la marque')}</option>` + BRANDS.map(b => `<option>${escHtml(b)}</option>`).join(''), keep('pbrand'));
  set('pyear', `<option value="">${t('السنة', 'Année')}</option>` + years, keep('pyear'));
  set('pfuel', Object.keys(FUEL).map(k => `<option value="${k}">${escHtml(lab(FUEL, k))}</option>`).join(''), keep('pfuel'));
  set('pgear', Object.keys(GEAR).map(k => `<option value="${k}">${escHtml(lab(GEAR, k))}</option>`).join(''), keep('pgear'));
  set('pseller', Object.keys(SELLER).map(k => `<option value="${k}">${escHtml(lab(SELLER, k))}</option>`).join(''), keep('pseller'));
  set('pwil', `<option value="">${t('اختر الولاية', 'Choisir la wilaya')}</option>` + WILAYAS.map(w => `<option value="${w.code}">${escHtml(wLabel(w))}</option>`).join(''), keep('pwil'));
}

window.openPost = function () { $('pm').classList.add('open'); };

window.sub = async function () {
  const brand = $('pbrand').value;
  const model = $('pmodel').value.trim();
  const year = parseInt($('pyear').value, 10);
  const km = parseInt($('pkm').value, 10);
  const wilaya = parseInt($('pwil').value, 10);
  const price = parseInt($('pp').value, 10);
  const phone = $('ph').value.trim();
  const cleanPhone = phone.replace(/\D/g, '');
  if (!brand || !year || !wilaya || !(price > 0) || !phone || isNaN(km)) { toast(t('⚠️ أكمل الماركة والسنة والكيلومترات والولاية والسعر والهاتف', '⚠️ Remplissez marque, année, km, wilaya, prix et téléphone'), 'red'); return; }
  if (km < 0 || km > 2000000) { toast(t('⚠️ عدد الكيلومترات غير صحيح', '⚠️ Kilométrage invalide'), 'red'); return; }
  if (price > 1000000000) { toast(t('⚠️ السعر غير صحيح', '⚠️ Prix invalide'), 'red'); return; }
  if (cleanPhone.length < 9 || cleanPhone.length > 13) { toast(t('⚠️ رقم الهاتف غير صحيح', '⚠️ Numéro de téléphone invalide'), 'red'); return; }
  const btn = document.querySelector('.btn-submit');
  btn.disabled = true;
  btn.textContent = t('⏳ جارٍ النشر...', '⏳ Publication…');
  try {
    const docData = {
      brand, model: model.slice(0, 40), year, km,
      fuel: $('pfuel').value, gearbox: $('pgear').value, seller: $('pseller').value,
      wilaya, price,
      title: [brand, model, year].filter(Boolean).join(' ').slice(0, 100),
      desc: $('pd').value.trim().slice(0, 1500),
      phone, date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(), views: 0
    };
    if (postImgs.length) { docData.imgs = postImgs.slice(); docData.imgBase64 = postImgs[0]; }
    const ref = await addDoc(adsCol, docData);
    window.cm('pm');
    ['pmodel', 'pkm', 'pp', 'ph', 'pd'].forEach(id => { $(id).value = ''; });
    $('pbrand').value = ''; $('pyear').value = ''; $('pwil').value = '';
    resetImgs();
    toast(t('✅ تم نشر إعلانك بنجاح!', '✅ Annonce publiée !'));
    showFeatPrompt(ref.id);
  } catch (e) {
    console.error(e);
    toast(t('❌ فشل النشر، حاول مجدداً', '❌ Échec de la publication'), 'red');
  }
  btn.disabled = false;
  btn.textContent = t('🚀 نشر الإعلان مجاناً', '🚀 Publier gratuitement');
};

// ── الصور: حتى 4 صور مضغوطة ──
function compressImage(dataUrl, width, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = () => {
      const c = document.createElement('canvas');
      const r = Math.min(1, width / img.width);
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}
async function processAndCompress(dataUrl) {
  // الهدف: ≤ 170 ألف حرف لكل صورة، لأن مستند Firestore لا يتجاوز 1 ميغابايت
  for (const [w, q] of [[1000, 0.72], [1000, 0.6], [900, 0.5], [800, 0.45], [640, 0.4]]) {
    const c = await compressImage(dataUrl, w, q);
    if (c && c.length < 170000) return c;
  }
  return null;
}
const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = () => res(null); r.readAsDataURL(f); });

window.handleImgUpload = async function (input) {
  const files = Array.from(input.files || []);
  input.value = '';
  for (const file of files) {
    if (postImgs.length >= MAX_IMGS) { toast(t(`⚠️ الحد الأقصى ${MAX_IMGS} صور`, `⚠️ Maximum ${MAX_IMGS} photos`), 'red'); break; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast(t('⚠️ صيغة غير مدعومة (JPG / PNG / WebP)', '⚠️ Format non supporté'), 'red'); continue; }
    if (file.size > 15 * 1024 * 1024) { toast(t('⚠️ حجم الصورة يتجاوز 15MB', '⚠️ Image trop lourde (max 15MB)'), 'red'); continue; }
    const raw = await readFile(file);
    const small = raw && await processAndCompress(raw);
    if (!small) { toast(t('الصورة غير صالحة أو غير مدعومة', 'Image invalide'), 'red'); continue; }
    postImgs.push(small);
  }
  renderPostThumbs();
};
window.removeImg = function (i) { postImgs.splice(i, 1); renderPostThumbs(); };
function resetImgs() { postImgs = []; renderPostThumbs(); }
function renderPostThumbs() {
  const box = $('postThumbs');
  if (!box) return;
  box.innerHTML = postImgs.map((s, i) => `<div class="pthumb"><img src="${s}" alt=""/><button type="button" onclick="removeImg(${i})" aria-label="x">✕</button></div>`).join('');
  const add = $('imgAddBtn');
  if (add) add.style.display = postImgs.length >= MAX_IMGS ? 'none' : '';
}

// ══════════════════════════════════════════════════════
// عناصر الفلاتر: كل عنصر يحمل data-f (اسم الفلتر) و data-v (قيمة الزر)
// ══════════════════════════════════════════════════════
function buildFilterControls() {
  document.querySelectorAll('select[data-f="brand"]').forEach(s => {
    s.innerHTML = `<option value="">${t('كل الماركات', 'Toutes les marques')}</option>` + BRANDS.map(b => `<option>${escHtml(b)}</option>`).join('');
  });
  document.querySelectorAll('select[data-f="wilaya"]').forEach(s => {
    s.innerHTML = `<option value="">${t('كل الولايات', 'Toutes les wilayas')}</option>` + WILAYAS.map(w => `<option value="${w.code}">${escHtml(wLabel(w))}</option>`).join('');
  });
  const chips = (f, table, allLabel) => document.querySelectorAll(`[data-chips="${f}"]`).forEach(box => {
    const cls = box.dataset.cls || 'chip';
    box.innerHTML = `<button type="button" class="${cls}" data-f="${f}" data-v="all">${allLabel}</button>` +
      Object.keys(table).map(k => `<button type="button" class="${cls}" data-f="${f}" data-v="${k}">${escHtml(lab(table, k))}</button>`).join('');
  });
  chips('fuel', FUEL, t('الكل', 'Tous'));
  chips('gear', GEAR, t('الكل', 'Tous'));
  chips('seller', SELLER, t('الكل', 'Tous'));
  const yrs = document.querySelectorAll('select[data-f="ymin"]');
  let o = `<option value="0">${t('أي سنة', 'Toute année')}</option>`;
  for (let y = new Date().getFullYear(); y >= 2000; y -= 1) o += `<option value="${y}">${t('من ', 'À partir de ')}${y}</option>`;
  yrs.forEach(s => { s.innerHTML = o; });
  syncControls();
}

function syncControls() {
  document.querySelectorAll('[data-f]').forEach(el => {
    const f = el.dataset.f;
    if (el.tagName === 'BUTTON') {
      const cur = F[f];
      const on = String(cur) === el.dataset.v;
      el.classList.toggle('active', on);
      el.classList.toggle('on', on);
      return;
    }
    if (document.activeElement === el) return;
    if (f === 'brand' || f === 'wilaya') el.value = F[f] || '';
    else if (f === 'ymin') el.value = String(F.ymin || 0);
    else if (f === 'pmin') el.value = F.pmin || '';
    else if (f === 'pmax') el.value = F.pmax === Infinity ? '' : F.pmax;
    else if (f === 'kmax') el.value = F.kmax === Infinity ? '' : F.kmax;
  });
  const q = $('searchQ'); if (q && document.activeElement !== q) q.value = F.q;
}

function readControl(el) {
  const f = el.dataset.f;
  if (el.tagName === 'BUTTON') { F[f] = el.dataset.v; return; }
  const v = el.value;
  if (f === 'brand') F.brand = v;
  else if (f === 'wilaya') F.wilaya = v;
  else if (f === 'ymin') F.ymin = parseInt(v, 10) || 0;
  else if (f === 'pmin') F.pmin = parseFloat(v) || 0;
  else if (f === 'pmax') F.pmax = parseFloat(v) || Infinity;
  else if (f === 'kmax') F.kmax = parseFloat(v) || Infinity;
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  readControl(b); syncControls(); applyFilters();
});
document.addEventListener('change', e => {
  const el = e.target.closest('select[data-f], input[data-f]');
  if (!el) return;
  readControl(el); syncControls(); applyFilters();
});
window.doSearch = function () { F.q = ($('searchQ') ? $('searchQ').value : ''); applyFilters(); };
window.resetFilters = function () {
  Object.assign(F, { q: '', brand: '', wilaya: '', fuel: 'all', gear: 'all', seller: 'all', ymin: 0, pmin: 0, pmax: Infinity, kmax: Infinity });
  syncControls(); applyFilters();
};
window.openFilterDrawer = () => { $('filterDrawer').classList.add('open'); $('filterOverlay').classList.add('open'); };
window.closeFilterDrawer = () => { $('filterDrawer').classList.remove('open'); $('filterOverlay').classList.remove('open'); };

function applyUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('q')) F.q = p.get('q').slice(0, 80);
  if (p.get('brand') && BRANDS.includes(p.get('brand'))) F.brand = p.get('brand');
  if (p.get('wilaya') && wilayaByCode(p.get('wilaya'))) F.wilaya = String(Number(p.get('wilaya')));
  if (p.get('fuel') && FUEL[p.get('fuel')]) F.fuel = p.get('fuel');
  if (p.get('gear') && GEAR[p.get('gear')]) F.gear = p.get('gear');
}

// ══════════════════════════════════════════════════════
// اللغة
// ══════════════════════════════════════════════════════
function applyLang(lang) {
  currentLang = lang;
  try { localStorage.setItem('cm_lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  if (window.DarnaI18n) window.DarnaI18n.apply();
  const lb = $('langBtn'); if (lb) lb.textContent = lang === 'ar' ? 'FR' : 'عربي';
  const q = $('searchQ'); if (q) q.placeholder = t('ابحث: ماركة، موديل، ولاية...', 'Marque, modèle, wilaya…');
  fillPostSelects();
  buildFilterControls();
  if (window.DarnaMap) window.DarnaMap.relabel();
  if (dataLoaded) applyFilters();
}
window.toggleLang = () => applyLang(currentLang === 'ar' ? 'fr' : 'ar');

// ══════════════════════════════════════════════════════
// Firebase: الاستماع للإعلانات
// ══════════════════════════════════════════════════════
let deepLinkDone = false;
function openAdFromHash() {
  if (deepLinkDone) return;
  const m = /^#ad-([A-Za-z0-9_-]+)$/.exec(location.hash || '');
  if (!m) { deepLinkDone = true; return; }
  if (DATA.some(x => String(x.id) === m[1])) { deepLinkDone = true; window.openD(m[1]); }
}
function startFirebaseListener() {
  if (PAGE_MODE === 'home') renderHomeLoading();
  const full = query(adsCol, orderBy('createdAt', 'desc'));
  const handle = snap => {
    DATA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dataLoaded = true; dataLoadError = false;
    applyFilters(); openAdFromHash();
  };
  const onError = err => {
    console.error('Firebase error:', err);
    if (dataLoaded) return;
    dataLoadError = true;
    toast(t('⚠️ تعذّر الاتصال بقاعدة البيانات', '⚠️ Connexion à la base impossible'), 'red');
    if (PAGE_MODE === 'home') renderHomeError(); else renderAds([]);
  };
  if (PAGE_MODE !== 'home') { onSnapshot(full, handle, onError); return; }
  // الرئيسية: أحدث 30 إعلاناً لظهور سريع ثم الكل للخريطة
  let fullStarted = false, fullLoaded = false;
  const startFull = () => {
    if (fullStarted) return; fullStarted = true;
    onSnapshot(full, snap => { fullLoaded = true; unsubFast(); handle(snap); }, onError);
  };
  const unsubFast = onSnapshot(query(adsCol, orderBy('createdAt', 'desc'), limit(30)),
    snap => { if (!fullLoaded) handle(snap); startFull(); },
    err => { onError(err); startFull(); });
}

// ══════════════════════════════════════════════════════
// تشغيل
// ══════════════════════════════════════════════════════
applyUrlParams();
applyLang(currentLang);
if (PAGE_MODE === 'listings') renderAds([]);
startFirebaseListener();
window.addEventListener('hashchange', () => { deepLinkDone = false; openAdFromHash(); });
window.addEventListener('resize', updateHomeArrows);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW registration failed:', err)); });
}
