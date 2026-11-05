// =============================================================
// Yalancının Mumu - 6 hayvan kovboy (Three.js ile basit şekillerden, çizgi film görünümü)
// Her karakter: gövde, kollar (ellerinde kartlar), kafa (fare/bakışla döner), kovboy şapkası,
// pörtlek gözler (göz kırpar, ölünce X olur). Tepkiler: zıplama, titreme, gülme, bağırma, ölüm.
// Karakter, durduğu yerden masaya (+z yönüne) bakacak şekilde kurulur.
// =============================================================

const Karakterler = (() => {
  const BILGI = {
    horoz:   { ad: 'Şerif Horoz',      emoji: '🐓', aciklama: 'Kasabanın şerifi. Herkesten şüphelenir.' },
    rakun:   { ad: 'Haydut Rakun',     emoji: '🦝', aciklama: 'Yüzü zaten maskeli. Gözünün içine bakarak yalan söyler.' },
    keci:    { ad: 'Yaşlı Keçi',       emoji: '🐐', aciklama: 'Altın arayıcısı. Sakalını sıvazlar, kimseye inanmaz.' },
    kurbaga: { ad: 'Kumarbaz Kurbağa', emoji: '🐸', aciklama: 'Altın dişli, puro tüttürür. Blöfün ustası.' },
    akbaba:  { ad: 'Akbaba',           emoji: '🦅', aciklama: 'Kasabanın cenazecisi. Sabırla bekler…' },
    kunduz:  { ad: 'Barmen Kunduz',    emoji: '🦫', aciklama: 'Saloonun barmeni. Bardak siler, her şeyi duyar.' },
  };
  const TURLER = Object.keys(BILGI);

  // Çizgi film gölgelendirmesi: 3 basamaklı ışık
  let basamak = null;
  function malzeme(renk, ekstra = {}) {
    if (!basamak) {
      basamak = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
      basamak.minFilter = basamak.magFilter = THREE.NearestFilter;
      basamak.needsUpdate = true;
    }
    return new THREE.MeshToonMaterial({ color: renk, gradientMap: basamak, ...ekstra });
  }

  function parca(geo, renk, x = 0, y = 0, z = 0, ust = null, ekstra) {
    const m = new THREE.Mesh(geo, typeof renk === 'object' && renk.isMaterial ? renk : malzeme(renk, ekstra));
    m.position.set(x, y, z);
    m.castShadow = true;
    if (ust) ust.add(m);
    return m;
  }
  const kure = (r, s = 18) => new THREE.SphereGeometry(r, s, Math.round(s * 0.75));
  const silindir = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);

  // Kovboy şapkası (döndürülmüş profil): kenarları kalkık geniş siperlik + ortası çökük tepe
  function sapka(renk, bant, olcek = 1) {
    const p = [[0, 0.19], [0.1, 0.2], [0.135, 0.175], [0.15, 0.02], [0.17, 0.0], [0.27, -0.005], [0.31, 0.03], [0.3, 0.045], [0.26, 0.018], [0.17, 0.022], [0, 0.02]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.Group();
    const s = parca(new THREE.LatheGeometry(p, 28), renk, 0, 0, 0, g, { side: THREE.DoubleSide });
    s.scale.set(1, 1, 1.18);
    const b = parca(silindir(0.153, 0.157, 0.035, 24), bant, 0, 0.045, 0, g);
    b.scale.z = 1.18;
    g.scale.setScalar(olcek);
    return g;
  }

  // Pörtlek göz: beyaz küre + siyah bebek; ölünce X
  function goz(ust, x, y, z, r = 0.062, bebekOlcek = [1, 1, 1]) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    ust.add(g);
    parca(kure(r, 14), '#ffffff', 0, 0, 0, g);
    const bebek = parca(kure(r * 0.5, 10), '#111111', 0, 0, r * 0.62, g);
    bebek.scale.set(...bebekOlcek);
    const parlak = parca(kure(r * 0.16, 6), '#ffffff', r * 0.15, r * 0.18, r * 0.95, g, { emissive: '#ffffff' });
    const x1 = parca(new THREE.BoxGeometry(r * 1.5, r * 0.28, 0.01), '#111111', 0, 0, r * 0.98, g);
    const x2 = x1.clone();
    x1.rotation.z = 0.78;
    x2.rotation.z = -0.78;
    g.add(x2);
    x1.visible = x2.visible = false;
    return { g, bebek, parlak, x: [x1, x2], bebekZ: r * 0.62, r };
  }

  // ---------- Kafalar ----------
  const KAFALAR = {
    horoz(k) {
      parca(kure(0.19), '#f6f2ea', 0, 0, 0, k.kafa).scale.set(1, 1.12, 1);
      const gaga = parca(new THREE.ConeGeometry(0.06, 0.16, 12), '#f2b01e', 0, -0.02, 0.22, k.kafa);
      gaga.rotation.x = Math.PI / 2;
      parca(kure(0.05), '#d8322a', 0, -0.12, 0.17, k.kafa).scale.set(1, 1.6, 1);
      // İbik şapkayı delip çıkmış :)
      [[0, 0.4, 0.02, 0.06], [0, 0.45, -0.05, 0.055], [0, 0.41, -0.11, 0.05]].forEach(([x, y, z, r]) => parca(kure(r), '#e0302a', x, y, z, k.kafa));
      k.gozler = [goz(k.kafa, -0.085, 0.05, 0.14), goz(k.kafa, 0.085, 0.05, 0.14)];
      k.sapka = sapka('#d9b77a', '#6b3a1d');
      k.sapka.position.set(0, 0.15, -0.01);
      k.sapka.rotation.x = -0.12;
    },
    rakun(k) {
      parca(kure(0.19), '#8e8e98', 0, 0, 0, k.kafa).scale.set(1.12, 1, 1);
      parca(kure(0.193), '#1d1d22', 0, 0.05, 0.005, k.kafa).scale.set(1.14, 0.36, 1.03);   // maske
      parca(kure(0.1), '#efefef', 0, -0.07, 0.14, k.kafa).scale.set(1, 0.75, 1.25);
      parca(kure(0.032), '#111111', 0, -0.04, 0.265, k.kafa);
      [-1, 1].forEach(y => {
        const kulak = parca(new THREE.ConeGeometry(0.065, 0.13, 12), '#7a7a84', y * 0.17, 0.17, -0.02, k.kafa);
        kulak.rotation.z = -y * 0.5;
      });
      k.gozler = [goz(k.kafa, -0.085, 0.05, 0.15, 0.058), goz(k.kafa, 0.085, 0.05, 0.15, 0.058)];
      k.sapka = sapka('#2a2522', '#7a1f1f');
      k.sapka.position.set(0, 0.15, -0.02);
    },
    keci(k) {
      parca(kure(0.17), '#ece6d6', 0, 0.02, 0, k.kafa).scale.set(0.95, 1.05, 1.1);
      parca(kure(0.12), '#e3dcc9', 0, -0.07, 0.13, k.kafa).scale.set(0.95, 0.85, 1.2);
      parca(kure(0.028), '#4a3a35', -0.035, -0.04, 0.27, k.kafa);
      parca(kure(0.028), '#4a3a35', 0.035, -0.04, 0.27, k.kafa);
      const sakal = parca(new THREE.ConeGeometry(0.06, 0.2, 10), '#f4efe2', 0, -0.25, 0.13, k.kafa);
      sakal.rotation.x = Math.PI + 0.25;
      k.sakal = sakal;
      [-1, 1].forEach(y => {
        const boynuz = parca(new THREE.TorusGeometry(0.1, 0.024, 8, 14, Math.PI * 0.9), '#8f8578', y * 0.08, 0.22, -0.06, k.kafa);
        boynuz.rotation.set(0, Math.PI / 2, -0.4 * y);
        const kulak = parca(kure(0.06), '#ddd5c0', y * 0.2, 0.04, -0.02, k.kafa);
        kulak.scale.set(1.8, 0.5, 0.9);
      });
      // Keçi gözü: yatay bebek
      k.gozler = [goz(k.kafa, -0.085, 0.07, 0.12, 0.06, [1.7, 0.45, 1]), goz(k.kafa, 0.085, 0.07, 0.12, 0.06, [1.7, 0.45, 1])];
      k.sapka = sapka('#c9a25a', '#5a3c1a', 0.95);
      k.sapka.position.set(0, 0.16, -0.02);
      k.sapka.rotation.z = 0.12;
    },
    kurbaga(k) {
      parca(kure(0.19), '#5fae3b', 0, -0.02, 0, k.kafa).scale.set(1.35, 0.75, 1.1);
      parca(kure(0.185), '#cfe6a0', 0, -0.07, 0.02, k.kafa).scale.set(1.25, 0.5, 1.08);
      const agiz = parca(new THREE.TorusGeometry(0.2, 0.012, 6, 24, Math.PI), '#2b4a1a', 0, -0.05, 0, k.kafa);
      agiz.rotation.x = Math.PI / 2;
      agiz.scale.set(1.3, 1.07, 1);
      parca(new THREE.BoxGeometry(0.04, 0.045, 0.02), '#f7c831', 0.06, -0.075, 0.2, k.kafa, { emissive: '#5a4300' });
      // Puro: ucu kor
      const puro = parca(silindir(0.016, 0.018, 0.17, 8), '#6b3f1f', -0.15, -0.07, 0.24, k.kafa);
      puro.rotation.set(Math.PI / 2, 0, 0.5);
      k.puroUcu = parca(kure(0.019, 8), '#ff6a1a', -0.19, -0.07, 0.31, k.kafa, { emissive: '#ff4400' });
      [-1, 1].forEach(y => parca(kure(0.075), '#5fae3b', y * 0.12, 0.1, 0.06, k.kafa));
      k.gozler = [goz(k.kafa, -0.12, 0.13, 0.1, 0.07), goz(k.kafa, 0.12, 0.13, 0.1, 0.07)];
      k.sapka = sapka('#1f1b1a', '#b0242b', 0.85);
      k.sapka.position.set(0, 0.17, -0.05);
      k.sapka.rotation.x = -0.25;
    },
    akbaba(k) {
      // Uzun çıplak boyun
      const boyun = parca(silindir(0.045, 0.06, 0.3, 10), '#e9a3a0', 0, -0.2, -0.02, k.kafa);
      boyun.rotation.x = 0.25;
      parca(new THREE.TorusGeometry(0.13, 0.075, 10, 18), '#1b1b1f', 0, -0.32, -0.04, k.kafa).rotation.x = Math.PI / 2;
      parca(kure(0.14), '#eca6a2', 0, 0.02, 0.02, k.kafa).scale.set(0.9, 1, 1.1);
      const gaga = parca(new THREE.ConeGeometry(0.05, 0.19, 10), '#b9b3a3', 0, -0.03, 0.2, k.kafa);
      gaga.rotation.x = Math.PI / 2 + 0.45;
      parca(kure(0.022), '#3a332b', 0, -0.1, 0.27, k.kafa);
      k.gozler = [goz(k.kafa, -0.065, 0.06, 0.1, 0.05), goz(k.kafa, 0.065, 0.06, 0.1, 0.05)];
      k.sapka = sapka('#151515', '#3b3b3b', 0.9);
      k.sapka.position.set(0, 0.12, -0.01);
      k.kafaYukseklik = 0.12;
    },
    kunduz(k) {
      parca(kure(0.2), '#8a5a2b', 0, 0, 0, k.kafa).scale.set(1.05, 0.95, 1);
      parca(kure(0.11), '#b88a5a', 0, -0.06, 0.14, k.kafa).scale.set(1.15, 0.85, 1.1);
      parca(kure(0.038), '#2a1a12', 0, -0.01, 0.255, k.kafa).scale.set(1.3, 0.9, 1);
      [-1, 1].forEach(y => {
        parca(new THREE.BoxGeometry(0.038, 0.07, 0.018), '#fffbea', y * 0.021, -0.15, 0.22, k.kafa);
        parca(kure(0.045), '#6a4220', y * 0.15, 0.15, -0.02, k.kafa);
      });
      k.gozler = [goz(k.kafa, -0.08, 0.06, 0.15, 0.055), goz(k.kafa, 0.08, 0.06, 0.15, 0.055)];
      k.sapka = sapka('#7a4b24', '#2a1a10', 0.95);
      k.sapka.position.set(0, 0.16, -0.01);
      k.sapka.rotation.z = -0.08;
    },
  };

  // ---------- Kıyafetler (gövde rengi, ten/el rengi, aksesuar) ----------
  const KIYAFET = {
    horoz:   { govde: '#b8452a', yelek: '#6b4423', el: '#f6f2ea', ek: k => yildiz(k) },
    rakun:   { govde: '#3f5a3a', yelek: '#2b2b2b', el: '#5c5c66', ek: k => bandana(k, '#b0242b') },
    keci:    { govde: '#d9cfae', yelek: '#3b5f8a', el: '#ece6d6', ek: () => {} },
    kurbaga: { govde: '#efe7d2', yelek: '#5b2f7a', el: '#5fae3b', ek: k => papyon(k, '#c7a33a') },
    akbaba:  { govde: '#f2f2f2', yelek: '#1d1d22', el: '#3a3a40', ek: () => {} },
    kunduz:  { govde: '#f3efe6', yelek: '#8a2b2b', el: '#8a5a2b', ek: k => { onluk(k); papyon(k, '#b0242b'); } },
  };

  function yildiz(k) {
    const s = new THREE.Shape();
    for (let i = 0; i < 12; i++) {
      const r = i % 2 ? 0.026 : 0.06, a = (i / 12) * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const y = parca(new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }), '#f2c53d', -0.13, 1.13, 0.22, k.govde, { emissive: '#3a2a00' });
    y.rotation.y = -0.35;
  }
  function bandana(k, renk) {
    const b = parca(new THREE.ConeGeometry(0.17, 0.2, 14, 1, true), renk, 0, 1.24, 0.07, k.govde, { side: THREE.DoubleSide });
    b.rotation.x = Math.PI + 0.35;
  }
  function papyon(k, renk) {
    [-1, 1].forEach(y => {
      const p = parca(new THREE.ConeGeometry(0.035, 0.07, 8), renk, y * 0.035, 1.28, 0.2, k.govde);
      p.rotation.z = (y * Math.PI) / 2;
    });
  }
  function onluk(k) {
    parca(new THREE.BoxGeometry(0.4, 0.42, 0.02), '#fafafa', 0, 0.92, 0.27, k.govde);
  }

  // ---------- Karakteri kur ----------
  function yap(tur) {
    if (!BILGI[tur]) tur = 'horoz';
    const kok = new THREE.Group();
    const k = { tur, kok, gozler: [], yaw: 0, pitch: 0, hedefYaw: 0, hedefPitch: 0, kirp: 0, sonrakiKirp: 1 + Math.random() * 3,
      tepki: null, olu: false, oluOran: 0, faz: Math.random() * 10, kafaYukseklik: 0, kartSayisi: 0 };
    const kiy = KIYAFET[tur];

    // Sandalye (karakterin arkasında)
    const tahta = malzeme('#5a3417');
    parca(new THREE.BoxGeometry(0.6, 0.06, 0.55), tahta, 0, 0.58, -0.05, kok);
    parca(new THREE.BoxGeometry(0.6, 0.75, 0.06), tahta, 0, 0.98, -0.33, kok).rotation.x = -0.08;
    [[-0.26, -0.28], [0.26, -0.28], [-0.26, 0.18], [0.26, 0.18]].forEach(([x, z]) => parca(silindir(0.03, 0.03, 0.58, 8), tahta, x, 0.29, z, kok));

    // Gövde
    k.govde = new THREE.Group();
    kok.add(k.govde);
    parca(silindir(0.22, 0.29, 0.62, 18), kiy.govde, 0, 0.93, 0.02, k.govde);
    // Yelek (gövdenin önünde açık iki kanat)
    [-1, 1].forEach(y => {
      const kanat = parca(new THREE.CylinderGeometry(0.235, 0.3, 0.6, 18, 1, true, y > 0 ? 0.15 : Math.PI * 2 - 1.75, 1.6), kiy.yelek, 0, 0.93, 0.02, k.govde, { side: THREE.DoubleSide });
      kanat.scale.set(1.03, 1, 1.03);
    });
    parca(silindir(0.3, 0.3, 0.32, 18), kiy.yelek, 0, 0.42 + 0.33, 0.02, k.govde).scale.set(1, 0.5, 1);
    parca(kure(0.25), kiy.govde, 0, 1.2, 0.02, k.govde).scale.set(1.15, 0.45, 0.85);
    // Bacaklar (masanın altında, öne uzanır)
    [-1, 1].forEach(y => {
      const b = parca(new THREE.CapsuleGeometry(0.08, 0.38, 4, 10), '#3d2b1f', y * 0.12, 0.64, 0.25, kok);
      b.rotation.x = Math.PI / 2;
      parca(new THREE.CapsuleGeometry(0.075, 0.35, 4, 10), '#3d2b1f', y * 0.12, 0.38, 0.45, kok);
      parca(new THREE.BoxGeometry(0.13, 0.09, 0.24), '#4a2a14', y * 0.12, 0.13, 0.52, kok);   // çizme
    });

    // Kollar: omuzdan masadaki ele
    k.kollar = [-1, 1].map(y => {
      const omuz = new THREE.Group();
      omuz.position.set(y * 0.28, 1.17, 0.02);
      k.govde.add(omuz);
      const kol = parca(new THREE.CapsuleGeometry(0.065, 0.42, 4, 10), kiy.govde, 0, 0, 0.27, omuz);
      kol.rotation.x = Math.PI / 2;
      const el = parca(kure(0.068, 12), kiy.el, 0, 0, 0.52, omuz);
      omuz.rotation.set(0.55, -y * 0.42, 0);
      return { omuz, el, y };
    });

    // Elde tutulan kartlar (sırtları dışarı dönük yelpaze)
    k.elKartlari = new THREE.Group();
    k.elKartlari.position.set(0, 1.0, 0.43);
    k.elKartlari.rotation.x = -0.35;
    k.govde.add(k.elKartlari);

    // Kafa
    k.kafa = new THREE.Group();
    k.govde.add(k.kafa);
    KAFALAR[tur](k);
    k.kafa.position.set(0, 1.5 + k.kafaYukseklik, 0.04);
    k.kafa.add(k.sapka);
    kiy.ek(k);
    kok.traverse(m => m.isMesh && (m.receiveShadow = true));
    return k;
  }

  // Elinde kaç kart var (kart sırtı dokusu Sahne'den gelir)
  function kartlariAyarla(k, adet, sirtMalzeme) {
    if (k.kartSayisi === adet) return;
    k.kartSayisi = adet;
    while (k.elKartlari.children.length) k.elKartlari.remove(k.elKartlari.children[0]);
    for (let i = 0; i < adet; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.004), sirtMalzeme);
      const a = (i - (adet - 1) / 2) * 0.22;
      m.position.set(Math.sin(a) * 0.12, Math.cos(a) * 0.12 - 0.08, -i * 0.006);
      m.rotation.z = -a;
      m.castShadow = true;
      k.elKartlari.add(m);
    }
  }

  // Tepki başlat: 'zipla' | 'titre' | 'gul' | 'bagir' | 'rahat' | 'dusun'
  function tepki(k, tur, sure = 1.4) {
    if (k.olu) return;
    k.tepki = { tur, t: 0, sure };
  }

  function oldur(k) {
    k.olu = true;
    k.tepki = null;
    k.gozler.forEach(g => {
      g.bebek.visible = g.parlak.visible = false;
      g.x.forEach(x => (x.visible = true));
      g.g.scale.y = 1;
    });
    k.elKartlari.visible = false;
  }

  function dirilt(k) {
    k.olu = false;
    k.oluOran = 0;
    k.gozler.forEach(g => {
      g.bebek.visible = g.parlak.visible = true;
      g.x.forEach(x => (x.visible = false));
    });
    k.elKartlari.visible = true;
  }

  // Her karede çağrılır: nefes, göz kırpma, bakış, tepkiler
  function guncelle(k, t, dt) {
    const f = t + k.faz;
    k.oluOran = Math.min(1, Math.max(0, k.oluOran + (k.olu ? dt * 1.6 : -dt * 2)));
    const o = k.oluOran;
    // Bakış (yumuşak geçiş)
    const hiz = 1 - Math.exp(-dt * 6);
    k.yaw += (k.hedefYaw + Math.sin(f * 0.7) * 0.05 - k.yaw) * hiz;
    k.pitch += (k.hedefPitch + Math.sin(f * 0.9) * 0.03 - k.pitch) * hiz;
    let kx = k.pitch, ky = k.yaw, kz = Math.sin(f * 0.5) * 0.04, govY = 0, govX = 0, govZ = 0;
    let solKol = 0, sagKol = 0;
    k.govde.scale.y = 1 + Math.sin(f * 2.2) * 0.012;

    if (k.tepki) {
      const tp = k.tepki;
      tp.t += dt;
      const p = tp.t / tp.sure;
      if (p >= 1) k.tepki = null;
      else {
        const zarf = Math.sin(Math.PI * Math.min(1, p * 1.2));
        if (tp.tur === 'zipla') {
          govY = Math.abs(Math.sin(tp.t * 14)) * 0.12 * (1 - p);
          kx -= 0.25 * zarf;
          solKol = sagKol = -0.7 * zarf;
        } else if (tp.tur === 'titre') {
          kz += Math.sin(tp.t * 70) * 0.05;
          ky += Math.sin(tp.t * 55) * 0.04;
          govX = Math.sin(tp.t * 60) * 0.015;
          kx += 0.12;
        } else if (tp.tur === 'gul') {
          kx += -0.25 + Math.abs(Math.sin(tp.t * 18)) * 0.3 * zarf;
          govY = Math.abs(Math.sin(tp.t * 18)) * 0.03;
        } else if (tp.tur === 'bagir') {
          kx += 0.2 * zarf;
          govZ = 0.12 * zarf;
          sagKol = -1.1 * zarf;
        } else if (tp.tur === 'rahat') {
          kx -= 0.45 * zarf;
          govY = -0.04 * zarf;
        } else if (tp.tur === 'dusun') {
          kz += Math.sin(tp.t * 3) * 0.12;
          solKol = -0.5 * zarf;
        }
      }
    }

    // Ölüm: gövde masaya kapanır, kafa yana düşer
    kx = kx * (1 - o) + 0.9 * o;
    kz = kz * (1 - o) + 0.5 * o;
    k.govde.rotation.set(govX + 0.55 * o, 0, 0.1 * o);
    k.govde.position.set(0, govY - 0.05 * o, govZ + 0.08 * o);
    k.kafa.rotation.set(kx, ky * (1 - o), kz, 'YXZ');
    k.kollar.forEach(kol => {
      const ek = kol.y < 0 ? solKol : sagKol;
      kol.omuz.rotation.x = 0.55 + ek + Math.sin(f * 1.3 + kol.y) * 0.02 - 0.3 * o;
    });

    // Gözler: bebekler bakış yönünde biraz kayar, ara sıra kırpılır
    k.sonrakiKirp -= dt;
    if (k.sonrakiKirp < 0) {
      k.kirp = 0.14;
      k.sonrakiKirp = 1.5 + Math.random() * 3.5;
    }
    const kirpiyor = k.kirp > 0 && !k.olu;
    k.kirp -= dt;
    const gozKorku = k.tepki?.tur === 'titre' || k.tepki?.tur === 'zipla';
    k.gozler.forEach(g => {
      g.g.scale.y = kirpiyor ? 0.12 : 1;
      g.g.scale.x = g.g.scale.z = gozKorku ? 1.25 : 1;
      g.bebek.position.x = Math.max(-0.4, Math.min(0.4, (k.hedefYaw - k.yaw) * -0.5)) * g.r;
    });
    if (k.puroUcu) k.puroUcu.material.emissiveIntensity = 0.6 + Math.sin(f * 3) * 0.4;
    if (k.sakal) k.sakal.rotation.z = Math.sin(f * 1.7) * 0.06;
  }

  return { BILGI, TURLER, yap, guncelle, tepki, oldur, dirilt, kartlariAyarla, malzeme };
})();
