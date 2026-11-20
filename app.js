import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, onSnapshot, query, orderBy, limit, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════
// إعدادات الموقع — عدّل هذه القيم فقط
// ══════════════════════════════════════════════════════
const SITE_NAME = 'Cars Market DZ';
// رقم واتساب صاحب الموقع بالصيغة الدولية بدون + (مثال: 2135XXXXXXXX). يُستعمل لطلبات الإعلان المميز.
const OWNER_WHATSAPP = '+213562517768';
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

// App Check (حماية من السبام والسكربتات): اتركه فارغاً حتى تُنشئ مفتاح reCAPTCHA v3 وتسجّله في
// Firebase ← App Check. بعد ضبط المفتاح وتجربة النشر، فعّل "Enforce" لـ Firestore من لوحة Firebase.
const APPCHECK_SITE_KEY = '';
if (APPCHECK_SITE_KEY) {
  try {
    const ac = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js");
    ac.initializeAppCheck(app, { provider: new ac.ReCaptchaV3Provider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
  } catch (e) { console.error('App Check init failed', e); }
}
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true });
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
const PART_CAT = window.CM_PART_CAT || {};
const COND = window.CM_COND || {};
const PART_SYN = window.CM_PART_SYN || {};
const SITE_ORIGIN = 'https://cars-market0.netlify.app';
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
// نوع الإعلان: الإعلانات القديمة بلا kind (أو بقيمة غير معروفة) تُعامَل كسيارات
const adKind = ad => (ad && ad.kind === 'part' ? 'part' : 'car');
const partTitle = ad => ad.partName || ad.title || t('قطعة غيار', 'Pièce auto');
const adTitle = ad => (adKind(ad) === 'part' ? partTitle(ad) : carTitle(ad));
// التوافق: "Renault Clio 4 · 2013-2019"
function compatText(ad) {
  const base = [ad.compatBrand, ad.compatModel].filter(Boolean).join(' ');
  const a = Number(ad.compatYearFrom) || 0, b = Number(ad.compatYearTo) || 0;
  let yrs = '';
  if (a && b) yrs = a === b ? String(a) : `${a}-${b}`;
  else if (a) yrs = `${a}+`;
  else if (b) yrs = `≤${b}`;
  return [base, yrs].filter(Boolean).join(' · ');
}

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
// مرادفات القطع بعد التطبيع (فرامل ← plaquettes ...)
const SYN = {};
Object.keys(PART_SYN).forEach(k => { SYN[norm(k)] = PART_SYN[k].map(norm); });
function tokenAlts(tok) {
  const alts = [tok];
  const bare = tok.length > 4 && tok.startsWith('ال') ? tok.slice(2) : tok; // الفرامل → فرامل
  if (bare !== tok) alts.push(bare);
  [tok, bare].forEach(k => {
    if (BRAND_ALIASES[k]) alts.push(BRAND_ALIASES[k]);
    if (SYN[k]) SYN[k].forEach(a => alts.push(a));
  });
  return alts;
}
function haystack(ad) {
  const w = wilayaByCode(ad.wilaya);
  if (adKind(ad) === 'part') {
    const c = PART_CAT[ad.partCategory] || {}, d = COND[ad.condition] || {};
    const pn = String(ad.partNumber || '');
    return norm([ad.partName, ad.title, pn, pn.replace(/[^A-Za-z0-9]/g, ''), c.ar, c.fr, d.ar, d.fr,
      ad.compatBrand, ad.compatModel, ad.compatYearFrom, ad.compatYearTo, ad.desc, w && w.ar, w && w.fr].join(' '));
  }
  return norm([ad.brand, ad.model, ad.title, ad.year, ad.desc, w && w.ar, w && w.fr, lab(FUEL, ad.fuel), FUEL[ad.fuel] && FUEL[ad.fuel].fr,
    FUEL[ad.fuel] && FUEL[ad.fuel].ar, GEAR[ad.gearbox] && GEAR[ad.gearbox].ar, GEAR[ad.gearbox] && GEAR[ad.gearbox].fr].join(' '));
}
function adMatchesSearch(ad, raw) {
  const tokens = norm(raw).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const hay = ad.__hay || (ad.__hay = haystack(ad));
  return tokens.every(tok => tokenAlts(tok).some(a => a && hay.includes(a)));
}

// ══════════════════════════════════════════════════════
// الحالة والفلاتر (حالة واحدة مركزية لكل عناصر data-f)
// ══════════════════════════════════════════════════════
const PAGE_MODE = document.body.dataset.mode === 'listings' ? 'listings' : 'home';
let DATA = [];
let displayList = [];
let dataLoaded = false;
let dataLoadError = false;
const baseF = () => ({ q: '', brand: '', wilaya: '', fuel: 'all', gear: 'all', seller: 'all', ymin: 0, pmin: 0, pmax: Infinity, kmax: Infinity, pcat: 'all', pcond: 'all', cbrand: '' });
const F = Object.assign({ kind: 'car' }, baseF()); // kind: 'car' | 'part'

