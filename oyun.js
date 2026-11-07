// =============================================================
// Yalancının Mumu - ekran: menü, karakter seçimi, el kartları, düğmeler, mesajlar, tepkiler
// Motor'dan (ya da online'da oda sahibinden) gelen olaylara göre sahneyi oynatır.
// Masa: tek başına / oda sahibiyken Motor, başkasının odasındayken Uzak (hamleleri oda sahibine yollar).
// =============================================================

const $ = id => document.getElementById(id);
const ANAHTAR_AD = 'yalancininMumu.ad';
const ANAHTAR_KARAKTER = 'yalancininMumu.karakter';
const kayitOku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch (e) { return v; } };
const kayitYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) { /* yok */ } };
const guvenli = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let Masa = Motor;
const ui = {
  benimNo: 0,
  durum: null,
  secili: new Set(),
  karakter: kayitOku(ANAHTAR_KARAKTER, 'horoz'),
  etiketler: {},
  bakisSayac: { no: -1, sure: 0 },
  ozelBakis: {},       // bot no -> bu zamana kadar bana bakar
};
const online = () => typeof Ag !== 'undefined' && Ag.mod !== 'yerel';

// ---------- Botların ve karakterlerin lafları ----------
const SOZLER = {
  at: ['Hepsi {k}, yemin ederim! 🤠', 'Bana güven, ortak.', 'Temiz kart bunlar.', 'Hıh, {k} işte.', 'Gözüme bak… {k}.', 'Annemin mezarı üstüne {k}!', 'Sıradaki gelsin.'],
  yalanci: ['YALANCI!', 'Hadi ordan!', 'Yemezler!', 'Aç bakalım şunları!', 'Kokusu buraya geliyor!'],
  kurtuldu: ['Ohh… az kalsın.', 'Bugün şanslı günüm!', 'Kalbim duracaktı!', 'Hâlâ buradayım! 😅'],
  sevindi: ['Hah! Yakaladım seni!', 'Söylemiştim!', 'Sıra sende, yalancı.'],
  oldu: { akbaba: 'Cenaze benden… 🦅', diger: ['Mumu söndü…', 'Toprağı bol olsun.', 'Yatsıyı bulamadı…'] },
};
const sec = (liste, r) => liste[Math.floor((r ?? Math.random()) * liste.length) % liste.length];

// ---------- Menü ----------
function menuKur() {
  $('adim').value = kayitOku(ANAHTAR_AD, '');
  const kap = $('karakterler');
  Karakterler.TURLER.forEach(t => {
    const b = document.createElement('button');
    b.className = 'karakterBtn';
    b.dataset.tur = t;
    const bilgi = Karakterler.BILGI[t];
    b.innerHTML = `<span class="emoji">${bilgi.emoji}</span>${bilgi.ad}`;
    b.addEventListener('click', () => {
      if (b.classList.contains('alindi')) return;   // odada başkası seçmiş
      ui.karakter = t;
      kayitYaz(ANAHTAR_KARAKTER, t);
      karakterGoster();
      Ses.sec();
      if (online()) Ag.karakterSec(t);
    });
    kap.appendChild(b);
  });
  if (!Karakterler.BILGI[ui.karakter]) ui.karakter = 'horoz';
  karakterGoster();
  $('botlaBtn').addEventListener('click', botlaBasla);
}
function karakterGoster() {
  document.querySelectorAll('.karakterBtn').forEach(b => b.classList.toggle('secili', b.dataset.tur === ui.karakter));
  $('karakterAciklama').textContent = Karakterler.BILGI[ui.karakter].aciklama;
}

function botlaBasla() {
  Ses.hazirla();
  const ad = $('adim').value.trim() || 'Sen';
  kayitYaz(ANAHTAR_AD, $('adim').value.trim());
  const kalan = Karakterler.TURLER.filter(t => t !== ui.karakter).sort(() => Math.random() - 0.5);
  const oyuncular = [{ ad, karakter: ui.karakter, bot: false, kiyafet: Giydir.kiyafet(ui.karakter) }];
  for (let i = 0; i < 3; i++) oyuncular.push({ ad: Karakterler.BILGI[kalan[i]].ad, karakter: kalan[i], bot: true });
  ui.son = oyuncular;
  ui.sonAyar = Giydir.motorAyari();
  Masa = Motor;
  Motor.yeni(oyuncular, olayGeldi, ui.sonAyar);
  oyunEkraniniKur(Motor.gorunum(0), 0);
}

// Oyun ekranını aç ve sahneyi kur (tek başına, oda sahibi ve odaya katılan için ortak)
function oyunEkraniniKur(d, benimNo) {
  ui.dagitiliyor = false;
  $('masaKarti').classList.remove('gizli');
  ui.benimNo = benimNo;
  ui.durum = d;
  ui.secili.clear();
  Masa = online() && Ag.mod === 'misafir' ? Uzak : Motor;
  $('menu').hidden = true;
  $('oyun').hidden = false;
  $('sonEkran').hidden = true;
  $('olumPerdesi').hidden = true;
  $('acilan').hidden = true;
  $('sahne').classList.toggle('olu', !d.oyuncular[benimNo].canli);
  Sahne.kur(d.oyuncular, benimNo);
  Sahne.olumleriUygula(d.oyuncular);
  etiketleriKur();
  elCiz(true);
  ciz();
  Ses.muzikBaslat();
}

