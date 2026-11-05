// =============================================================
// Yalancının Mumu - ekran: menü, karakter seçimi, el kartları, düğmeler, mesajlar
// Motor'dan gelen olaylara göre sahneyi oynatır (kart atma, açma, tabanca, mum).
// =============================================================

const $ = id => document.getElementById(id);
const ANAHTAR_AD = 'yalancininMumu.ad';
const ANAHTAR_KARAKTER = 'yalancininMumu.karakter';
const kayitOku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch (e) { return v; } };
const kayitYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) { /* yok */ } };

const ui = {
  benimNo: 0,
  durum: null,
  secili: new Set(),
  karakter: kayitOku(ANAHTAR_KARAKTER, 'horoz'),
  etiketler: {},
  bakisSayac: { no: -1, sure: 0 },
  ozelBakis: {},       // bot no -> bu zamana kadar bana bakar
};

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
    b.addEventListener('click', () => { ui.karakter = t; kayitYaz(ANAHTAR_KARAKTER, t); karakterGoster(); Ses.sec(); });
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
  // Botlar benden farklı karakterleri rastgele alır
  const kalan = Karakterler.TURLER.filter(t => t !== ui.karakter).sort(() => Math.random() - 0.5);
  const oyuncular = [{ ad, karakter: ui.karakter, bot: false }];
  for (let i = 0; i < 3; i++) oyuncular.push({ ad: Karakterler.BILGI[kalan[i]].ad, karakter: kalan[i], bot: true });
  ui.son = oyuncular;
  oyunuBaslat(oyuncular);
}

function oyunuBaslat(oyuncular) {
  ui.benimNo = 0;
  ui.secili.clear();
  $('menu').hidden = true;
  $('oyun').hidden = false;
  $('sonEkran').hidden = true;
  $('olumPerdesi').hidden = true;
  $('acilan').hidden = true;
  $('sahne').classList.remove('olu');
  $('el').innerHTML = '';
  Motor.yeni(oyuncular, olayGeldi);
  ui.durum = Motor.gorunum(ui.benimNo);
  Sahne.kur(ui.durum.oyuncular, ui.benimNo);
  etiketleriKur();
  ciz();
}

function menuyeDon() {
  Motor.temizle();
  $('oyun').hidden = true;
  $('menu').hidden = false;
  $('sahne').classList.remove('olu');
}

// ---------- Olaylar ----------
const adi = no => ui.durum.oyuncular[no].ad;
const masaAdi = t => Motor.AD[t];

function olayGeldi(tip, v) {
  ui.durum = Motor.gorunum(ui.benimNo);
  const d = ui.durum;
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
    balon(v.no, `${v.adet} ${masaAdi(v.masaKarti)}!`);
    if (v.no === ui.benimNo) { ui.secili.clear(); elCiz(); }
    // Biri kartlarını bitirdiyse
    if (v.kalan === 0) setTimeout(() => mesaj(`${adi(v.no)} kartlarını bitirdi`, '', 1500), 600);
    // Botlardan biri şüpheyle bakar
    const bakan = d.oyuncular.filter(p => p.bot && p.canli && p.no !== v.no);
    if (bakan.length && Math.random() < 0.6) Sahne.tepki(bakan[Math.floor(Math.random() * bakan.length)].no, 'dusun', 1.6);
  } else if (tip === 'yalanci') {
    balon(v.no, 'YALANCI!', true);
    Sahne.tepki(v.no, 'bagir', 1.2);
    Sahne.tepki(v.atan, 'zipla', 1);
    Ses.yalanci();
    d.oyuncular.forEach(p => p.no !== v.no && Sahne.bak(p.no, v.atan));
    Sahne.bak(v.no, v.atan);
    const turler = v.kartlar.map(k => k.tur);
    setTimeout(() => {
      Sahne.kartlariAc(turler, v.yalanVar, d.masaKarti);
      Ses.kartAc(turler.length);
      acilanGoster(turler, v);
    }, 700);
    setTimeout(() => {
      v.yalanVar ? Ses.yalanCikti() : Ses.dogruCikti();
      Sahne.tepki(v.yalanVar ? v.no : v.atan, 'gul', 1.6);
    }, 1500);
  } else if (tip === 'tetikHazir') {
    $('acilan').hidden = true;
    Sahne.tabancaKaldir(v.no);
    Ses.topDon();
    setTimeout(() => Ses.gerilim(), 500);
    const kesir = `1/${6 - v.tetik}`;
    mesaj(v.no === ui.benimNo ? `Tetiği sen çekiyorsun… (ihtimal ${kesir})` : `${adi(v.no)} tetiği çekiyor… (ihtimal ${kesir})`, 'kirmizi', 3600);
    Sahne.tepki(v.no, 'titre', 3.8);
    d.oyuncular.forEach(p => p.no !== v.no && Sahne.bak(p.no, v.no));
    Sahne.bak(v.no, 'masa');
  } else if (tip === 'tetik') {
    Sahne.tetikSonuc(v.no, v.oldu);
    if (v.oldu) {
      Ses.bam();
      setTimeout(Ses.mum, 500);
      mesaj(v.no === ui.benimNo ? 'BAM! Mumun söndü 🕯️' : `BAM! ${adi(v.no)}'in mumu söndü 🕯️`, 'iri kirmizi', 2400);
      if (v.no === ui.benimNo) {
        $('sahne').classList.add('olu');
        setTimeout(() => ($('olumPerdesi').hidden = false), 1600);
      }
      // Hayatta kalanlardan biri güler, akbaba sevinir :)
      d.oyuncular.filter(p => p.canli && p.bot).forEach(p => Math.random() < 0.5 && Sahne.tepki(p.no, p.karakter === 'akbaba' ? 'gul' : 'zipla', 1.4));
    } else {
      Ses.tik();
      mesaj(`TIK! ${v.no === ui.benimNo ? 'Kurtuldun' : 'Kurtuldu'}… (${v.tetik}/6)`, 'iri', 2000);
      d.oyuncular.filter(p => p.canli && p.bot && p.no !== v.no).forEach(p => Math.random() < 0.4 && Sahne.tepki(p.no, 'gul', 1.2));
    }
  } else if (tip === 'bitti') {
    setTimeout(() => sonuGoster(v.kazanan), 1200);
  }
  ciz();
}

