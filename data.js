/* Cars Market DZ — بيانات مشتركة: الولايات الـ58 + الماركات + أنواع الوقود وناقل الحركة
   الولاية: (الرمز، العربية، الفرنسية، خط العرض، خط الطول)
   الإحداثيات تقريبية (مركز الولاية) وتُستعمل لوضع دبوس السيارة على الخريطة وللفلتر. */
(function () {
  'use strict';
  var RAW = [
    [1, "أدرار", "Adrar", 27.87, -0.29],
    [2, "الشلف", "Chlef", 36.16, 1.33],
    [3, "الأغواط", "Laghouat", 33.80, 2.86],
    [4, "أم البواقي", "Oum El Bouaghi", 35.88, 7.11],
    [5, "باتنة", "Batna", 35.56, 6.17],
    [6, "بجاية", "Béjaïa", 36.75, 5.06],
    [7, "بسكرة", "Biskra", 34.85, 5.73],
    [8, "بشار", "Béchar", 31.62, -2.22],
    [9, "البليدة", "Blida", 36.47, 2.83],
    [10, "البويرة", "Bouira", 36.37, 3.90],
    [11, "تمنراست", "Tamanrasset", 22.79, 5.52],
    [12, "تبسة", "Tébessa", 35.40, 8.12],
    [13, "تلمسان", "Tlemcen", 34.88, -1.32],
    [14, "تيارت", "Tiaret", 35.37, 1.32],
    [15, "تيزي وزو", "Tizi Ouzou", 36.71, 4.05],
    [16, "الجزائر", "Alger", 36.75, 3.06],
    [17, "الجلفة", "Djelfa", 34.67, 3.26],
    [18, "جيجل", "Jijel", 36.82, 5.77],
    [19, "سطيف", "Sétif", 36.19, 5.41],
    [20, "سعيدة", "Saïda", 34.83, 0.15],
    [21, "سكيكدة", "Skikda", 36.88, 6.91],
    [22, "سيدي بلعباس", "Sidi Bel Abbès", 35.19, -0.63],
    [23, "عنابة", "Annaba", 36.90, 7.77],
    [24, "قالمة", "Guelma", 36.46, 7.43],
    [25, "قسنطينة", "Constantine", 36.37, 6.61],
    [26, "المدية", "Médéa", 36.26, 2.75],
    [27, "مستغانم", "Mostaganem", 35.93, 0.09],
    [28, "المسيلة", "M'Sila", 35.70, 4.54],
    [29, "معسكر", "Mascara", 35.40, 0.14],
    [30, "ورقلة", "Ouargla", 31.95, 5.32],
    [31, "وهران", "Oran", 35.70, -0.63],
    [32, "البيض", "El Bayadh", 33.68, 1.02],
    [33, "إليزي", "Illizi", 26.51, 8.48],
    [34, "برج بوعريريج", "Bordj Bou Arréridj", 36.07, 4.76],
    [35, "بومرداس", "Boumerdès", 36.76, 3.48],
    [36, "الطارف", "El Tarf", 36.77, 8.31],
    [37, "تندوف", "Tindouf", 27.67, -8.15],
    [38, "تيسمسيلت", "Tissemsilt", 35.61, 1.81],
    [39, "الوادي", "El Oued", 33.37, 6.86],
    [40, "خنشلة", "Khenchela", 35.43, 7.14],
    [41, "سوق أهراس", "Souk Ahras", 36.29, 7.95],
    [42, "تيبازة", "Tipaza", 36.59, 2.45],
    [43, "ميلة", "Mila", 36.45, 6.26],
    [44, "عين الدفلى", "Aïn Defla", 36.26, 1.97],
    [45, "النعامة", "Naâma", 33.27, -0.31],
    [46, "عين تموشنت", "Aïn Témouchent", 35.30, -1.14],
    [47, "غرداية", "Ghardaïa", 32.49, 3.67],
    [48, "غليزان", "Relizane", 35.74, 0.56],
    [49, "تيميمون", "Timimoun", 29.26, 0.23],
    [50, "برج باجي مختار", "Bordj Badji Mokhtar", 21.33, 0.95],
    [51, "أولاد جلال", "Ouled Djellal", 34.43, 5.07],
    [52, "بني عباس", "Béni Abbès", 30.13, -2.17],
    [53, "عين صالح", "In Salah", 27.20, 2.48],
    [54, "عين قزام", "In Guezzam", 19.57, 5.77],
    [55, "تقرت", "Touggourt", 33.10, 6.06],
    [56, "جانت", "Djanet", 24.55, 9.48],
    [57, "المغير", "El M'Ghair", 33.95, 5.92],
    [58, "المنيعة", "El Menia", 30.58, 2.88]
  ];
  window.DZ_WILAYAS = RAW.map(function (r) {
    return { code: r[0], ar: r[1], fr: r[2], lat: r[3], lng: r[4] };
  });
})();

// ───────── ثوابت مشتركة (تستعملها app.js و map.js) ─────────
(function () {
  'use strict';
  window.CM_BRANDS = ['Renault', 'Peugeot', 'Dacia', 'Citroën', 'Fiat', 'Volkswagen', 'Hyundai', 'Kia', 'Toyota', 'Suzuki',
    'Chevrolet', 'Seat', 'Skoda', 'Mercedes-Benz', 'BMW', 'Audi', 'Nissan', 'Ford', 'Opel', 'Chery', 'Geely', 'MG', 'Mitsubishi',
    'Mazda', 'Honda', 'Isuzu', 'Jeep', 'Land Rover', 'Volvo', 'Mini', 'Lada', 'DFSK', 'JAC', 'Haval', 'Changan', 'Iveco', 'Autre'];
  window.CM_FUEL = {
    essence:  { ar: 'بنزين',     fr: 'Essence' },
    diesel:   { ar: 'ديزل',      fr: 'Diesel' },
    gpl:      { ar: 'غاز GPL',   fr: 'GPL' },
    hybrid:   { ar: 'هجينة',     fr: 'Hybride' },
    electric: { ar: 'كهربائية',  fr: 'Électrique' }
  };
  window.CM_GEAR = {
    manual: { ar: 'يدوي',      fr: 'Manuelle' },
    auto:   { ar: 'أوتوماتيك', fr: 'Automatique' }
  };
  window.CM_SELLER = {
    individual: { ar: 'فرد',   fr: 'Particulier' },
    dealer:     { ar: 'معرض',  fr: 'Professionnel' }
  };
})();