function applyFilters() {
  displayList = DATA.filter(ad => {
    if (adKind(ad) !== F.kind) return false;
    if (F.wilaya && Number(ad.wilaya) !== Number(F.wilaya)) return false;
    if (F.seller !== 'all' && ad.seller !== F.seller) return false;
    const price = Number(ad.price) || 0;
    if (price < F.pmin || price > F.pmax) return false;
    if (F.kind === 'car') {
      if (F.brand && ad.brand !== F.brand) return false;
      if (F.fuel !== 'all' && ad.fuel !== F.fuel) return false;
      if (F.gear !== 'all' && ad.gearbox !== F.gear) return false;
      if (F.ymin && Number(ad.year) < F.ymin) return false;
      if (F.kmax !== Infinity && Number(ad.km) > F.kmax) return false;
    } else {
      if (F.pcat !== 'all' && ad.partCategory !== F.pcat) return false;
      if (F.pcond !== 'all' && ad.condition !== F.pcond) return false;
      if (F.cbrand && ad.compatBrand !== F.cbrand) return false;
    }
    if (F.q && !adMatchesSearch(ad, F.q)) return false;
    return true;
  });
  sortAndRender();
}

function sortAndRender() {
  let s = $('srt') ? $('srt').value : 'new';
  if (F.kind === 'part' && (s === 'ya' || s === 'km')) s = 'new'; // الفرز بالسنة/الكيلومترات للسيارات فقط
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
    if (F.kind === 'car' && window.DarnaMap && dataLoaded) window.DarnaMap.render(displayList); // الخريطة للسيارات فقط
  } else {
    renderAds(displayList);
  }
}
window.sl = () => sortAndRender();

// ══════════════════════════════════════════════════════
// بطاقة السيارة
// ══════════════════════════════════════════════════════
function buildCardHTML(ad) { return adKind(ad) === 'part' ? buildPartCardHTML(ad) : buildCarCardHTML(ad); }

function buildPartCardHTML(ad) {
  const safeId = escHtml(ad.id);
  const imgs = adImages(ad);
  const feat = isFeatured(ad);
  const imgHtml = imgs.length
    ? `<img src="${imgs[0]}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>${imgs.length > 1 ? `<span class="c-count">📷 ${imgs.length}</span>` : ''}`
    : `<div class="cimg-ph" style="background:linear-gradient(135deg,#E0F2FE,#BAE6FD)">🔧</div>`;
  const sellerColor = ad.seller === 'dealer' ? '#0284C7' : '#64748B';
  const compat = compatText(ad);
  const cond = COND[ad.condition] ? ad.condition : '';
  return `
  <div class="card card-part${feat ? ' card-feat' : ''}" data-id="${safeId}">
    <div class="cimg">
      ${imgHtml}
      ${ad.seller ? `<span class="bt" style="background:${sellerColor}">${escHtml(lab(SELLER, ad.seller))}</span>` : ''}
      ${feat ? `<span class="bo feat-badge">⭐ ${t('مميز', 'Sponsorisé')}</span>` : ''}
    </div>
    <div class="cbody">
      <div class="ctitle">${escHtml(partTitle(ad))}</div>
      <div class="cspecs">
        ${cond ? `<span class="pcond pcond-${cond}">${escHtml(lab(COND, cond))}</span>` : ''}
        ${PART_CAT[ad.partCategory] ? `<span>🏷️ ${escHtml(lab(PART_CAT, ad.partCategory))}</span>` : ''}
      </div>
      ${compat ? `<div class="cloc pcompat">🚘 <span dir="ltr">${escHtml(compat)}</span></div>` : ''}
      <div class="cloc">📍 ${escHtml(wName(ad.wilaya) || t('الجزائر', 'Algérie'))}</div>
      <div class="cfoot">
        <div class="price">${ad.price ? fmt(ad.price) : '—'} <small>DA</small></div>
      </div>
      <div class="cacts">
        <button type="button" class="btn-wa" data-act="wa">💬 ${t('واتساب', 'WhatsApp')}</button>
        <button type="button" class="btn-call" data-act="call">📞 ${t('اتصال', 'Appeler')}</button>
      </div>
    </div>
  </div>`;
}