function menuyeDon() {
  if (online()) {
    Ag.ayril();
    return;
  }
  Motor.temizle();
  Ses.gerilimDurdur(true);
  $('oyun').hidden = true;
  $('menu').hidden = false;
  $('sahne').classList.remove('olu');
}

// ---------- Olaylar ----------
const adi = no => ui.durum.oyuncular[no].ad;
const masaAdi = t => Motor.AD[t];

// d: online'da oda sahibinden gelen görünüm; yoksa motordan alınır
function olayGeldi(tip, v, d) {
  ui.durum = d || Motor.gorunum(ui.benimNo);
  d = ui.durum;
  const p = no => d.oyuncular[no];
  if (tip === 'el') {
    Sahne.yiginiTemizle();
    $('acilan').hidden = true;
    ui.secili.clear();
    // Masa kartı önce ortada döner (yazısı da ortada), sonra kartlar sırası gelenden başlayarak 5'erli dağıtılır
    mesaj(`${masaAdi(v.masaKarti).toLocaleUpperCase('tr')} MASASI`, 'iri orta', Motor.TANITIM);
    $('masaKarti').classList.add('gizli');
    const sirali = [];
    const n = d.oyuncular.length;
    for (let k = 0; k < n; k++) {
      const p2 = d.oyuncular[(((v.sira + k * (v.yon || 1)) % n) + n) % n];
      if (p2.canli) sirali.push(p2.no);
    }
    ui.dagitiliyor = true;
    ui.gorunenKart = 0;
    elCiz();
    setTimeout(() => Ses.dagit(), Motor.TANITIM * 0.8);
    const elNo = v.elNo;
    Sahne.dagitimBasla(v.masaKarti, sirali, Motor.TANITIM, Motor.KART_ARA, Motor.EL_KART, no => {
      if (ui.durum?.elNo !== elNo) return;
      Ses.tekKart();
      if (no === ui.benimNo) {
        ui.gorunenKart++;
        elCiz(true);
      }
      Sahne.kartSayilari(ui.durum.oyuncular);
    }, dagitimBitti);
    // Yedek: ekran çizilemediyse (telefon arka plandaydı vb.) süre dolunca dağıtımı bitir
    setTimeout(() => {
      if (ui.durum?.elNo !== elNo || !ui.dagitiliyor) return;
      Sahne.dagitimBitir();
      dagitimBitti();
    }, (v.sure || 5000) + 300);
    function dagitimBitti() {
      if (ui.durum?.elNo !== elNo || !ui.dagitiliyor) return;
      ui.dagitiliyor = false;
      elCiz();
      $('masaKarti').classList.remove('gizli');
      $('masaKarti').classList.remove('yeni');
      void $('masaKarti').offsetWidth;
      $('masaKarti').classList.add('yeni');
      ciz();
    }
  } else if (tip === 'sira') {
    if (v.no === ui.benimNo) {
      Ses.siraSende();
      if (v.zorunlu) mesaj('Elinde kart olan bir tek sen kaldın: “Yalancı!” demek zorundasın', '', 2600);
    }
    bakislar();
  } else if (tip === 'oynadi') {
    Sahne.kartAt(v.no, v.adet);
    Ses.kartAt(v.adet);
    // Bot ara sıra laf atar, insanlar sadece kaç kart attığını söyler
    const laf = p(v.no).bot && v.r < 0.55 ? sec(SOZLER.at, v.r * 1.8).replace('{k}', masaAdi(v.masaKarti)) : `${v.adet} ${masaAdi(v.masaKarti)}!`;
    balon(v.no, laf);
    Sahne.konus(v.no, 1.1);
    if (v.no === ui.benimNo) { ui.secili.clear(); elCiz(); }
    if (v.kalan === 0) setTimeout(() => mesaj(v.no === ui.benimNo ? 'Kartlarını bitirdin' : `${adi(v.no)} kartlarını bitirdi`, '', 1500), 600);
    const bakan = d.oyuncular.filter(x => x.bot && x.canli && x.no !== v.no);
    if (bakan.length && v.r > 0.4) {
      const b = bakan[Math.floor(v.r * 10) % bakan.length].no;
      Sahne.tepki(b, 'dusun', 1.6);
      Sahne.ifade(b, 'supheli', 2.5);
    }
  } else if (tip === 'yalanci') {
    balon(v.no, p(v.no).bot ? sec(SOZLER.yalanci, v.r) : 'YALANCI!', true);
    Sahne.tepki(v.no, 'bagir', 1.2);
    Sahne.tepki(v.atan, 'zipla', 1);
    Ses.yalanci();
    d.oyuncular.forEach(x => x.bot && x.no !== v.no && Sahne.bak(x.no, v.atan));
    if (p(v.no).bot) Sahne.bak(v.no, v.atan);
    const turler = v.kartlar.map(k => k.tur);
    setTimeout(() => {
      Sahne.kartlariAc(turler, v.yalanVar, d.masaKarti);
      Ses.kartAc(turler.length);
      acilanGoster(turler, v);
    }, 700);
    setTimeout(() => {
      v.yalanVar ? Ses.yalanCikti() : Ses.dogruCikti();
      const kazanan = v.yalanVar ? v.no : v.atan;
      Sahne.tepki(kazanan, 'gul', 1.6);
      if (p(kazanan).bot) balon(kazanan, sec(SOZLER.sevindi, v.r));
      Sahne.ifade(v.cezali, 'korkmus', 4);
    }, 1500);
  } else if (tip === 'tetikHazir') {
    $('acilan').hidden = true;
    Sahne.tabancaKaldir(v.no);
    Ses.topDon();
    Ses.gerilimBaslat(4);
    setTimeout(() => Ses.gerilim(), 500);
    const kesir = `1/${6 - v.tetik}`;
    mesaj(v.no === ui.benimNo ? `Tetiği sen çekiyorsun… (ihtimal ${kesir})` : `${adi(v.no)} tetiği çekiyor… (ihtimal ${kesir})`, 'kirmizi', 3600);
    Sahne.tepki(v.no, 'titre', 3.8);
    Sahne.terle(v.no, 3.5);
    d.oyuncular.forEach(x => x.bot && x.no !== v.no && Sahne.bak(x.no, v.no));
    if (p(v.no).bot) Sahne.bak(v.no, 'masa');
  } else if (tip === 'tetik') {
    Sahne.tetikSonuc(v.no, v.oldu);
    Ses.gerilimDurdur();
    if (v.oldu) {
      Ses.bam();
      setTimeout(Ses.mum, 500);
      mesaj(v.no === ui.benimNo ? 'BAM! Mumun söndü 🕯️' : `BAM! 🕯️ ${adi(v.no)} öldü, mumu söndü`, 'iri kirmizi', 2400);
      if (v.no === ui.benimNo) {
        $('sahne').classList.add('olu');
        $('olumMenuBtn').textContent = online() ? '👀 İzlemeye devam' : '🏠 Ana menü';
        setTimeout(() => ($('olumPerdesi').hidden = false), 1600);
      }
      const yasayan = d.oyuncular.filter(x => x.canli && x.bot);
      yasayan.forEach(x => (x.karakter === 'akbaba' || v.r > 0.5) && Sahne.tepki(x.no, x.karakter === 'akbaba' ? 'gul' : 'zipla', 1.4));
      const konusan = yasayan.find(x => x.karakter === 'akbaba') || yasayan[Math.floor(v.r * yasayan.length)];
      if (konusan) setTimeout(() => balon(konusan.no, konusan.karakter === 'akbaba' ? SOZLER.oldu.akbaba : sec(SOZLER.oldu.diger, v.r)), 1400);
    } else {
      Ses.tik();
      mesaj(`TIK! ${v.no === ui.benimNo ? 'Kurtuldun' : 'Kurtuldu'}… (${v.tetik}/6)`, 'iri', 2000);
      if (p(v.no).bot) setTimeout(() => balon(v.no, sec(SOZLER.kurtuldu, v.r)), 500);
      d.oyuncular.filter(x => x.canli && x.bot && x.no !== v.no).forEach(x => v.r < 0.4 && Sahne.tepki(x.no, 'gul', 1.2));
    }
  } else if (tip === 'ozelGeldi') {
    if (v.no === ui.benimNo) {
      const t = d.oyuncular[ui.benimNo].ozel?.at(-1);
      const k = Motor.OZEL[t];
      if (k) mesaj(`🎴 Özel kart geldi: ${k.emoji} ${k.ad}!`, '', 2600);
      Ses.siraSende();
    } else balon(v.no, '🎴 Özel kart aldım!');
  } else if (tip === 'ozelKullandi') {
    const k = Motor.OZEL[v.tur];
    const kim = v.no === ui.benimNo ? 'Sen' : adi(v.no);
    Ses.kartAc(1);
    if (v.tur === 'durbun') {
      const db = d.oyuncular[ui.benimNo].durbun;
      if (v.no === ui.benimNo && db) {
        mesaj(`👀 Dürbün: ${adi(db.sonNo)} ${db.adet} kart attı, biri ${Motor.AD[db.tur].toLocaleUpperCase('tr')}`, db.tur === 'J' || db.tur === d.masaKarti ? '' : 'kirmizi', 4000);
        $('durbunKart').innerHTML = `<img src="${Sahne.kartResmi(db.tur)}" alt=""><small>👀 Kartı atan: ${guvenli(adi(db.sonNo))}</small>`;
        $('durbunKart').hidden = false;
      } else {
        balon(v.no, '👀 Dürbünle bakıyorum…');
        Sahne.ifade(v.no, 'supheli', 3);
      }
    } else {
      const ben = v.no === ui.benimNo;
      const ek = v.tur === 'ters' ? ' Sıra artık ters yönde.' : v.tur === 'pas' ? (ben ? ' Sırayı geçtin.' : ' Sırayı geçti.') : v.tur === 'viski' ? (ben ? ' Tabancan sıfırlandı.' : ' Tabancası sıfırlandı.') : '';
      mesaj(`${kim} ${k.emoji} ${k.ad} ${ben ? 'kullandın' : 'kullandı'}!${ek}`, '', 2600);
      if (v.no !== ui.benimNo) {
        balon(v.no, `${k.emoji} ${k.ad}!`);
        Sahne.tepki(v.no, v.tur === 'viski' ? 'rahat' : 'salla', 1.4);
      }
    }
  } else if (tip === 'yelek') {
    Ses.tik();
    Ses.dogruCikti();
    mesaj(v.no === ui.benimNo ? '🛡️ Çelik yeleğin seni kurtardı!' : `🛡️ Çelik yelek! ${adi(v.no)} tetiği çekmekten kurtuldu`, 'iri', 2600);
    Sahne.tepki(v.no, 'gul', 1.6);
    $('acilan').hidden = true;
  } else if (tip === 'bitti') {
    setTimeout(() => sonuGoster(v.kazanan, v.istat), 1200);
  }
  if (tip === 'el' || tip === 'oynadi') $('durbunKart').hidden = true;
  ciz();
}

