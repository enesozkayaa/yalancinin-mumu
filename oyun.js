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
  const oyuncular = [{ ad, karakter: ui.karakter, bot: false }];
  for (let i = 0; i < 3; i++) oyuncular.push({ ad: Karakterler.BILGI[kalan[i]].ad, karakter: kalan[i], bot: true });
  ui.son = oyuncular;
  Masa = Motor;
  Motor.yeni(oyuncular, olayGeldi);
  oyunEkraniniKur(Motor.gorunum(0), 0);
}

// Oyun ekranını aç ve sahneyi kur (tek başına, oda sahibi ve odaya katılan için ortak)
function oyunEkraniniKur(d, benimNo) {
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
    Ses.dagit();
    mesaj(`${masaAdi(v.masaKarti).toLocaleUpperCase('tr')} MASASI`, 'iri', 1800);
    $('masaKarti').classList.remove('yeni');
    void $('masaKarti').offsetWidth;
    $('masaKarti').classList.add('yeni');
    elCiz(true);
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
    if (v.kalan === 0) setTimeout(() => mesaj(`${adi(v.no)} kartlarını bitirdi`, '', 1500), 600);
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
      mesaj(v.no === ui.benimNo ? 'BAM! Mumun söndü 🕯️' : `BAM! ${adi(v.no)}'in mumu söndü 🕯️`, 'iri kirmizi', 2400);
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
  } else if (tip === 'bitti') {
    setTimeout(() => sonuGoster(v.kazanan), 1200);
  }
  ciz();
}

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
    e.bilgi.textContent = p.canli ? `🃏 ${p.kartSayisi} · 🔫 ${p.tetik}/6${bot}${ses}` : '🕯️ mumu söndü';
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
}

function elCiz(yeni) {
  const ben = ui.durum?.oyuncular[ui.benimNo];
  const kap = $('el');
  kap.innerHTML = '';
  if (!ben?.el) return;
  // Elimde artık olmayan seçimleri bırak
  [...ui.secili].forEach(id => !ben.el.some(k => k.id === id) && ui.secili.delete(id));
  ben.el.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'elKart' + (ui.secili.has(k.id) ? ' secili' : '') + (yeni ? ' yeni' : '');
    if (yeni) {
      b.style.animationDelay = `${i * 0.08}s`;
      setTimeout(() => b.classList.remove('yeni'), 900 + i * 80);
    }
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

function sonuGoster(kazanan) {
  const d = ui.durum;
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
    Motor.yeni(ui.son, olayGeldi);
    oyunEkraniniKur(Motor.gorunum(0), 0);
  }
});
document.querySelectorAll('#tepkiler button').forEach(b => b.addEventListener('click', () => {
  Ses.sec();
  Ag.tepkiGonder(b.textContent);
}));
function sesDugmesi() {
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('muzikBtn').classList.toggle('kapali', !Ses.muzikAcik);
}
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
$('muzikBtn').addEventListener('click', () => { Ses.muzikAc(!Ses.muzikAcik); sesDugmesi(); });
sesDugmesi();

Sahne.baslat($('sahne'));
menuKur();