function buildCarCardHTML(ad) {
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
  else if (actEl.dataset.act === 'wa') openWA(ad.phone, adTitle(ad), ad.id);
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
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div style="font-size:48px;margin-bottom:12px">🔍</div><h3>${F.kind === 'part' ? t('لا توجد قطع غيار مطابقة', 'Aucune pièce trouvée') : t('لا توجد سيارات مطابقة', 'Aucune voiture trouvée')}</h3><p>${t('جرّب تغيير الفلاتر أو البحث', 'Essayez de modifier les filtres ou la recherche')}</p></div>`;
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
const filtersActive = () => !!(F.q.trim() || F.wilaya || F.seller !== 'all' || F.pmin || F.pmax !== Infinity ||
  (F.kind === 'car' ? (F.brand || F.fuel !== 'all' || F.gear !== 'all' || F.ymin || F.kmax !== Infinity)
                    : (F.pcat !== 'all' || F.pcond !== 'all' || F.cbrand)));

function buildListingsUrl() {
  const p = new URLSearchParams();
  if (F.kind === 'part') p.set('kind', 'part');
  if (F.q.trim()) p.set('q', F.q.trim());
  if (F.wilaya) p.set('wilaya', F.wilaya);
  if (F.seller !== 'all') p.set('seller', F.seller);
  if (F.kind === 'car') {
    if (F.brand) p.set('brand', F.brand);
    if (F.fuel !== 'all') p.set('fuel', F.fuel);
    if (F.gear !== 'all') p.set('gear', F.gear);
  } else {
    if (F.pcat !== 'all') p.set('pcat', F.pcat);
    if (F.pcond !== 'all') p.set('pcond', F.pcond);
    if (F.cbrand) p.set('cbrand', F.cbrand);
  }
  return 'listings.html' + (p.toString() ? '?' + p.toString() : '');
}

function renderHomeLoading() {
  const grid = $('homeGrid');
  if (!grid) return;
  grid.innerHTML = skeletonCardsHTML(HOME_PREVIEW_COUNT);
  if (window.DarnaMap) window.DarnaMap.setState('loading');
  const title = $('homeSectionTitle');
  if (title) title.textContent = F.kind === 'part' ? t('جارٍ تحميل قطع الغيار...', 'Chargement des pièces…') : t('جارٍ تحميل السيارات...', 'Chargement des annonces…');
}
window.retryLoadAds = function () { dataLoadError = false; renderHomeLoading(); startFirebaseListener(); };

function renderHomeError() {
  const grid = $('homeGrid');
  if (window.DarnaMap) window.DarnaMap.setState('error');
  if (!grid) return;
  grid.innerHTML = `<div class="home-status-box"><div class="icon">⚠️</div><div>${t('تعذّر تحميل الإعلانات.', 'Impossible de charger les annonces.')}</div><button class="btn-retry" data-action="retry">${t('إعادة المحاولة', 'Réessayer')}</button></div>`;
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
      : `${F.kind === 'part' ? t('أحدث قطع الغيار', 'Dernières pièces auto') : t('أحدث السيارات', 'Dernières voitures')} <span class="cnt">— ${total} ${t(total > 1 ? 'إعلانات' : 'إعلان', total > 1 ? 'annonces' : 'annonce')}</span>`;
  }
  const btn = $('homeViewAllBtn');
  if (btn) {
    btn.href = buildListingsUrl();
    btn.textContent = active ? t('عرض جميع النتائج ←', 'Voir tous les résultats →')
      : (F.kind === 'part' ? t('عرض جميع قطع الغيار ←', 'Voir toutes les pièces →') : t('عرض جميع السيارات ←', 'Voir toutes les voitures →'));
  }
  const items = displayList.slice(0, HOME_PREVIEW_COUNT);
  if (!items.length) {
    grid.innerHTML = `<div class="home-status-box"><div class="icon">🔍</div><div>${F.kind === 'part' ? t('لا توجد قطع غيار مطابقة', 'Aucune pièce trouvée') : t('لا توجد سيارات مطابقة', 'Aucune voiture trouvée')}</div><div style="font-size:12px;margin-top:4px">${t('جرّب فلتراً آخر', 'Essayez un autre filtre')}</div></div>`;
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
  const part = adKind(ad) === 'part';
  const ttl = adTitle(ad);
  const imgs = adImages(ad);
  const mimg = $('mimg');
  const showImg = i => {
    mimg.style.background = '';
    mimg.innerHTML = `<img src="${imgs[i]}" alt="${escHtml(ttl)}" style="width:100%;height:100%;object-fit:cover"/>`;
    document.querySelectorAll('#mthumbs img').forEach((el, k) => el.classList.toggle('on', k === i));
  };
  if (imgs.length) showImg(0);
  else { mimg.style.background = 'linear-gradient(135deg,#E0F2FE,#BAE6FD)'; mimg.innerHTML = '<div class="mimg-ph" style="background:transparent">' + (part ? '🔧' : '🚗') + '</div>'; }
  const th = $('mthumbs');
  if (th) {
    th.innerHTML = imgs.length > 1 ? imgs.map((s, i) => `<img src="${s}" alt="" data-i="${i}"${i === 0 ? ' class="on"' : ''}/>`).join('') : '';
    th.onclick = e => { const im = e.target.closest('img[data-i]'); if (im) showImg(Number(im.dataset.i)); };
  }

  $('mtt').textContent = ttl;
  $('mbg').innerHTML = `
    ${isFeatured(ad) ? `<span style="background:linear-gradient(135deg,#F0C855,#C9A84C);color:#033a5a;padding:5px 13px;border-radius:50px;font-weight:800">⭐ ${t('مميز', 'Sponsorisé')}</span>` : ''}
    ${part && COND[ad.condition] ? `<span class="pcond pcond-${ad.condition} pcond-lg">${escHtml(lab(COND, ad.condition))}</span>` : ''}
    ${ad.seller ? `<span style="background:${ad.seller === 'dealer' ? '#0284C7' : '#64748B'};color:#fff;padding:5px 13px;border-radius:50px">${escHtml(lab(SELLER, ad.seller))}</span>` : ''}`;
  $('mds').textContent = ad.desc || t('لا يوجد وصف إضافي.', 'Aucune description.');
  const spec = (icon, val, label) => `<div class="mspec"><strong>${icon} ${escHtml(val)}</strong>${label}</div>`;
  const priceSpec = spec('💰', ad.price ? fmt(ad.price) + ' DA' : '—', `${t('السعر', 'Prix')}${ad.price && !part ? ' · ' + escHtml(centimes(ad.price)) : ''}`);
  if (part) {
    $('msp').innerHTML = [
      priceSpec,
      spec('🔧', partTitle(ad), t('اسم القطعة', 'Pièce')),
      spec('🏷️', lab(PART_CAT, ad.partCategory) || '—', t('الفئة', 'Catégorie')),
      spec('✅', lab(COND, ad.condition) || '—', t('الحالة', 'État')),
      spec('🚘', compatText(ad) || '—', t('التوافق', 'Compatibilité')),
      spec('#️⃣', ad.partNumber || '—', t('رقم القطعة', 'Référence')),
      spec('📍', wName(ad.wilaya) || '—', t('الولاية', 'Wilaya')),
      spec('🧑‍💼', lab(SELLER, ad.seller) || '—', t('البائع', 'Vendeur')),
      spec('📅', ad.date || '—', t('تاريخ النشر', 'Publié le'))
    ].join('');
  } else $('msp').innerHTML = [
    priceSpec,
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
  $('mwa').onclick = () => openWA(ad.phone, ttl, ad.id);
  let seen = false;
  try { seen = sessionStorage.getItem('cm_v_' + ad.id) === '1'; sessionStorage.setItem('cm_v_' + ad.id, '1'); } catch (e) {}
  if (!seen) updateDoc(doc(db, 'clients', String(ad.id)), { views: increment(1) }).catch(() => {});
  $('dm').classList.add('open');
};

// ══════════════════════════════════════════════════════
// مشاركة واتصال
// ══════════════════════════════════════════════════════
window.adShareUrl = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html#ad-${encodeURIComponent(String(id))}`;
const adShareText = ad => `${adKind(ad) === 'part' ? '🔧' : '🚗'} ${adTitle(ad)}\n📍 ${wName(ad.wilaya)}\n💰 ${fmt(ad.price)} DA`;
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
    (ref ? `\nرقم الإعلان: ${ref}` : '') + (ad ? `\n${adTitle(ad)}` : '') + '\nكيف أدفع؟';
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
  // قطع الغيار
  set('ppcat', `<option value="">${t('اختر الفئة', 'Choisir la catégorie')}</option>` + Object.keys(PART_CAT).map(k => `<option value="${k}">${escHtml(lab(PART_CAT, k))}</option>`).join(''), keep('ppcat'));
  set('ppcond', `<option value="">${t('اختر الحالة', 'Choisir l’état')}</option>` + Object.keys(COND).map(k => `<option value="${k}">${escHtml(lab(COND, k))}</option>`).join(''), keep('ppcond'));
  set('ppbrand', `<option value="">${t('غير محدد', 'Non précisée')}</option>` + BRANDS.map(b => `<option>${escHtml(b)}</option>`).join(''), keep('ppbrand'));
  set('ppyf', `<option value="">${t('—', '—')}</option>` + years, keep('ppyf'));
  set('ppyt', `<option value="">${t('—', '—')}</option>` + years, keep('ppyt'));
}