// ---------- Domates (mumu sönenler atar) ----------
let sonDomates = 0;
function domatesFirlat(hedef) {
  if (Date.now() - sonDomates < 2000) return;
  sonDomates = Date.now();
  Ag.domatesGonder(hedef);
  const yeni = Istatistik.domatesAtildi();
  yeni.forEach(r => setTimeout(() => mesaj(`🏅 Yeni rozet: ${r.emoji} ${r.ad}`, 'iri', 3000), 900));
}
function domatesGoster(kimden, hedef) {
  if (!ui.durum) return;
  const bana = hedef === ui.benimNo;
  Sahne.domatesAt(kimden, hedef, bana);
  Ses.domates();
  if (bana) {
    setTimeout(ekranaDomates, 700);
    setTimeout(() => mesaj(`🍅 ${adi(kimden)} sana domates attı!`, '', 2000), 750);
  }
}
// Ekrana yapışan domates: ezik domates (çekirdekli, parçalı, parlak) görüşü kapatır, suyu 2 sn boyunca
// aşağı doğru akar, sonra yavaşça kaybolur.
function ekranaDomates() {
  const c = $('domatesKanvas');
  const w = (c.width = innerWidth), h = (c.height = innerHeight);
  const g = c.getContext('2d');
  const R = Math.min(w, h) * (0.3 + Math.random() * 0.06);
  const cx = w * (0.35 + Math.random() * 0.3), cy = h * (0.28 + Math.random() * 0.2);
  // Eziğin kendisi: bir kez çizilip saklanır
  const ez = document.createElement('canvas');
  ez.width = w;
  ez.height = h;
  const e = ez.getContext('2d');
  const sekil = [...Array(5)].map(() => [Math.random() * 6, 2 + Math.floor(Math.random() * 5), 0.05 + Math.random() * 0.12]);
  const kenar = a => R * (1 + sekil.reduce((t, [f, n, s]) => t + Math.sin(a * n + f) * s, 0));
  const yol = (olcek, dx = 0, dy = 0) => {
    e.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2, r = kenar(a) * olcek;
      e.lineTo(cx + dx + Math.cos(a) * r, cy + dy + Math.sin(a) * r * 0.9);
    }
    e.closePath();
  };
  // Etrafa sıçrayan damlalar
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, u = R * (1.05 + Math.random() * 0.8), r = 4 + Math.random() * R * 0.07;
    e.fillStyle = `rgba(${170 + Math.random() * 40},${14 + Math.random() * 20},10,0.92)`;
    e.beginPath();
    e.ellipse(cx + Math.cos(a) * u, cy + Math.sin(a) * u, r, r * (0.6 + Math.random() * 0.4), a, 0, 7);
    e.fill();
  }
  // Ana ezik: koyu kenar, içte açık kırmızı, sulu parlaklık
  const gr = e.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R * 1.1);
  gr.addColorStop(0, '#ff5a3c');
  gr.addColorStop(0.55, '#d8241a');
  gr.addColorStop(1, '#8e0f0a');
  e.fillStyle = gr;
  yol(1);
  e.fill();
  // İç et parçaları (daha açık, düzensiz)
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, u = R * Math.random() * 0.6;
    e.fillStyle = `rgba(255,${90 + Math.random() * 50},${70 + Math.random() * 30},0.55)`;
    e.beginPath();
    e.ellipse(cx + Math.cos(a) * u, cy + Math.sin(a) * u, R * (0.12 + Math.random() * 0.12), R * (0.07 + Math.random() * 0.08), Math.random() * 3, 0, 7);
    e.fill();
  }
  // Çekirdekler (sarımsı, jöleli)
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2, u = R * Math.sqrt(Math.random()) * 0.75;
    const x = cx + Math.cos(a) * u, y = cy + Math.sin(a) * u, b = 3 + Math.random() * 4;
    e.fillStyle = 'rgba(255,190,120,0.35)';
    e.beginPath(); e.ellipse(x, y, b * 1.9, b * 1.4, a, 0, 7); e.fill();
    e.fillStyle = '#f2d27a';
    e.beginPath(); e.ellipse(x, y, b, b * 0.6, a, 0, 7); e.fill();
  }
  // Kabuk parçası ve sap
  e.fillStyle = '#b5150e';
  e.beginPath(); e.ellipse(cx + R * 0.45, cy - R * 0.35, R * 0.22, R * 0.1, -0.6, 0, 7); e.fill();
  e.fillStyle = '#3a7a2a';
  for (let i = 0; i < 5; i++) {
    e.beginPath();
    e.ellipse(cx - R * 0.3 + Math.cos(i * 1.26) * 10, cy - R * 0.45 + Math.sin(i * 1.26) * 10, 12, 4, i * 1.26, 0, 7);
    e.fill();
  }
  // Islak parlaklık
  e.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) {
    e.beginPath();
    e.ellipse(cx - R * 0.35 + Math.random() * R * 0.5, cy - R * 0.4 + Math.random() * R * 0.4, 6 + Math.random() * 16, 3 + Math.random() * 5, -0.5, 0, 7);
    e.fill();
  }
  // Akan su: eziğin alt kenarından aşağı süzülen damlalar
  const akintilar = [...Array(9 + Math.floor(Math.random() * 5))].map(() => {
    const a = Math.PI * (0.15 + Math.random() * 0.7);   // alt yarım
    return {
      x: cx + Math.cos(a) * kenar(a) * 0.85, y0: cy + Math.sin(a) * kenar(a) * 0.8,
      gen: 7 + Math.random() * 16, boy: 0, hiz: 70 + Math.random() * 130, sal: Math.random() * 6,
    };
  });
  const bas = performance.now();
  c.style.transition = 'none';
  c.style.opacity = '1';
  cancelAnimationFrame(ekranaDomates.istek);
  const ciz = () => {
    const t = (performance.now() - bas) / 1000;
    g.clearRect(0, 0, w, h);
    akintilar.forEach(a => {
      if (t < 2.2) {
        a.boy += a.hiz * (1 - t / 3) * (1 / 60) * (0.6 + Math.random() * 0.8);   // giderek yavaşlar
      }
      const x = a.x + Math.sin(t * 2 + a.sal) * 3;
      const ust = a.y0 - 10, alt = a.y0 + a.boy;
      const gr2 = g.createLinearGradient(0, ust, 0, alt);
      gr2.addColorStop(0, 'rgba(200,24,14,0.95)');
      gr2.addColorStop(1, 'rgba(170,16,10,0.85)');
      g.fillStyle = gr2;
      g.beginPath();
      g.moveTo(x - a.gen / 2, ust);
      g.quadraticCurveTo(x - a.gen * 0.42, (ust + alt) / 2, x - a.gen * 0.3, alt);
      g.arc(x, alt, a.gen * 0.42, Math.PI, 0, true);   // ucunda damla
      g.quadraticCurveTo(x + a.gen * 0.42, (ust + alt) / 2, x + a.gen / 2, ust);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x - a.gen * 0.2, ust, 2, a.boy * 0.8);
    });
    g.drawImage(ez, 0, 0);
    if (t < 2.6) ekranaDomates.istek = requestAnimationFrame(ciz);
    else {
      // Akış bitti: yavaşça silinir
      c.style.transition = 'opacity 1.4s';
      c.style.opacity = '0';
    }
  };
  ciz();
}

