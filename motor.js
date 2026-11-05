// =============================================================
// Yalancının Mumu - oyun motoru: kurallar, sıra, tabanca ruleti ve botlar
// Ekrandan bağımsızdır (ileride online oyunda oda sahibinin telefonunda çalışacak).
//
// Kurallar:
//   - Deste 20 kart: 6 Papaz, 6 Kız, 6 As, 2 Joker. Joker her kartın yerine geçer.
//   - Her el başında ayakta kalan herkese 5 kart dağıtılır ve bir "masa kartı" seçilir (Papaz/Kız/As).
//   - Sırası gelen 1-3 kartı kapalı atar ve "bunlar masa kartı" der (yalan da olabilir).
//   - Sıradaki ya kendi kartlarını atar (inanır) ya da "Yalancı!" der: son atılan kartlar açılır.
//     İçinde masa kartı ve joker dışında kart varsa atan, yoksa suçlayan tetiği çeker.
//   - Herkesin kendi tabancası var: 6 haznede 1 mermi. Her çekişte ihtimal artar (1/6, 1/5 ... 1/1).
//   - Mermi gelenin mumu söner, oyundan çıkar. Tetikten sonra yeni el dağıtılır.
//   - Elinde kart kalmayan sırada atlanır. Elinde kart olan tek kişi kaldıysa o "Yalancı!" demek zorunda.
//   - Mumu en son yanan kazanır.
// =============================================================