// خطوة 1: اختيار النوع (سيارة / قطعة غيار) ثم يظهر النموذج المناسب
let postKind = '';
function showPostStep(kind) {
  postKind = kind === 'car' || kind === 'part' ? kind : '';
  const pm = $('pm');
  if (!pm) return;
  if ($('pkStep')) $('pkStep').hidden = !!postKind;
  if ($('pkBack')) $('pkBack').hidden = !postKind;
  pm.querySelectorAll('[data-pfor]').forEach(el => { el.hidden = el.dataset.pfor !== postKind; });
  pm.querySelectorAll('.pk-common').forEach(el => { el.hidden = !postKind; });
  refreshKindTexts();
}
window.openPost = function () { showPostStep(''); $('pm').classList.add('open'); };

const todayStr = () => new Date().toISOString().slice(0, 10);

// كل دالة ترجع { doc } أو { err } — الحدود مطابقة لـ firestore.rules
function buildCarDoc(c) {
  const brand = $('pbrand').value;
  const model = $('pmodel').value.trim();
  const year = parseInt($('pyear').value, 10);
  const km = parseInt($('pkm').value, 10);
  if (!brand || !year || !c.wilaya || !(c.price > 0) || !c.phone || isNaN(km)) return { err: t('⚠️ أكمل الماركة والسنة والكيلومترات والولاية والسعر والهاتف', '⚠️ Remplissez marque, année, km, wilaya, prix et téléphone') };
  if (km < 0 || km > 2000000) return { err: t('⚠️ عدد الكيلومترات غير صحيح', '⚠️ Kilométrage invalide') };
  if (c.price > 1000000000) return { err: t('⚠️ السعر غير صحيح', '⚠️ Prix invalide') };
  return { doc: {
    kind: 'car', brand, model: model.slice(0, 40), year, km,
    fuel: $('pfuel').value, gearbox: $('pgear').value, seller: c.seller,
    wilaya: c.wilaya, price: c.price,
    title: [brand, model, year].filter(Boolean).join(' ').slice(0, 100),
    desc: c.desc, phone: c.phone, date: todayStr(), createdAt: Date.now(), views: 0
  } };
}