// Mumu sönmüş botlar ara sıra yaşayanlara domates atar (tek başına ya da oda sahibiyken)
setInterval(() => {
  const d = ui.durum;
  if (!d || d.asama === 'bitti' || $('oyun').hidden || Masa !== Motor) return;
  const yasayan = d.oyuncular.filter(p => p.canli);
  d.oyuncular.filter(p => !p.canli && p.bot).forEach(p => {
    if (Math.random() < 0.1 && yasayan.length) Ag.domatesDagit(p.no, yasayan[Math.floor(Math.random() * yasayan.length)].no);
  });
}, 4000);

// Botların bakışları: sıradakine bakarlar, sıradaki bot kartlarına bakar.
// Ben bir bota bir süre bakarsam o da bana bakar. (İnsan oyuncuların kafası kendi ekranlarından gelir.)
function bakislar() {
  const d = ui.durum;
  if (!d || d.asama !== 'oyun') return;
  const simdi = performance.now();
  d.oyuncular.forEach(p => {
    if (!p.bot || !p.canli) return;
    if (ui.ozelBakis[p.no] > simdi) Sahne.bak(p.no, ui.benimNo);
    else if (p.no === d.sira) Sahne.bak(p.no, Math.random() < 0.6 ? 'kart' : d.sonNo >= 0 ? d.sonNo : 'masa');
    else Sahne.bak(p.no, d.sira);
  });
}
setInterval(() => {
  if ($('oyun').hidden || !ui.durum) return;
  const no = Sahne.baktigim();
  const p = ui.durum.oyuncular[no];
  if (no === ui.bakisSayac.no && no >= 0 && p?.bot) {
    ui.bakisSayac.sure += 0.3;
    if (ui.bakisSayac.sure > 1 && !(ui.ozelBakis[no] > performance.now())) {
      ui.ozelBakis[no] = performance.now() + 2000;
      Sahne.bak(no, ui.benimNo);
      Sahne.ifade(no, Math.random() < 0.5 ? 'supheli' : 'kizgin', 2);
      if (Math.random() < 0.35) Sahne.tepki(no, Math.random() < 0.5 ? 'dusun' : 'gul', 1.2);
    }
  } else ui.bakisSayac = { no, sure: 0 };
  bakislar();
}, 300);
// Kendi bakışımı (kafamın yönünü) odadakilere yolla
setInterval(() => {
  if (online() && !$('oyun').hidden) Ag.bakisGonder(Sahne.bakis.yaw, Sahne.bakis.pitch);
}, 150);