// Botların bakışları: sıradakine bakarlar, sıradaki bot kartlarına bakar.
// Ben bir bota bir süre bakarsam o da bana bakar.
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
  if (no === ui.bakisSayac.no && no >= 0) {
    ui.bakisSayac.sure += 0.3;
    if (ui.bakisSayac.sure > 1 && !(ui.ozelBakis[no] > performance.now())) {
      ui.ozelBakis[no] = performance.now() + 2000;
      Sahne.bak(no, ui.benimNo);
      if (Math.random() < 0.35) Sahne.tepki(no, Math.random() < 0.5 ? 'dusun' : 'gul', 1.2);
    }
  } else ui.bakisSayac = { no, sure: 0 };
  bakislar();
}, 300);

// ---------- Çizim ----------
function ciz() {
  const d = ui.durum;
  if (!d) return;
  Sahne.kartSayilari(d.oyuncular);
  // Masa kartı
  $('masaKarti').innerHTML = `<img src="${Sahne.kartResmi(d.masaKarti)}" alt=""><div>${masaAdi(d.masaKarti).toLocaleUpperCase('tr')} MASASI<small>El ${d.elNo} · ${d.oyuncular.filter(p => p.canli).length} mum yanıyor</small></div>`;
  // Etiketler
  d.oyuncular.forEach(p => {
    const e = ui.etiketler[p.no];
    if (!e) return;
    e.el.classList.toggle('sirada', d.asama === 'oyun' && d.sira === p.no);
    e.el.classList.toggle('olu', !p.canli);
    e.bilgi.textContent = p.canli ? `🃏 ${p.kartSayisi} · 🔫 ${p.tetik}/6` : '🕯️ mumu söndü';
  });
  // Benim bilgim ve düğmeler
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
  ben.el.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'elKart' + (ui.secili.has(k.id) ? ' secili' : '') + (yeni ? ' yeni' : '');
    if (yeni) b.style.animationDelay = `${i * 0.08}s`;
    if (yeni) setTimeout(() => b.classList.remove('yeni'), 900 + i * 80);  // animasyon takılırsa da kart görünsün
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

function balon(no, yazi, kirmizi) {
  if (no === ui.benimNo) {
    mesaj(`Sen: “${yazi}”`, kirmizi ? 'kirmizi' : '', 1400);
    return;
  }
  const e = ui.etiketler[no];
  if (!e) return;
  e.balon.textContent = yazi;
  e.balon.className = 'balon goster' + (kirmizi ? ' kirmizi' : '');
  clearTimeout(e.zaman);
  e.zaman = setTimeout(() => (e.balon.className = 'balon'), 1900);
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

const guvenli = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  if (Motor.oyna(ui.benimNo, [...ui.secili])) ui.secili.clear();
});
$('yalanciBtn').addEventListener('click', () => Motor.yalanci(ui.benimNo));
$('menuBtn').addEventListener('click', () => {
  if (!Motor.aktif || confirm('Oyundan çıkıp ana menüye dönülsün mü?')) menuyeDon();
});
$('olumMenuBtn').addEventListener('click', menuyeDon);
$('sonMenuBtn').addEventListener('click', menuyeDon);
$('tekrarBtn').addEventListener('click', () => oyunuBaslat(ui.son));
function sesDugmesi() { $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇'; }
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
sesDugmesi();

Sahne.baslat($('sahne'));
menuKur();