function buildPartDoc(c) {
  const partName = $('ppname').value.trim();
  const cat = $('ppcat').value, cond = $('ppcond').value;
  const cbrand = $('ppbrand').value, cmodel = $('ppmodel').value.trim();
  const yf = parseInt($('ppyf').value, 10), yt = parseInt($('ppyt').value, 10);
  const pnum = $('ppnum').value.trim();
  if (partName.length < 2 || !PART_CAT[cat] || !COND[cond] || !c.wilaya || !(c.price > 0) || !c.phone) return { err: t('⚠️ أكمل اسم القطعة والفئة والحالة والولاية والسعر والهاتف', '⚠️ Remplissez pièce, catégorie, état, wilaya, prix et téléphone') };
  if (c.price > 100000000) return { err: t('⚠️ السعر غير صحيح', '⚠️ Prix invalide') };
  if (cmodel && !cbrand) return { err: t('⚠️ اختر الماركة المتوافقة قبل كتابة الموديل', '⚠️ Choisissez la marque compatible avant le modèle') };
  if (!isNaN(yf) && !isNaN(yt) && yf > yt) return { err: t('⚠️ سنة البداية أكبر من سنة النهاية', '⚠️ L’année de début dépasse l’année de fin') };
  const doc = {
    kind: 'part', partName: partName.slice(0, 80), partCategory: cat, condition: cond,
    seller: c.seller, wilaya: c.wilaya, price: c.price,
    title: partName.slice(0, 100), desc: c.desc, phone: c.phone,
    date: todayStr(), createdAt: Date.now(), views: 0
  };
  // الحقول الاختيارية لا تُرسل فارغة (القواعد ترفض النص الفارغ فيها)
  if (cbrand) doc.compatBrand = cbrand;
  if (cbrand && cmodel) doc.compatModel = cmodel.slice(0, 40);
  if (!isNaN(yf)) doc.compatYearFrom = yf;
  if (!isNaN(yt)) doc.compatYearTo = yt;
  if (pnum) doc.partNumber = pnum.slice(0, 40);
  return { doc };
}