// ---------- Çizim ----------
function ciz() {
  const d = ui.durum;
  if (!d) return;
  Sahne.kartSayilari(d.oyuncular);
  $('masaKarti').innerHTML = `<img src="${Sahne.kartResmi(d.masaKarti)}" alt=""><div>${masaAdi(d.masaKarti).toLocaleUpperCase('tr')} MASASI<small>El ${d.elNo} · ${d.oyuncular.filter(p => p.canli).length} mum yanıyor</small></div>`;
  d.oyuncular.forEach(p => {
    const e = ui.etiketler[p.no];
    if (!e) return;
    e.el.classList.toggle('sirada', d.asama === 'oyun' && d.sira === p.no);
    e.el.classList.toggle('olu', !p.canli);
    const ses = online() && Ag.sesteMi(p.no) ? ' 🎙️' : '';
    const bot = p.yedekBot ? ' · 🤖 bot oynuyor' : '';
    const ozel = p.ozelSayisi ? ` · 🎴${p.ozelSayisi}` : '';
    e.bilgi.textContent = p.canli ? `🃏 ${p.kartSayisi} · 🔫 ${p.tetik}/6${ozel}${bot}${ses}` : '🕯️ mumu söndü';
  });
  const ben = d.oyuncular[ui.benimNo];
  const sirada = d.asama === 'oyun' && d.sira === ui.benimNo && ben.canli;
  $('benimBilgi').classList.toggle('sirada', sirada);
  $('benimBilgi').innerHTML = ben.canli
    ? `${Karakterler.BILGI[ben.karakter].emoji} <b>${guvenli(ben.ad)}</b> · 🔫 ${ben.tetik}/6 <small>(sonraki ihtimal 1/${6 - ben.tetik})</small>${sirada ? ' · <b>Sıra sende!</b>' : ''}`
    : '🕯️ Mumun söndü';
  const n = ui.secili.size;
  $('atBtn').disabled = !sirada || d.zorunlu || n < 1 || n > 3;
  $('atBtn').textContent = n ? `🃏 ${n} ${masaAdi(d.masaKarti)} at` : '🃏 Kart seç';
  $('yalanciBtn').disabled = !sirada || d.sonNo < 0;
  $('alt').style.visibility = ben.canli ? '' : 'hidden';
  // Özel kartlarım
  const ozel = ben.ozel || [];
  $('ozelKartlarim').innerHTML = ozel.map((t, i) => {
    const k = Motor.OZEL[t];
    const kullanilir = sirada && t !== 'yelek'
      && (t !== 'durbun' || (d.sonNo >= 0 && d.sonNo !== ui.benimNo && !ben.durbun))
      && (t !== 'viski' || ben.tetik > 0) && (t !== 'pas' || !d.zorunlu);
    return `<button class="ozelKart" data-tur="${t}" ${kullanilir ? '' : 'disabled'} title="${k.aciklama}">${k.emoji}<small>${t === 'yelek' ? 'Yelek (otomatik)' : k.ad}</small></button>`;
  }).join('');
  $('ozelKartlarim').hidden = !ozel.length;
  // Mumu söndüyse: domates at
  const domatesVar = !ben.canli && d.asama !== 'bitti';
  $('domatesCubugu').hidden = !domatesVar;
  if (domatesVar) {
    $('domatesCubugu').innerHTML = '<span>🍅 Domates at:</span>' + d.oyuncular.filter(p => p.canli)
      .map(p => `<button data-no="${p.no}">${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.ad)}</button>`).join('');
  }
}