const Motor = (() => {
  const TURLER = ['P', 'K', 'A'];              // masa kartı olabilecekler
  const AD = { P: 'Papaz', K: 'Kız', A: 'As', J: 'Joker' };
  const EL_KART = 5;
  const SURE = 30;                             // insan oyuncunun düşünme süresi (sn)
  const BEKLE = { acilis: 2600, tetikHazir: 1400, tetik: 2700, sonra: 2600, dagit: 1200 };

  let o = null;                                 // oyun durumu
  let dinleyici = () => {};
  let zamanlayici = null, sayacZamani = null, botZamani = null;

  const rastgele = n => Math.floor(Math.random() * n);
  const karistir = d => {
    for (let i = d.length - 1; i > 0; i--) {
      const j = rastgele(i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  };
  const dogruMu = kart => kart.tur === 'J' || kart.tur === o.masaKarti;
  const canlilar = () => o.oyuncular.filter(p => p.canli);

  function olay(tip, veri = {}) {
    dinleyici(tip, veri);
  }

  // ---------- Kurulum ----------
  // oyuncular: [{ ad, karakter, bot }]
  function yeni(oyuncular, dinle) {
    temizle();
    dinleyici = dinle || (() => {});
    o = {
      oyuncular: oyuncular.map((p, no) => ({
        no, ad: p.ad, karakter: p.karakter, bot: !!p.bot,
        el: [], canli: true, tetik: 0, mermi: rastgele(6),
        cesaret: p.cesaret ?? 0.4 + Math.random() * 0.4,   // botun kişiliği: ne kadar blöf yapar / suçlar
      })),
      masaKarti: 'K', sira: 0, son: null, yigin: 0, iddiaToplam: 0,
      asama: 'dagit', elNo: 0, cezali: null, kazanan: null, sonAcilan: null, bitis: 0,
    };
    setTimeout(() => elDagit(rastgele(oyuncular.length)), 300);
    return o;
  }

  function temizle() {
    clearTimeout(zamanlayici);
    clearTimeout(botZamani);
    clearInterval(sayacZamani);
    zamanlayici = botZamani = sayacZamani = null;
  }

  function elDagit(baslayan) {
    o.elNo++;
    o.asama = 'oyun';
    o.son = null;
    o.yigin = 0;
    o.iddiaToplam = 0;
    o.cezali = null;
    o.sonAcilan = null;
    o.masaKarti = TURLER[rastgele(3)];
    const deste = [];
    let id = 0;
    for (const t of TURLER) for (let i = 0; i < 6; i++) deste.push({ id: id++, tur: t });
    deste.push({ id: id++, tur: 'J' }, { id: id++, tur: 'J' });
    karistir(deste);
    o.oyuncular.forEach(p => (p.el = p.canli ? deste.splice(0, EL_KART) : []));
    o.sira = siradakiCanli(baslayan, true);
    olay('el', { elNo: o.elNo, masaKarti: o.masaKarti, sira: o.sira });
    siraBaslat();
  }

  // no'dan başlayarak (dahil ya da hariç) ayakta olan ilk oyuncu
  function siradakiCanli(no, dahil) {
    const n = o.oyuncular.length;
    for (let k = dahil ? 0 : 1; k <= n; k++) {
      const p = o.oyuncular[(no + k) % n];
      if (p.canli) return p.no;
    }
    return no;
  }

  // Sıradaki kartı olan oyuncu
  function siradakiKartli(no) {
    const n = o.oyuncular.length;
    for (let k = 1; k <= n; k++) {
      const p = o.oyuncular[(no + k) % n];
      if (p.canli && p.el.length) return p.no;
    }
    return -1;
  }

  // Bu oyuncu "Yalancı!" demek zorunda mı? (Elinde kart olan bir tek o kaldıysa)
  function zorunlu(no) {
    return !!o.son && o.oyuncular.every(p => p.no === no || !p.canli || !p.el.length);
  }

  function siraBaslat() {
    clearInterval(sayacZamani);
    clearTimeout(botZamani);
    const p = o.oyuncular[o.sira];
    o.bitis = Date.now() + SURE * 1000;
    olay('sira', { no: o.sira, zorunlu: zorunlu(o.sira), bitis: o.bitis });
    if (p.bot) {
      botZamani = setTimeout(() => botOyna(p), 1500 + Math.random() * 1800);
    } else {
      // Süre biterse: zorunluysa "Yalancı!", değilse rastgele 1 kart atılır
      sayacZamani = setInterval(() => {
        if (o.asama !== 'oyun' || o.sira !== p.no || Date.now() < o.bitis) return;
        clearInterval(sayacZamani);
        if (zorunlu(p.no)) yalanci(p.no);
        else oyna(p.no, [p.el[rastgele(p.el.length)].id]);
      }, 250);
    }
  }

  // ---------- Hamleler ----------
  function oyna(no, kartIdleri) {
    if (!o || o.asama !== 'oyun' || o.sira !== no) return false;
    const p = o.oyuncular[no];
    const ids = [...new Set(kartIdleri)];
    if (ids.length < 1 || ids.length > 3 || zorunlu(no)) return false;
    const kartlar = ids.map(id => p.el.find(k => k.id === id));
    if (kartlar.some(k => !k)) return false;
    p.el = p.el.filter(k => !ids.includes(k.id));
    if (o.son) o.yigin += o.son.kartlar.length;
    o.son = { no, kartlar };
    o.iddiaToplam += kartlar.length;
    clearInterval(sayacZamani);
    olay('oynadi', { no, adet: kartlar.length, kalan: p.el.length, masaKarti: o.masaKarti, r: Math.random() });
    const sonraki = siradakiKartli(no);
    if (sonraki === -1) {
      // Kimsede kart kalmadı (olmaz ama): son atanı sıradaki suçlasın
      o.sira = siradakiCanli(no, false);
    } else o.sira = sonraki;
    zamanlayici = setTimeout(siraBaslat, 700);
    return true;
  }

  function yalanci(no) {
    if (!o || o.asama !== 'oyun' || o.sira !== no || !o.son) return false;
    clearInterval(sayacZamani);
    clearTimeout(botZamani);
    o.asama = 'acilis';
    const atan = o.son.no;
    const yalanVar = o.son.kartlar.some(k => !dogruMu(k));
    o.cezali = yalanVar ? atan : no;
    o.sonAcilan = { atan, kartlar: o.son.kartlar, yalanVar };
    olay('yalanci', { no, atan, kartlar: o.son.kartlar, yalanVar, cezali: o.cezali, r: Math.random() });
    zamanlayici = setTimeout(tetikHazirla, BEKLE.acilis);
    return true;
  }

  function tetikHazirla() {
    o.asama = 'tetik';
    const p = o.oyuncular[o.cezali];
    olay('tetikHazir', { no: p.no, tetik: p.tetik, ihtimal: 1 / (6 - p.tetik) });
    zamanlayici = setTimeout(tetikCek, BEKLE.tetikHazir + BEKLE.tetik);
  }

  function tetikCek() {
    const p = o.oyuncular[o.cezali];
    const oldu = p.tetik === p.mermi;
    p.tetik++;
    if (oldu) {
      p.canli = false;
      p.el = [];
    }
    olay('tetik', { no: p.no, oldu, tetik: p.tetik, r: Math.random() });
    zamanlayici = setTimeout(() => {
      const kalan = canlilar();
      if (kalan.length <= 1) {
        o.asama = 'bitti';
        o.kazanan = kalan[0]?.no ?? -1;
        olay('bitti', { kazanan: o.kazanan });
        return;
      }
      o.asama = 'dagit';
      olay('elBitti', {});
      zamanlayici = setTimeout(() => elDagit(p.canli ? p.no : siradakiCanli(p.no, false)), BEKLE.dagit);
    }, BEKLE.sonra);
  }

  // ---------- Botlar ----------
  function botOyna(p) {
    if (o.asama !== 'oyun' || o.sira !== p.no) return;
    if (o.son && botSuclarMi(p)) {
      yalanci(p.no);
      return;
    }
    oyna(p.no, botKartSec(p));
  }

  function botSuclarMi(p) {
    if (zorunlu(p.no)) return true;
    const iddia = o.son.kartlar.length;
    const benimDogru = p.el.filter(dogruMu).length;
    const disarida = 8 - benimDogru;                     // başkalarında olabilecek en fazla doğru kart
    if (iddia > disarida) return true;                   // kesin yalan
    if (o.iddiaToplam > disarida + 1) return Math.random() < 0.8;
    const atan = o.oyuncular[o.son.no];
    let ihtimal = 0.12 + (iddia - 1) * 0.14;
    ihtimal += (benimDogru >= 3 ? 0.15 : 0) + (benimDogru === 0 ? 0.18 : 0);
    ihtimal += (o.iddiaToplam > disarida - 2 ? 0.15 : 0);
    ihtimal += (atan.el.length === 0 ? 0.08 : 0);
    ihtimal += (p.cesaret - 0.6) * 0.3;
    ihtimal -= p.tetik * 0.03;                           // tetiği çok çekmiş olan temkinli
    return Math.random() < Math.max(0.05, Math.min(0.85, ihtimal));
  }

  function botKartSec(p) {
    const dogru = p.el.filter(dogruMu).sort((a, b) => (a.tur === 'J') - (b.tur === 'J'));  // jokerler sona
    const yanlis = p.el.filter(k => !dogruMu(k));
    if (!dogru.length) {
      const n = Math.random() < 0.7 || yanlis.length < 2 ? 1 : 2;
      return karistir([...yanlis]).slice(0, n).map(k => k.id);
    }
    // Ara sıra elinde doğru varken de blöf: doğruların yanına bir yanlış katar
    let n = Math.min(dogru.length, 1 + rastgele(Math.min(3, dogru.length)));
    const secim = dogru.slice(0, n);
    if (yanlis.length && secim.length < 3 && Math.random() < p.cesaret * 0.35) secim.push(yanlis[rastgele(yanlis.length)]);
    // Elde sadece yanlışlar kalacaksa ve fazla doğru varsa biraz daha doğru at
    return secim.map(k => k.id);
  }

  // ---------- Dışarıya gösterilen hâl ----------
  // no numaralı oyuncu ne görür: başkalarının kartları ve mermi yerleri gizli
  function gorunum(no) {
    if (!o) return null;
    return {
      masaKarti: o.masaKarti, sira: o.sira, asama: o.asama, elNo: o.elNo, yigin: o.yigin,
      sonAdet: o.son ? o.son.kartlar.length : 0, sonNo: o.son ? o.son.no : -1,
      cezali: o.cezali, kazanan: o.kazanan, bitis: o.bitis, sonAcilan: o.sonAcilan,
      zorunlu: o.asama === 'oyun' && zorunlu(o.sira),
      oyuncular: o.oyuncular.map(p => ({
        no: p.no, ad: p.ad, karakter: p.karakter, bot: p.bot, yedekBot: !!p.yedekBot, canli: p.canli, tetik: p.tetik,
        kartSayisi: p.el.length, el: p.no === no ? p.el : null,
      })),
    };
  }

  // Online: oyundan çıkanın yerine bot oynar (evet), geri gelince bot bırakır (hayır)
  function botYap(no, evet) {
    const p = o?.oyuncular[no];
    if (!p || p.bot === evet) return;
    p.bot = evet;
    p.yedekBot = evet;
    if (o.asama === 'oyun' && o.sira === no) {
      clearInterval(sayacZamani);
      clearTimeout(botZamani);
      if (evet) botZamani = setTimeout(() => botOyna(p), 1200);
      else siraBaslat();
    }
  }

  return {
    yeni, temizle, oyna, yalanci, gorunum, botYap, AD, SURE,
    get aktif() { return !!o && o.asama !== 'bitti'; },
  };
})();