window.sub = async function () {
  if (!postKind) { toast(t('⚠️ اختر نوع الإعلان أولاً', '⚠️ Choisissez d’abord le type d’annonce'), 'red'); return; }
  const c = {
    wilaya: parseInt($('pwil').value, 10), price: parseInt($('pp').value, 10),
    phone: $('ph').value.trim(), seller: $('pseller').value, desc: $('pd').value.trim().slice(0, 1500)
  };
  const built = postKind === 'part' ? buildPartDoc(c) : buildCarDoc(c);
  if (built.err) { toast(built.err, 'red'); return; }
  if (!/^213([567]\d{8}|[234]\d{7})$/.test(intlPhone(c.phone))) { toast(t('⚠️ رقم هاتف جزائري غير صحيح (مثال: 0550123456)', '⚠️ Numéro algérien invalide (ex : 0550123456)'), 'red'); return; }
  const docData = built.doc;
  const btn = document.querySelector('#pm .btn-submit');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = t('⏳ جارٍ النشر...', '⏳ Publication…');
  try {
    if (postImgs.length) docData.imgs = postImgs.slice();
    const ref = await addDoc(adsCol, docData);
    window.cm('pm');
    ['pmodel', 'pkm', 'pp', 'ph', 'pd', 'ppname', 'ppnum', 'ppmodel'].forEach(id => { if ($(id)) $(id).value = ''; });
    ['pbrand', 'pyear', 'pwil', 'ppcat', 'ppcond', 'ppbrand', 'ppyf', 'ppyt'].forEach(id => { if ($(id)) $(id).value = ''; });
    resetImgs();
    toast(t('✅ تم نشر إعلانك بنجاح!', '✅ Annonce publiée !'));
    showFeatPrompt(ref.id);
    if (docData.kind !== F.kind) window.setKind(docData.kind); // ننتقل إلى تبويب ما نُشر ليرى المستخدم إعلانه
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
  box.innerHTML = postImgs.map((s, i) => `<div class="pthumb"><img src="${s}" alt=""/><button type="button" data-action="removeImg" data-i="${i}" aria-label="x">✕</button></div>`).join('');
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
  document.querySelectorAll('select[data-f="cbrand"]').forEach(sel => {
    sel.innerHTML = `<option value="">${t('كل الماركات', 'Toutes les marques')}</option>` + BRANDS.map(b => `<option>${escHtml(b)}</option>`).join('');
  });
  document.querySelectorAll('select[data-f="pcat"]').forEach(sel => {
    sel.innerHTML = `<option value="">${t('كل الفئات', 'Toutes les catégories')}</option>` + Object.keys(PART_CAT).map(k => `<option value="${k}">${escHtml(lab(PART_CAT, k))}</option>`).join('');
  });
  // شريط الولايات (تبويب القطع في الرئيسية): زر لكل ولاية، data-v الفارغ = كل الولايات
  document.querySelectorAll('[data-wstrip]').forEach(box => {
    box.innerHTML = `<button type="button" class="wchip" data-f="wilaya" data-v="">${t('كل الولايات', 'Toutes')}</button>` +
      WILAYAS.map(w => `<button type="button" class="wchip" data-f="wilaya" data-v="${w.code}">${escHtml(String(w.code).padStart(2, '0') + ' ' + (fr() ? w.fr : w.ar))}</button>`).join('');
  });
  chips('pcond', COND, t('الكل', 'Tous'));
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
    else if (f === 'pcat') el.value = F.pcat === 'all' ? '' : F.pcat;
    else if (f === 'cbrand') el.value = F.cbrand || '';
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
  else if (f === 'pcat') F.pcat = v || 'all';
  else if (f === 'cbrand') F.cbrand = v;
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
  Object.assign(F, baseF());
  syncControls(); applyFilters();
};
window.openFilterDrawer = () => { $('filterDrawer').classList.add('open'); $('filterOverlay').classList.add('open'); };
window.closeFilterDrawer = () => { $('filterDrawer').classList.remove('open'); $('filterOverlay').classList.remove('open'); };

function applyUrlParams() {
  const p = new URLSearchParams(location.search);
  // النوع: الرابط ?kind=part أولاً، ثم آخر اختيار محفوظ، ثم سيارات
  let k = p.get('kind');
  if (k !== 'car' && k !== 'part') { try { k = localStorage.getItem('cm_kind'); } catch (e) { k = null; } }
  F.kind = k === 'part' ? 'part' : 'car';
  if (p.get('seller') && SELLER[p.get('seller')]) F.seller = p.get('seller');
  if (p.get('pcat') && PART_CAT[p.get('pcat')]) F.pcat = p.get('pcat');
  if (p.get('pcond') && COND[p.get('pcond')]) F.pcond = p.get('pcond');
  if (p.get('cbrand') && BRANDS.includes(p.get('cbrand'))) F.cbrand = p.get('cbrand');
  if (p.get('q')) F.q = p.get('q').slice(0, 80);
  if (p.get('brand') && BRANDS.includes(p.get('brand'))) F.brand = p.get('brand');
  if (p.get('wilaya') && wilayaByCode(p.get('wilaya'))) F.wilaya = String(Number(p.get('wilaya')));
  if (p.get('fuel') && FUEL[p.get('fuel')]) F.fuel = p.get('fuel');
  if (p.get('gear') && GEAR[p.get('gear')]) F.gear = p.get('gear');
}

// ══════════════════════════════════════════════════════
// تبويب النوع (سيارات / قطع غيار): الحالة، النصوص، SEO، الرابط
// ══════════════════════════════════════════════════════
const SEO = {
  home: {
    car: { title: 'Cars Market DZ | سيارات وقطع غيار للبيع في الجزائر — خريطة تفاعلية وإعلانات مجانية', path: '/',
      desc: 'سوق السيارات وقطع الغيار في الجزائر: ابحث عن سيارات للبيع على خريطة تفاعلية حسب الولاية والماركة والسعر، وانشر إعلانك مجاناً.' },
    part: { title: 'قطع غيار السيارات في الجزائر — جديدة ومستعملة | Cars Market DZ', path: '/?kind=part',
      desc: 'قطع غيار سيارات للبيع في الجزائر: محرك، فرامل، تعليق، كهرباء، إطارات وأكثر. ابحث بالاسم أو رقم القطعة أو الماركة المتوافقة، وانشر قطعتك مجاناً.' }
  },
  listings: {
    car: { title: 'كل السيارات للبيع في الجزائر | Cars Market DZ', path: '/listings.html',
      desc: 'تصفح كل إعلانات السيارات في الجزائر مع فلاتر حسب الماركة والولاية والوقود وناقل الحركة والسنة والسعر والكيلومترات.' },
    part: { title: 'كل قطع غيار السيارات للبيع في الجزائر | Cars Market DZ', path: '/listings.html?kind=part',
      desc: 'تصفح كل قطع غيار السيارات في الجزائر مع فلاتر حسب الفئة والحالة والماركة المتوافقة والولاية والسعر، وبحث برقم القطعة.' }
  }
};
function applySeo() {
  const s = (SEO[PAGE_MODE] || SEO.home)[F.kind];
  const url = SITE_ORIGIN + s.path;
  const set = (sel, attr, v) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, v); };
  document.title = s.title;
  set('meta[name="description"]', 'content', s.desc);
  set('meta[property="og:title"]', 'content', s.title);
  set('meta[property="og:description"]', 'content', s.desc);
  set('meta[property="og:url"]', 'content', url);
  set('link[rel="canonical"]', 'href', url);
}