function elCiz(yeni) {
  const ben = ui.durum?.oyuncular[ui.benimNo];
  const kap = $('el');
  kap.innerHTML = '';
  if (!ben?.el) return;
  // Elimde artık olmayan seçimleri bırak
  [...ui.secili].forEach(id => !ben.el.some(k => k.id === id) && ui.secili.delete(id));
  // Dağıtım sürerken sadece gelen kartlar görünür; yeni gelen kart aşağıdan kayarak girer
  const goster = ui.dagitiliyor ? ben.el.slice(0, ui.gorunenKart) : ben.el;
  goster.forEach((k, i) => {
    const b = document.createElement('button');
    const yeniKart = yeni && (!ui.dagitiliyor || i === goster.length - 1);
    b.className = 'elKart' + (ui.secili.has(k.id) ? ' secili' : '') + (yeniKart ? ' yeni' : '');
    if (yeniKart) setTimeout(() => b.classList.remove('yeni'), 900);
    b.innerHTML = `<img src="${Sahne.kartResmi(k.tur)}" alt="${Motor.AD[k.tur]}">`;
    b.addEventListener('click', () => {
      if (ui.secili.has(k.id)) ui.secili.delete(k.id);
      else if (ui.secili.size < 3) ui.secili.add(k.id);
      else return;
      Ses.sec();
      b.classList.toggle('secili', ui.secili.has(k.id));
      ciz();
    });
    kap.appendChild(b);
  });
}

