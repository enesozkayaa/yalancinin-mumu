// =============================================================
// Yalancının Mumu - 6 hayvan kovboy (Three.js ile şekillerden)
// Tüy / kumaş / deri dokuları, göz kapakları ve kaşlarla yüz ifadeleri (kızgın, korkmuş, şüpheli,
// mutlu), konuşurken açılıp kapanan ağız/gaga. Oturan (oyuncu) ya da ayakta yürüyen (saloondaki
// gezginler) olarak kurulabilir. Karakter +z yönüne bakacak şekilde kurulur.
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

  // ---------- Dokular (renk başına bir kez çizilir) ----------
  const dokuOnbellek = {};
  function kanvasDoku(anahtar, ciz, boyut = 128, tekrar = 1) {
    if (!dokuOnbellek[anahtar]) {
      const c = document.createElement('canvas');
      c.width = c.height = boyut;
      ciz(c.getContext('2d'), boyut);
      const d = new THREE.CanvasTexture(c);
      d.colorSpace = THREE.SRGBColorSpace;
      d.wrapS = d.wrapT = THREE.RepeatWrapping;
      d.repeat.set(tekrar, tekrar);
      dokuOnbellek[anahtar] = d;
    }
    return dokuOnbellek[anahtar];
  }
  const tonla = (renk, oran) => {
    const c = new THREE.Color(renk);
    return `#${c.offsetHSL(0, 0, oran).getHexString()}`;
  };
  // Tüy: kısa, rastgele yönlü açık-koyu çizgiler
  const kurk = renk => kanvasDoku('kurk' + renk, (g, b) => {
    g.fillStyle = renk;
    g.fillRect(0, 0, b, b);
    for (let i = 0; i < 1400; i++) {
      g.strokeStyle = tonla(renk, (Math.random() - 0.5) * 0.16);
      g.globalAlpha = 0.5;
      g.lineWidth = 1;
      const x = Math.random() * b, y = Math.random() * b, a = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      g.stroke();
    }
  }, 128, 2);
  // Kumaş: ince örgü
  const kumas = renk => kanvasDoku('kumas' + renk, (g, b) => {
    g.fillStyle = renk;
    g.fillRect(0, 0, b, b);
    g.globalAlpha = 0.07;
    for (let i = 0; i < b; i += 2) {
      g.fillStyle = i % 4 ? '#000' : '#fff';
      g.fillRect(i, 0, 1, b);
      g.fillRect(0, i, b, 1);
    }
    g.globalAlpha = 0.05;
    for (let i = 0; i < 300; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
      g.fillRect(Math.random() * b, Math.random() * b, 1, 1);
    }
  }, 128, 6);
  // Deri / keçe (şapka, çizme)
  const deri = renk => kanvasDoku('deri' + renk, (g, b) => {
    g.fillStyle = renk;
    g.fillRect(0, 0, b, b);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = tonla(renk, (Math.random() - 0.5) * 0.1);
      g.globalAlpha = 0.6;
      g.fillRect(Math.random() * b, Math.random() * b, 2, 2);
    }
  }, 128, 3);

  const malzemeOnbellek = {};
  function malzeme(renk, tur = 'duz', ekstra = {}) {
    const anahtar = renk + tur + JSON.stringify(ekstra);
    if (!malzemeOnbellek[anahtar] || Object.keys(ekstra).length) {
      const doku = tur === 'kurk' ? kurk(renk) : tur === 'kumas' ? kumas(renk) : tur === 'deri' ? deri(renk) : null;
      const m = new THREE.MeshStandardMaterial({
        color: doku ? '#ffffff' : renk, map: doku, bumpMap: doku, bumpScale: doku ? 0.6 : 0,
        roughness: tur === 'deri' ? 0.65 : tur === 'parlak' ? 0.25 : 0.88, metalness: tur === 'metal' ? 0.8 : 0, ...ekstra,
      });
      if (Object.keys(ekstra).length) return m;
      malzemeOnbellek[anahtar] = m;
    }
    return malzemeOnbellek[anahtar];
  }

  function parca(geo, mal, x = 0, y = 0, z = 0, ust = null) {
    const m = new THREE.Mesh(geo, mal);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (ust) ust.add(m);
    return m;
  }
  const kure = (r, s = 22) => new THREE.SphereGeometry(r, s, Math.round(s * 0.75));
  const silindir = (r1, r2, h, s = 18) => new THREE.CylinderGeometry(r1, r2, h, s);

  // Kovboy şapkası: kenarları kalkık siperlik + ortası çökük tepe, deri/keçe dokulu
  function sapka(renk, bant, olcek = 1) {
    const p = [[0, 0.17], [0.05, 0.19], [0.11, 0.2], [0.14, 0.17], [0.152, 0.02], [0.17, 0.0], [0.27, -0.006], [0.31, 0.03], [0.305, 0.045], [0.26, 0.018], [0.17, 0.022], [0, 0.02]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.Group();
    const s = parca(new THREE.LatheGeometry(p, 32), malzeme(renk, 'deri', { side: THREE.DoubleSide }), 0, 0, 0, g);
    s.scale.set(1, 1, 1.18);
    // Tepedeki çukur (ön-arka boyunca)
    const cukur = parca(new THREE.CylinderGeometry(0.02, 0.06, 0.03, 12), malzeme(tonla(renk, -0.08), 'deri'), 0, 0.195, 0, g);
    cukur.scale.set(1, 1, 2);
    const b = parca(silindir(0.155, 0.159, 0.035, 28), malzeme(bant, 'deri'), 0, 0.045, 0, g);
    b.scale.z = 1.18;
    g.scale.setScalar(olcek);
    return g;
  }

  // Göz: göz akı, renkli iris, bebek, parıltı; üst göz kapağı (kırpma ve ifade) ve kaş.
  function goz(k, x, y, z, r, irisRenk, kapakMal, kasRenk, yatayBebek) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    k.kafa.add(g);
    parca(kure(r, 18), malzeme('#f4f1e8', 'parlak'), 0, 0, 0, g);
    const iris = parca(kure(r * 0.55, 16), malzeme(irisRenk, 'parlak'), 0, 0, r * 0.62, g);
    iris.scale.set(1, 1, 0.45);
    const bebek = parca(kure(r * 0.3, 12), malzeme('#0a0a0a', 'parlak'), 0, 0, r * 0.82, g);
    bebek.scale.set(yatayBebek ? 1.9 : 1, yatayBebek ? 0.45 : 1, 0.4);
    const parlak = parca(kure(r * 0.1, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), r * 0.18, r * 0.2, r * 0.95, g);
    // Üst kapak: göz kürenin üst yarısı, öne dönünce gözü kapatır
    const kapak = parca(new THREE.SphereGeometry(r * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), kapakMal, 0, 0, 0, g);
    kapak.rotation.x = -0.55;
    // Kaş
    const kas = parca(new THREE.BoxGeometry(r * 1.5, r * 0.28, r * 0.35), malzeme(kasRenk, 'kurk'), 0, r * 1.35, r * 0.55, g);
    // Ölünce X
    const xm = malzeme('#111111');
    const x1 = parca(new THREE.BoxGeometry(r * 1.5, r * 0.25, 0.01), xm, 0, 0, r * 1.02, g);
    const x2 = parca(new THREE.BoxGeometry(r * 1.5, r * 0.25, 0.01), xm, 0, 0, r * 1.02, g);
    x1.rotation.z = 0.78;
    x2.rotation.z = -0.78;
    x1.visible = x2.visible = false;
    return { g, iris, bebek, parlak, kapak, kas, x: [x1, x2], r, sol: x < 0 };
  }

  // Ağız: koyu iç kısım; konuşunca dikeyde açılır. Gagalılarda alt gaga menteşeden aşağı iner.
  function agiz(k, x, y, z, gen, yuk, ust = k.kafa) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    ust.add(g);
    const ic = parca(kure(1, 14), malzeme('#2a0d0d'), 0, 0, 0, g);
    ic.scale.set(gen, yuk, yuk * 0.8);
    const dil = parca(kure(1, 10), malzeme('#c25a5a'), 0, -yuk * 0.4, yuk * 0.1, g);
    dil.scale.set(gen * 0.6, yuk * 0.35, yuk * 0.5);
    k.agiz = { g, ic, yuk };
    g.scale.y = 0.12;
  }

  // ---------- Kafalar ----------
  const KAFALAR = {
    horoz(k) {
      const ten = malzeme('#f3eee4', 'kurk');
      parca(kure(0.19), ten, 0, 0, 0, k.kafa).scale.set(1, 1.12, 1);
      const gagaMal = malzeme('#e9a51a', 'parlak');
      const ustGaga = parca(new THREE.ConeGeometry(0.06, 0.15, 14), gagaMal, 0, -0.005, 0.22, k.kafa);
      ustGaga.rotation.x = Math.PI / 2 + 0.12;
      ustGaga.scale.set(1, 1, 0.55);
      k.altGaga = new THREE.Group();
      k.altGaga.position.set(0, -0.035, 0.16);
      k.kafa.add(k.altGaga);
      const alt = parca(new THREE.ConeGeometry(0.045, 0.11, 12), gagaMal, 0, 0, 0.05, k.altGaga);
      alt.rotation.x = Math.PI / 2 - 0.1;
      alt.scale.set(1, 1, 0.45);
      parca(kure(0.045), malzeme('#c8261f'), 0, -0.13, 0.15, k.kafa).scale.set(1, 1.7, 0.8);
      [[0, 0.4, 0.03, 0.06], [0, 0.45, -0.04, 0.058], [0, 0.42, -0.11, 0.05]].forEach(([x, y, z, r]) => {
        parca(kure(r), malzeme('#d62a22'), x, y, z, k.kafa).scale.set(0.55, 1, 1);
      });
      const kapak = malzeme('#f3eee4', 'kurk');
      k.gozler = [goz(k, -0.09, 0.05, 0.13, 0.05, '#c8820a', kapak, '#b8b0a0'), goz(k, 0.09, 0.05, 0.13, 0.05, '#c8820a', kapak, '#b8b0a0')];
      k.sapka = sapka('#cfae74', '#5b3018');
      k.sapka.position.set(0, 0.15, -0.01);
      k.sapka.rotation.x = -0.12;
    },
    rakun(k) {
      const ten = malzeme('#8b8b94', 'kurk');
      parca(kure(0.19), ten, 0, 0, 0, k.kafa).scale.set(1.12, 1, 1);
      parca(kure(0.193), malzeme('#24242a', 'kurk'), 0, 0.045, 0.006, k.kafa).scale.set(1.14, 0.36, 1.03);
      parca(kure(0.1), malzeme('#ececec', 'kurk'), 0, -0.07, 0.14, k.kafa).scale.set(1, 0.75, 1.25);
      parca(kure(0.032), malzeme('#111111', 'parlak'), 0, -0.035, 0.265, k.kafa).scale.set(1.3, 1, 1);
      [-1, 1].forEach(y => {
        const kulak = parca(new THREE.ConeGeometry(0.065, 0.13, 14), ten, y * 0.17, 0.17, -0.02, k.kafa);
        kulak.rotation.z = -y * 0.5;
        parca(new THREE.ConeGeometry(0.04, 0.08, 10), malzeme('#2a2a2e'), y * 0.168, 0.168, 0.005, k.kafa).rotation.z = -y * 0.5;
      });
      agiz(k, 0, -0.115, 0.205, 0.045, 0.03);
      const kapak = malzeme('#24242a', 'kurk');
      k.gozler = [goz(k, -0.085, 0.05, 0.15, 0.048, '#3a2a18', kapak, '#e8e8e8'), goz(k, 0.085, 0.05, 0.15, 0.048, '#3a2a18', kapak, '#e8e8e8')];
      k.sapka = sapka('#2a2522', '#7a1f1f');
      k.sapka.position.set(0, 0.15, -0.02);
    },
    keci(k) {
      const ten = malzeme('#e9e2d0', 'kurk');
      parca(kure(0.17), ten, 0, 0.02, 0, k.kafa).scale.set(0.95, 1.05, 1.1);
      parca(kure(0.12), malzeme('#ddd5c0', 'kurk'), 0, -0.07, 0.13, k.kafa).scale.set(0.95, 0.85, 1.2);
      parca(kure(0.026), malzeme('#4a3a35', 'parlak'), -0.035, -0.04, 0.27, k.kafa);
      parca(kure(0.026), malzeme('#4a3a35', 'parlak'), 0.035, -0.04, 0.27, k.kafa);
      agiz(k, 0, -0.13, 0.215, 0.05, 0.028);
      const sakal = parca(new THREE.ConeGeometry(0.065, 0.22, 12), malzeme('#f4efe2', 'kurk'), 0, -0.26, 0.13, k.kafa);
      sakal.rotation.x = Math.PI + 0.25;
      k.sakal = sakal;
      [-1, 1].forEach(y => {
        const boynuz = parca(new THREE.TorusGeometry(0.1, 0.024, 10, 18, Math.PI * 0.9), malzeme('#8a7f70', 'deri'), y * 0.08, 0.22, -0.06, k.kafa);
        boynuz.rotation.set(0, Math.PI / 2, -0.4 * y);
        const kulak = parca(kure(0.06), ten, y * 0.2, 0.04, -0.02, k.kafa);
        kulak.scale.set(1.8, 0.5, 0.9);
      });
      k.gozler = [goz(k, -0.085, 0.07, 0.12, 0.05, '#c9a227', ten, '#cfc6b0', true), goz(k, 0.085, 0.07, 0.12, 0.05, '#c9a227', ten, '#cfc6b0', true)];
      k.sapka = sapka('#c9a25a', '#5a3c1a', 0.95);
      k.sapka.position.set(0, 0.16, -0.02);
      k.sapka.rotation.z = 0.12;
    },
    kurbaga(k) {
      const ten = malzeme('#5c9e3a', 'kurk');
      parca(kure(0.19), ten, 0, -0.02, 0, k.kafa).scale.set(1.35, 0.75, 1.1);
      parca(kure(0.185), malzeme('#cfe2a0', 'kurk'), 0, -0.07, 0.02, k.kafa).scale.set(1.25, 0.5, 1.08);
      // Geniş ağız çizgisi + konuşunca açılan ağız
      const cizgi = parca(new THREE.TorusGeometry(0.2, 0.01, 6, 24, Math.PI), malzeme('#2b4a1a'), 0, -0.05, 0, k.kafa);
      cizgi.rotation.x = Math.PI / 2;
      cizgi.scale.set(1.3, 1.07, 1);
      agiz(k, 0, -0.07, 0.19, 0.11, 0.035);
      parca(new THREE.BoxGeometry(0.035, 0.04, 0.02), malzeme('#f7c831', 'metal', { emissive: '#4a3600' }), 0.06, -0.06, 0.205, k.kafa);
      const puro = parca(silindir(0.016, 0.018, 0.17, 10), malzeme('#6b3f1f', 'deri'), -0.15, -0.06, 0.24, k.kafa);
      puro.rotation.set(Math.PI / 2, 0, 0.5);
      k.puroUcu = parca(kure(0.019, 8), malzeme('#ff6a1a', 'duz', { emissive: '#ff4400' }), -0.19, -0.06, 0.31, k.kafa);
      [-1, 1].forEach(y => parca(kure(0.078), ten, y * 0.12, 0.1, 0.06, k.kafa));
      k.gozler = [goz(k, -0.12, 0.13, 0.11, 0.06, '#d4a514', ten, '#4a7a2a'), goz(k, 0.12, 0.13, 0.11, 0.06, '#d4a514', ten, '#4a7a2a')];
      k.sapka = sapka('#1f1b1a', '#b0242b', 0.85);
      k.sapka.position.set(0, 0.17, -0.05);
      k.sapka.rotation.x = -0.25;
    },
    akbaba(k) {
      const ten = malzeme('#e3a09b', 'kurk');
      const boyun = parca(silindir(0.045, 0.06, 0.3, 12), ten, 0, -0.2, -0.02, k.kafa);
      boyun.rotation.x = 0.25;
      const yaka = parca(new THREE.TorusGeometry(0.13, 0.078, 12, 22), malzeme('#1b1b1f', 'kurk'), 0, -0.32, -0.04, k.kafa);
      yaka.rotation.x = Math.PI / 2;
      parca(kure(0.14), ten, 0, 0.02, 0.02, k.kafa).scale.set(0.9, 1, 1.1);
      const gagaMal = malzeme('#b6ae9c', 'parlak');
      const ust = parca(new THREE.ConeGeometry(0.05, 0.19, 12), gagaMal, 0, -0.02, 0.2, k.kafa);
      ust.rotation.x = Math.PI / 2 + 0.45;
      parca(kure(0.022), malzeme('#3a332b'), 0, -0.1, 0.27, k.kafa);
      k.altGaga = new THREE.Group();
      k.altGaga.position.set(0, -0.06, 0.12);
      k.kafa.add(k.altGaga);
      parca(new THREE.ConeGeometry(0.035, 0.12, 10), gagaMal, 0, 0, 0.05, k.altGaga).rotation.x = Math.PI / 2 - 0.2;
      k.gozler = [goz(k, -0.065, 0.06, 0.1, 0.042, '#7a1a12', ten, '#5a2a26'), goz(k, 0.065, 0.06, 0.1, 0.042, '#7a1a12', ten, '#5a2a26')];
      k.sapka = sapka('#151515', '#3b3b3b', 0.9);
      k.sapka.position.set(0, 0.12, -0.01);
      k.kafaYukseklik = 0.12;
    },
    kunduz(k) {
      const ten = malzeme('#86562a', 'kurk');
      parca(kure(0.2), ten, 0, 0, 0, k.kafa).scale.set(1.05, 0.95, 1);
      parca(kure(0.11), malzeme('#b48654', 'kurk'), 0, -0.06, 0.14, k.kafa).scale.set(1.15, 0.85, 1.1);
      parca(kure(0.038), malzeme('#2a1a12', 'parlak'), 0, -0.01, 0.255, k.kafa).scale.set(1.3, 0.9, 1);
      agiz(k, 0, -0.165, 0.19, 0.05, 0.03);
      [-1, 1].forEach(y => {
        parca(new THREE.BoxGeometry(0.038, 0.07, 0.018), malzeme('#fff6d8', 'parlak'), y * 0.021, -0.14, 0.22, k.kafa);
        parca(kure(0.045), malzeme('#6a4220', 'kurk'), y * 0.15, 0.15, -0.02, k.kafa);
      });
      k.gozler = [goz(k, -0.08, 0.06, 0.15, 0.046, '#2a1a0e', ten, '#4a2a12'), goz(k, 0.08, 0.06, 0.15, 0.046, '#2a1a0e', ten, '#4a2a12')];
      k.sapka = sapka('#7a4b24', '#2a1a10', 0.95);
      k.sapka.position.set(0, 0.16, -0.01);
      k.sapka.rotation.z = -0.08;
    },
  };

  // ---------- Kıyafetler ----------
  const KIYAFET = {
    horoz:   { gomlek: '#a83a24', yelek: '#5e3a1e', el: '#f3eee4', pantolon: '#3d3328', ek: k => yildiz(k) },
    rakun:   { gomlek: '#3f5a3a', yelek: '#2b2b2b', el: '#5c5c66', pantolon: '#2e2a26', ek: k => bandana(k, '#a3201b') },
    keci:    { gomlek: '#d4c9a6', yelek: '#3b5f8a', el: '#e9e2d0', pantolon: '#3b5f8a', ek: k => askilar(k) },
    kurbaga: { gomlek: '#efe7d2', yelek: '#5b2f7a', el: '#5c9e3a', pantolon: '#2a2030', ek: k => { papyon(k, '#c7a33a'); saatKosteği(k); } },
    akbaba:  { gomlek: '#f0f0f0', yelek: '#1d1d22', el: '#3a3a40', pantolon: '#1d1d22', ek: k => papyon(k, '#111') },
    kunduz:  { gomlek: '#efe9dc', yelek: '#7a2626', el: '#86562a', pantolon: '#3a2a1e', ek: k => { onluk(k); papyon(k, '#a3201b'); } },
  };

  function yildiz(k) {
    const s = new THREE.Shape();
    for (let i = 0; i < 12; i++) {
      const r = i % 2 ? 0.026 : 0.06, a = (i / 12) * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const y = parca(new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }),
      malzeme('#e8bd3a', 'metal', { roughness: 0.3 }), -0.13, 1.13, 0.215, k.govde);
    y.rotation.y = -0.35;
  }
  function bandana(k, renk) {
    const b = parca(new THREE.ConeGeometry(0.17, 0.2, 16, 1, true), malzeme(renk, 'kumas', { side: THREE.DoubleSide }), 0, 1.24, 0.07, k.govde);
    b.rotation.x = Math.PI + 0.35;
  }
  function papyon(k, renk) {
    [-1, 1].forEach(y => {
      const p = parca(new THREE.ConeGeometry(0.035, 0.07, 10), malzeme(renk, 'kumas'), y * 0.035, 1.28, 0.2, k.govde);
      p.rotation.z = (y * Math.PI) / 2;
    });
    parca(kure(0.016), malzeme(renk, 'kumas'), 0, 1.28, 0.205, k.govde);
  }
  function onluk(k) {
    parca(new THREE.BoxGeometry(0.4, 0.42, 0.02), malzeme('#f6f6f2', 'kumas'), 0, 0.92, 0.27, k.govde);
  }
  function askilar(k) {
    [-1, 1].forEach(y => parca(new THREE.BoxGeometry(0.04, 0.5, 0.02), malzeme('#5a3a1e', 'deri'), y * 0.1, 1.0, 0.245, k.govde));
  }
  function saatKosteği(k) {
    const z = parca(new THREE.TorusGeometry(0.06, 0.005, 6, 16, Math.PI), malzeme('#e8bd3a', 'metal'), 0.08, 0.92, 0.27, k.govde);
    z.rotation.z = Math.PI;
  }

  // ---------- Karakteri kur ----------
  // secenek.ayakta: sandalyesiz, yürüyebilen (saloondaki gezginler)
  function yap(tur, secenek = {}) {
    if (!BILGI[tur]) tur = 'horoz';
    const ayakta = !!secenek.ayakta;
    const kok = new THREE.Group();
    const k = {
      tur, kok, ayakta, gozler: [], yaw: 0, pitch: 0, hedefYaw: 0, hedefPitch: 0, kirp: 0, sonrakiKirp: 1 + Math.random() * 3,
      tepki: null, olu: false, oluOran: 0, faz: Math.random() * 10, kafaYukseklik: 0, kartSayisi: -1,
      ifade: 'normal', ifadeSure: 0, konusma: 0, konusmaHedef: 0, otoKonus: 0, yuru: 0, adim: 0,
    };
    const kiy = KIYAFET[tur];
    const Y = ayakta ? 0.45 : 0;   // ayaktayken gövde daha yukarıda

    if (!ayakta) {
      const tahta = malzeme('#5a3417', 'deri');
      parca(new THREE.BoxGeometry(0.6, 0.06, 0.55), tahta, 0, 0.58, -0.05, kok);
      parca(new THREE.BoxGeometry(0.6, 0.75, 0.06), tahta, 0, 0.98, -0.33, kok).rotation.x = -0.08;
      [[-0.26, -0.28], [0.26, -0.28], [-0.26, 0.18], [0.26, 0.18]].forEach(([x, z]) => parca(silindir(0.03, 0.03, 0.58, 8), tahta, x, 0.29, z, kok));
    }

    // Gövde: omuzlu, belli bir profil (döndürülmüş), gömlek kumaşı
    k.govde = new THREE.Group();
    k.govde.position.y = Y;
    kok.add(k.govde);
    const profil = [[0, 0.62], [0.27, 0.63], [0.29, 0.75], [0.25, 0.95], [0.25, 1.12], [0.3, 1.2], [0.24, 1.27], [0.08, 1.3], [0, 1.3]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const govdeMesh = parca(new THREE.LatheGeometry(profil, 28), malzeme(kiy.gomlek, 'kumas'), 0, 0, 0.02, k.govde);
    govdeMesh.scale.z = 0.85;
    // Yelek: önü açık iki kanat
    [-1, 1].forEach(y => {
      const kanat = parca(new THREE.CylinderGeometry(0.258, 0.275, 0.52, 22, 1, true, y > 0 ? 0.18 : Math.PI * 2 - 1.85, 1.67),
        malzeme(kiy.yelek, 'kumas', { side: THREE.DoubleSide }), 0, 0.98, 0.02, k.govde);
      kanat.scale.z = 0.88;
    });
    // Kemer ve tokası
    const kemer = parca(silindir(0.282, 0.282, 0.05, 24), malzeme('#3a2414', 'deri'), 0, 0.72, 0.02, k.govde);
    kemer.scale.z = 0.86;
    parca(new THREE.BoxGeometry(0.07, 0.05, 0.02), malzeme('#d8b04a', 'metal'), 0, 0.72, 0.265, k.govde);
    // Düğmeler
    for (let i = 0; i < 3; i++) parca(kure(0.012, 8), malzeme('#e8dcc0', 'parlak'), 0, 1.12 - i * 0.12, 0.225, k.govde);

    // Bacaklar
    k.bacaklar = [-1, 1].map(y => {
      const kalca = new THREE.Group();
      kalca.position.set(y * 0.12, ayakta ? 0.62 + Y : 0.64, 0.02);
      (ayakta ? k.govde.parent : kok).add(kalca);
      const pant = malzeme(kiy.pantolon, 'kumas');
      if (ayakta) {
        parca(new THREE.CapsuleGeometry(0.085, 0.42, 4, 12), pant, 0, -0.3, 0, kalca);
        const diz = new THREE.Group();
        diz.position.y = -0.55;
        kalca.add(diz);
        parca(new THREE.CapsuleGeometry(0.075, 0.36, 4, 12), pant, 0, -0.25, 0, diz);
        parca(new THREE.BoxGeometry(0.13, 0.1, 0.25), malzeme('#4a2a14', 'deri'), 0, -0.5, 0.05, diz);
        return { kalca, diz };
      }
      const b = parca(new THREE.CapsuleGeometry(0.085, 0.38, 4, 12), pant, 0, 0, 0.23, kalca);
      b.rotation.x = Math.PI / 2;
      parca(new THREE.CapsuleGeometry(0.075, 0.35, 4, 12), pant, 0, -0.26, 0.43, kalca);
      parca(new THREE.BoxGeometry(0.13, 0.1, 0.25), malzeme('#4a2a14', 'deri'), 0, -0.52, 0.5, kalca);
      return { kalca };
    });

    // Kollar: omuzdan ele; el = eldiven gibi avuç + başparmak
    k.kollar = [-1, 1].map(y => {
      const omuz = new THREE.Group();
      omuz.position.set(y * 0.28, 1.17, 0.02);
      k.govde.add(omuz);
      const kol = parca(new THREE.CapsuleGeometry(0.068, 0.42, 4, 12), malzeme(kiy.gomlek, 'kumas'), 0, 0, 0.27, omuz);
      kol.rotation.x = Math.PI / 2;
      parca(silindir(0.074, 0.074, 0.05, 14), malzeme(tonla(kiy.gomlek, -0.06), 'kumas'), 0, 0, 0.47, omuz).rotation.x = Math.PI / 2;
      const el = new THREE.Group();
      el.position.set(0, 0, 0.53);
      omuz.add(el);
      const elMal = malzeme(kiy.el, 'kurk');
      parca(kure(0.06, 14), elMal, 0, 0, 0.01, el).scale.set(1.05, 0.8, 1.15);
      parca(new THREE.CapsuleGeometry(0.02, 0.04, 3, 8), elMal, -y * 0.05, 0.02, 0.02, el).rotation.z = y * 0.8;
      omuz.rotation.set(ayakta ? Math.PI / 2 - 0.1 : 0.55, ayakta ? 0 : -y * 0.42, 0);
      return { omuz, el, y };
    });

    // Elde tutulan kartlar
    k.elKartlari = new THREE.Group();
    k.elKartlari.position.set(0, 1.0, 0.43);
    k.elKartlari.rotation.x = -0.35;
    k.govde.add(k.elKartlari);
    if (ayakta) k.elKartlari.visible = false;

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

  // Tepki: 'zipla' | 'titre' | 'gul' | 'bagir' | 'rahat' | 'dusun' | 'salla' (el sallama)
  const TEPKI_IFADE = { zipla: 'korkmus', titre: 'korkmus', gul: 'mutlu', bagir: 'kizgin', rahat: 'mutlu', dusun: 'supheli', salla: 'mutlu' };
  function tepki(k, tur, sure = 1.4) {
    if (k.olu) return;
    k.tepki = { tur, t: 0, sure };
    ifade(k, TEPKI_IFADE[tur] || 'normal', sure + 0.4);
    if (tur === 'bagir' || tur === 'gul') konus(k, sure * 0.8);
  }
  function ifade(k, tur, sure = 2) {
    k.ifade = tur;
    k.ifadeSure = sure;
  }
  // Botlar konuşurken (balonla) ağız kendi kendine oynar
  function konus(k, sure = 1.2) {
    k.otoKonus = Math.max(k.otoKonus, sure);
  }

  function oldur(k) {
    k.olu = true;
    k.tepki = null;
    k.gozler.forEach(g => {
      [g.iris, g.bebek, g.parlak].forEach(m => (m.visible = false));
      g.x.forEach(x => (x.visible = true));
    });
    k.elKartlari.visible = false;
  }

  // Göz kapağı ve kaş hedefleri (ifadeye göre)
  const IFADE = {
    normal:  { kapak: -0.95, kas: 0, kasY: 0 },
    kizgin:  { kapak: -0.45, kas: 0.35, kasY: -0.2 },
    korkmus: { kapak: -1.35, kas: -0.35, kasY: 0.35 },
    supheli: { kapak: -0.1, kas: 0.18, kasY: -0.15 },
    mutlu:   { kapak: -0.7, kas: -0.1, kasY: 0.15 },
  };

  // Her karede: nefes, göz kırpma, bakış, ifade, ağız, yürüme, tepkiler
  function guncelle(k, t, dt) {
    const f = t + k.faz;
    k.oluOran = Math.min(1, Math.max(0, k.oluOran + (k.olu ? dt * 1.6 : -dt * 2)));
    const o = k.oluOran;
    const hiz = 1 - Math.exp(-dt * 6);
    k.yaw += (k.hedefYaw + Math.sin(f * 0.7) * 0.04 - k.yaw) * hiz;
    k.pitch += (k.hedefPitch + Math.sin(f * 0.9) * 0.025 - k.pitch) * hiz;
    let kx = k.pitch, ky = k.yaw, kz = Math.sin(f * 0.5) * 0.035, govY = 0, govX = 0, govZ = 0;
    let solKol = 0, sagKol = 0;
    k.govde.scale.y = 1 + Math.sin(f * 2.2) * 0.01;

    if (k.tepki) {
      const tp = k.tepki;
      tp.t += dt;
      const p = tp.t / tp.sure;
      if (p >= 1) k.tepki = null;
      else {
        const zarf = Math.sin(Math.PI * Math.min(1, p * 1.2));
        if (tp.tur === 'zipla') {
          govY = Math.abs(Math.sin(tp.t * 14)) * 0.1 * (1 - p);
          kx -= 0.25 * zarf;
          solKol = sagKol = -0.7 * zarf;
        } else if (tp.tur === 'titre') {
          kz += Math.sin(tp.t * 70) * 0.04;
          ky += Math.sin(tp.t * 55) * 0.035;
          govX = Math.sin(tp.t * 60) * 0.012;
          kx += 0.12;
        } else if (tp.tur === 'gul') {
          kx += -0.25 + Math.abs(Math.sin(tp.t * 18)) * 0.3 * zarf;
          govY = Math.abs(Math.sin(tp.t * 18)) * 0.025;
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
        } else if (tp.tur === 'salla') {
          sagKol = -1.3 * zarf + Math.sin(tp.t * 14) * 0.25 * zarf;
        }
      }
    }

    // Yürüme (ayaktakiler)
    if (k.ayakta) {
      k.adim += dt * 7 * k.yuru;
      const s = Math.sin(k.adim) * 0.5 * k.yuru;
      k.bacaklar.forEach((b, i) => {
        b.kalca.rotation.x = i ? s : -s;
        b.diz.rotation.x = Math.max(0, (i ? -1 : 1) * Math.cos(k.adim) * 0.5 * k.yuru);
      });
      govY += Math.abs(Math.cos(k.adim)) * 0.03 * k.yuru;
      solKol += s * 0.8;
      sagKol -= s * 0.8;
    }

    // Ölüm: gövde masaya kapanır, kafa yana düşer
    kx = kx * (1 - o) + 0.9 * o;
    kz = kz * (1 - o) + 0.5 * o;
    k.govde.rotation.set(govX + 0.55 * o, 0, 0.1 * o);
    k.govde.position.set(0, (k.ayakta ? 0.45 : 0) + govY - 0.05 * o, govZ + 0.08 * o);
    k.kafa.rotation.set(kx, ky * (1 - o), kz, 'YXZ');
    k.kollar.forEach(kol => {
      const ek = kol.y < 0 ? solKol : sagKol;
      const temel = k.ayakta ? Math.PI / 2 - 0.1 : 0.55;
      kol.omuz.rotation.x = temel + ek + Math.sin(f * 1.3 + kol.y) * 0.02 - 0.3 * o;
    });

    // İfade, göz kırpma, kaşlar
    if (k.ifadeSure > 0) {
      k.ifadeSure -= dt;
      if (k.ifadeSure <= 0) k.ifade = 'normal';
    }
    const ifd = IFADE[k.olu ? 'normal' : k.ifade] || IFADE.normal;
    k.sonrakiKirp -= dt;
    if (k.sonrakiKirp < 0) {
      k.kirp = 0.13;
      k.sonrakiKirp = 1.5 + Math.random() * 3.5;
    }
    k.kirp -= dt;
    const kapakHedef = k.olu ? 0.9 : k.kirp > 0 ? 1.45 : ifd.kapak;
    k.gozler.forEach(g => {
      g.kapak.rotation.x += (kapakHedef - g.kapak.rotation.x) * Math.min(1, dt * (k.kirp > 0 ? 40 : 10));
      const yon = g.sol ? 1 : -1;
      g.kas.rotation.z += (yon * -ifd.kas - g.kas.rotation.z) * Math.min(1, dt * 8);
      g.kas.position.y += (g.r * (1.35 + ifd.kasY) - g.kas.position.y) * Math.min(1, dt * 8);
      // Bebekler bakış yönüne biraz kayar
      const kay = Math.max(-0.35, Math.min(0.35, (k.hedefYaw - k.yaw) * -0.5)) * g.r;
      g.iris.position.x = g.bebek.position.x = kay;
      g.parlak.position.x = kay + g.r * 0.18;
    });

    // Ağız: konuşma seviyesi (mikrofondan) ya da botun kendi konuşması
    if (k.otoKonus > 0) {
      k.otoKonus -= dt;
      k.konusmaHedef = Math.max(k.konusmaHedef, 0.25 + Math.abs(Math.sin(f * 17)) * 0.6 * Math.abs(Math.sin(f * 5.3)));
    }
    k.konusma += (Math.min(1, k.konusmaHedef) - k.konusma) * Math.min(1, dt * 18);
    k.konusmaHedef *= Math.exp(-dt * 10);
    const acik = k.olu ? 0.35 : k.konusma;
    if (k.agiz) k.agiz.g.scale.y = 0.12 + acik * 0.95;
    if (k.altGaga) k.altGaga.rotation.x = acik * 0.45;

    if (k.puroUcu) k.puroUcu.material.emissiveIntensity = 0.6 + Math.sin(f * 3) * 0.4;
    if (k.sakal) k.sakal.rotation.z = Math.sin(f * 1.7) * 0.06 + acik * 0.15;
  }

  const elRengi = t => (KIYAFET[t] || KIYAFET.horoz).el;
  const gomlekRengi = t => (KIYAFET[t] || KIYAFET.horoz).gomlek;
  return { BILGI, TURLER, yap, guncelle, tepki, ifade, konus, oldur, kartlariAyarla, malzeme, elRengi, gomlekRengi };
})();