// عناصر تحمل data-ar-car / data-ar-part (وفرنسيتها): نختار النص حسب النوع.
// داخل نافذة النشر يُستعمل postKind (والفارغ = النص الافتراضي)، وخارجها نوع التصفح F.kind.
function applyKindAttrs() {
  document.querySelectorAll('[data-ar-car]').forEach(el => {
    if (!el.hasAttribute('data-ar-0')) { el.setAttribute('data-ar-0', el.getAttribute('data-ar') || ''); el.setAttribute('data-fr-0', el.getAttribute('data-fr') || ''); }
    const k = el.closest('#pm') ? (postKind || '0') : F.kind;
    const ar = el.getAttribute('data-ar-' + k), f = el.getAttribute('data-fr-' + k);
    if (ar != null) el.setAttribute('data-ar', ar);
    if (f != null) el.setAttribute('data-fr', f);
  });
}
function refreshKindTexts() { applyKindAttrs(); if (window.DarnaI18n) window.DarnaI18n.apply(); }

const searchPlaceholder = () => (F.kind === 'part'
  ? t('ابحث: اسم القطعة، رقم القطعة، فرامل، فلتر زيت...', 'Pièce, référence, plaquettes, filtre à huile…')
  : t('ابحث: ماركة، موديل، ولاية...', 'Marque, modèle, wilaya…'));