function etiketleriKur() {
  const kap = $('etiketler');
  kap.innerHTML = '';
  ui.etiketler = {};
  ui.durum.oyuncular.forEach(p => {
    if (p.no === ui.benimNo) return;
    const el = document.createElement('div');
    el.className = 'etiket';
    el.innerHTML = `<div class="balon"></div><div class="kutu"><div class="ad">${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.ad)}</div><div class="bilgi"></div></div>`;
    kap.appendChild(el);
    ui.etiketler[p.no] = { el, bilgi: el.querySelector('.bilgi'), balon: el.querySelector('.balon') };
  });
  Sahne.etiketGuncelle = () => {
    for (const no in ui.etiketler) {
      const e = ui.etiketler[no];
      const k = Sahne.ekranKonumu(+no);
      e.el.style.display = k ? '' : 'none';
      if (k) e.el.style.transform = `translate(${k.x}px, ${Math.max(k.y, 118)}px) translate(-50%, -100%)`;
    }
  };
}

// Kafanın üstünde konuşma balonu. sohbet: yazılı mesajsa kendi yazdığım da ekranda görünür.
function balon(no, yazi, kirmizi, sohbet) {
  if (no === ui.benimNo) {
    mesaj(`Sen: “${yazi}”`, kirmizi ? 'kirmizi' : '', sohbet ? 2500 : 1400);
    return;
  }
  const e = ui.etiketler[no];
  if (!e) return;
  e.balon.textContent = yazi;
  e.balon.className = 'balon goster' + (kirmizi ? ' kirmizi' : '');
  if (ui.durum?.oyuncular[no]?.bot) Sahne.konus(no, Math.min(2, 0.4 + yazi.length * 0.05));
  clearTimeout(e.zaman);
  e.zaman = setTimeout(() => (e.balon.className = 'balon'), sohbet ? 3500 : 1900);
}

// Emoji tepkisi: balon + karakter hareketi
const TEPKI_HAREKET = { '😂': 'gul', '😡': 'bagir', '😱': 'zipla', '🤠': 'salla', '👍': 'salla', '🤥': 'dusun' };
function tepkiGoster(no, e) {
  if (!ui.durum || !Object.keys(TEPKI_HAREKET).includes(e)) return;
  if (no === ui.benimNo) {
    mesaj(`Sen: ${e}`, 'iri', 1200);
    return;
  }
  balon(no, e);
  Sahne.tepki(no, TEPKI_HAREKET[e], 1.4);
}

let mesajZamani = null;
function mesaj(yazi, sinif = '', sure = 2000) {
  const m = $('mesaj');
  m.textContent = yazi;
  m.className = 'goster ' + sinif;
  clearTimeout(mesajZamani);
  mesajZamani = setTimeout(() => (m.className = sinif), sure);
}