function applyKindState() {
  document.body.dataset.kind = F.kind; // يتحكم في إظهار/إخفاء عناصر data-for عبر CSS
  document.querySelectorAll('.kind-tab').forEach(b => {
    const on = b.dataset.k === F.kind;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const srt = $('srt');
  if (srt) {
    Array.from(srt.options).forEach(o => { o.hidden = o.disabled = F.kind === 'part' && (o.value === 'ya' || o.value === 'km'); });
    if (F.kind === 'part' && (srt.value === 'ya' || srt.value === 'km')) srt.value = 'new';
  }
  const q = $('searchQ'); if (q) q.placeholder = searchPlaceholder();
  applySeo();
  refreshKindTexts();
}
function updateUrlKind() {
  try {
    const u = new URL(location.href);
    if (F.kind === 'part') u.searchParams.set('kind', 'part'); else u.searchParams.delete('kind');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch (e) {}
}
window.setKind = function (k) {
  k = k === 'part' ? 'part' : 'car';
  if (k === F.kind) return;
  // الفلاتر الخاصة بكل نوع (والسعر والبحث) تُصفَّر، ونُبقي الولاية ونوع البائع
  Object.assign(F, baseF(), { kind: k, wilaya: F.wilaya, seller: F.seller });
  try { localStorage.setItem('cm_kind', k); } catch (e) {}
  applyKindState();
  if (k === 'car' && window.DarnaMap && window.DarnaMap.invalidate) window.DarnaMap.invalidate(); // الخريطة كانت مخفية
  syncControls();
  updateUrlKind();
  if (dataLoaded) applyFilters();
};

// ══════════════════════════════════════════════════════
// اللغة
// ══════════════════════════════════════════════════════
function applyLang(lang) {
  currentLang = lang;
  try { localStorage.setItem('cm_lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  document.body.dataset.kind = F.kind;
  applyKindAttrs();
  if (window.DarnaI18n) window.DarnaI18n.apply();
  const lb = $('langBtn'); if (lb) lb.textContent = lang === 'ar' ? 'FR' : 'عربي';
  const q = $('searchQ'); if (q) q.placeholder = searchPlaceholder();
  document.querySelectorAll('.kind-tab').forEach(b => { const on = b.dataset.k === F.kind; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
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
let unsubs = [];
function stopListeners() { unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = []; }
const MAX_ADS = 300; // سقف مؤقت لحماية حصة القراءة إلى أن يُضاف ترقيم الصفحات
function startFirebaseListener() {
  stopListeners();
  if (PAGE_MODE === 'home') renderHomeLoading();
  const full = query(adsCol, orderBy('createdAt', 'desc'), limit(MAX_ADS));
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
  if (PAGE_MODE !== 'home') { unsubs.push(onSnapshot(full, handle, onError)); return; }
  // الرئيسية: أحدث 30 إعلاناً لظهور سريع، ثم القائمة الكاملة للخريطة
  let fullStarted = false, fullLoaded = false, unsubFast = () => {};
  const startFull = () => {
    if (fullStarted) return; fullStarted = true;
    unsubs.push(onSnapshot(full, snap => { fullLoaded = true; unsubFast(); handle(snap); }, onError));
  };
  unsubFast = onSnapshot(query(adsCol, orderBy('createdAt', 'desc'), limit(30)),
    snap => { if (!fullLoaded) handle(snap); startFull(); },
    err => { onError(err); startFull(); });
  unsubs.push(unsubFast);
}

// ══════════════════════════════════════════════════════
// تشغيل
// ══════════════════════════════════════════════════════
// ── أوامر الأزرار (data-action) بدل onclick المضمّنة، حتى تعمل CSP الصارمة ──
const ACTIONS = {
  openPost: () => window.openPost(),
  toggleLang: () => window.toggleLang(),
  doSearch: () => window.doSearch(),
  sub: () => window.sub(),
  copyAdLink: () => window.copyAdLink(),
  resetFilters: () => window.resetFilters(),
  openFilterDrawer: () => window.openFilterDrawer(),
  closeFilterDrawer: () => window.closeFilterDrawer(),
  homeScroll: el => window.homeScroll(Number(el.dataset.dir) || 1),
  close: el => window.cm(el.dataset.target),
  retry: () => window.retryLoadAds(),
  removeImg: el => window.removeImg(Number(el.dataset.i)),
  setKind: el => window.setKind(el.dataset.k),
  pickKind: el => showPostStep(el.dataset.k === 'part' ? 'part' : 'car'),
  pickKindBack: () => showPostStep(''),
  scrollTop: () => window.scrollTo({ top: 0, behavior: 'smooth' })
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) { if (el.tagName === 'A') e.preventDefault(); ACTIONS[el.dataset.action](el); return; }
  // الضغط على الخلفية المعتمة يغلق النافذة
  if (e.target.classList && e.target.classList.contains('overlay') && e.target.id) window.cm(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.overlay.open');
    if (open) window.cm(open.id); else if ($('filterDrawer') && $('filterDrawer').classList.contains('open')) window.closeFilterDrawer();
  }
});
if ($('searchQ')) $('searchQ').addEventListener('keydown', e => { if (e.key === 'Enter') window.doSearch(); });
if ($('srt')) $('srt').addEventListener('change', () => window.sl());
if ($('imgFileInput')) $('imgFileInput').addEventListener('change', e => window.handleImgUpload(e.target));

applyUrlParams();
applyLang(currentLang);
applyKindState();
if (PAGE_MODE === 'listings') renderAds([]);
startFirebaseListener();
window.addEventListener('hashchange', () => { deepLinkDone = false; openAdFromHash(); });
window.addEventListener('resize', updateHomeArrows);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW registration failed:', err)); });
}