function acilanGoster(turler, v) {
  const d = ui.durum;
  const a = $('acilan');
  const atan = v.atan === ui.benimNo ? 'Sen' : adi(v.atan);
  const suclayan = v.no === ui.benimNo ? 'sen' : adi(v.no);
  a.innerHTML = `<div class="kartlar">${turler.map((t, i) => `<img src="${Sahne.kartResmi(t)}" class="${t === 'J' || t === d.masaKarti ? 'dogru' : 'yalan'}" style="animation-delay:${i * 0.15}s">`).join('')}</div>`
    + `<p>${v.yalanVar ? `🤥 Yalan! ${atan === 'Sen' ? 'Tetiği sen çekeceksin' : `${atan} tetiği çekecek`}` : `✅ Doğruymuş! ${v.no === ui.benimNo ? 'Tetiği sen çekeceksin' : `${suclayan} tetiği çekecek`}`}</p>`;
  a.hidden = false;
}

function sonuGoster(kazanan, istat) {
  const d = ui.durum;
  $('domatesCubugu').hidden = true;
  if (istat) {
    const oduller = Istatistik.oduller(istat, (d.ozelAyar || []).length > 0);
    $('oduller').innerHTML = oduller.map(o => `<div class="odul"><span>${o.emoji}</span><div><b>${o.ad}: ${guvenli(o.kim)}</b><small>${o.aciklama}</small></div></div>`).join('');
    const yeni = Istatistik.oyunBitti(istat.find(p => p.no === ui.benimNo), kazanan === ui.benimNo);
    $('yeniRozet').innerHTML = yeni.map(r => `<div class="rozet var"><span>${r.emoji}</span><b>Yeni rozet: ${r.ad}</b><small>${r.aciklama}</small></div>`).join('');
  }
  $('olumPerdesi').hidden = true;
  $('sonEkran').hidden = false;
  const misafir = online() && Ag.mod === 'misafir';
  $('tekrarBtn').hidden = misafir;
  $('sonBekle').hidden = !misafir;
  if (kazanan === ui.benimNo) {
    Ses.kazandin();
    $('sonBaslik').textContent = '🏆 Kazandın!';
    $('sonYazi').textContent = 'Masada mumu yanan bir tek sen kaldın. Yalanın yatsıya kadar dayandı!';
  } else {
    const p = d.oyuncular[kazanan];
    $('sonBaslik').textContent = `🏆 ${p ? `${Karakterler.BILGI[p.karakter].emoji} ${p.ad}` : 'Kimse'} kazandı`;
    $('sonYazi').textContent = 'Saloonda mumu yanan son kişi o oldu.';
  }
}

// Süre çubuğu
setInterval(() => {
  const d = ui.durum;
  const c = $('sureCubugu').firstElementChild;
  if (!d || d.asama !== 'oyun' || d.sira !== ui.benimNo) { c.style.width = '0'; return; }
  const kalan = Math.max(0, (d.bitis - Date.now()) / (Motor.SURE * 1000));
  c.style.width = `${kalan * 100}%`;
  if (kalan < 0.25 && Math.round(Date.now() / 250) % 4 === 0) Ses.tikTak();
}, 250);

// ---------- Düğmeler ----------
$('atBtn').addEventListener('click', () => {
  if (Masa.oyna(ui.benimNo, [...ui.secili]) && Masa === Motor) ui.secili.clear();
});
$('yalanciBtn').addEventListener('click', () => Masa.yalanci(ui.benimNo));
$('menuBtn').addEventListener('click', () => {
  const soru = online() ? (Ag.mod === 'ev' ? 'Odayı kapatıp ana menüye dönülsün mü? (Arkadaşlarının oyunu da biter)' : 'Odadan çıkılsın mı? (Yerine bot oynar, aynı adla geri girebilirsin)') : 'Oyundan çıkıp ana menüye dönülsün mü?';
  if ((!Motor.aktif && !online()) || confirm(soru)) menuyeDon();
});
$('olumMenuBtn').addEventListener('click', () => (online() ? ($('olumPerdesi').hidden = true) : menuyeDon()));
$('sonMenuBtn').addEventListener('click', menuyeDon);
$('tekrarBtn').addEventListener('click', () => {
  if (online()) Ag.oyunuBaslat();
  else {
    Motor.yeni(ui.son, olayGeldi, ui.sonAyar);
    oyunEkraniniKur(Motor.gorunum(0), 0);
  }
});
document.querySelectorAll('#tepkiler button').forEach(b => b.addEventListener('click', () => {
  Ses.sec();
  Ag.tepkiGonder(b.textContent);
}));
$('ozelKartlarim').addEventListener('click', e => {
  const b = e.target.closest('button[data-tur]');
  if (!b || b.disabled) return;
  Ses.sec();
  Masa.ozelKullan(ui.benimNo, b.dataset.tur);
});
$('domatesCubugu').addEventListener('click', e => {
  const b = e.target.closest('button[data-no]');
  if (b) domatesFirlat(+b.dataset.no);
});
function sesDugmesi() {
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('muzikBtn').classList.toggle('kapali', !Ses.muzikAcik);
}
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
$('muzikBtn').addEventListener('click', () => { Ses.muzikAc(!Ses.muzikAcik); sesDugmesi(); });
sesDugmesi();

Sahne.baslat($('sahne'));
menuKur();
