// =============================================================
// Yalancının Mumu - oyun motoru: kurallar, sıra, tabanca ruleti, özel kartlar, istatistikler, botlar
// Ekrandan bağımsızdır (online oyunda oda sahibinin cihazında çalışır).
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
// Özel kartlar (oyun başında seçilirse): her el ayaktakilerden birine 1 özel kart gelir (en fazla 2 tutulur).
//   👀 Dürbün: son atılan kartlardan birini gizlice görürsün.
//   🔄 Ters yön: sıra ters yöne döner.
//   🏃 Pas: kart atmadan sırayı sonrakine bırakırsın (son atılanı o suçlar ya da inanır).
//   🥃 Viski: tabancanı sıfırlar, ihtimal yeniden 1/6 olur.
//   🛡️ Çelik yelek: bir kez tetik çekmekten kurtarır (kendiliğinden kullanılır).
// =============================================================

const Motor = (() => {
  const TURLER = ['P', 'K', 'A'];
  const AD = { P: 'Papaz', K: 'Kız', A: 'As', J: 'Joker' };
  const OZEL = {
    durbun: { ad: 'Dürbün', emoji: '👀', aciklama: 'Son atılan kartlardan birini gizlice görürsün.' },
    ters:   { ad: 'Ters yön', emoji: '🔄', aciklama: 'Sıra ters yöne döner.' },
    pas:    { ad: 'Pas', emoji: '🏃', aciklama: 'Kart atmadan sırayı sonrakine bırakırsın.' },
    viski:  { ad: 'Viski', emoji: '🥃', aciklama: 'Tabancan sıfırlanır, ihtimal yeniden 1/6 olur.' },
    yelek:  { ad: 'Çelik yelek', emoji: '🛡️', aciklama: 'Bir kez tetik çekmekten kurtarır (kendiliğinden).' },
  };
  const EL_KART = 5;
  const SURE = 30;
  const BEKLE = { acilis: 2600, tetikHazir: 1400, tetik: 2700, sonra: 2600, dagit: 1200 };

  let o = null;
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
  const olay = (tip, veri = {}) => dinleyici(tip, veri);

  // ---------- Kurulum ----------
  // oyuncular: [{ ad, karakter, bot, kiyafet }], ayar: { ozel: ['durbun', ...] }
  function yeni(oyuncular, dinle, ayar = {}) {
    temizle();
    dinleyici = dinle || (() => {});
    o = {
      oyuncular: oyuncular.map((p, no) => ({
        no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet || null, bot: !!p.bot,
        el: [], canli: true, tetik: 0, mermi: rastgele(6), ozel: [], durbun: null,
        cesaret: p.cesaret ?? 0.4 + Math.random() * 0.4,
        istat: { yalan: 0, yakalandi: 0, yakaladi: 0, bosSuclama: 0, yutturdu: 0, tetik: 0, kurtuldu: 0, ozel: 0, yelek: 0, olumSirasi: 0 },
      })),
      ayar: { ozel: (ayar.ozel || []).filter(t => OZEL[t]) },
      masaKarti: 'K', sira: 0, yon: 1, son: null, yigin: 0, iddiaToplam: 0, olenSayisi: 0,
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
    o.oyuncular.forEach(p => {
      p.el = p.canli ? deste.splice(0, EL_KART) : [];
      p.durbun = null;
    });
    o.sira = siradakiCanli(baslayan, true);
    olay('el', { elNo: o.elNo, masaKarti: o.masaKarti, sira: o.sira });
    // Özel kart: ayaktakilerden birine (elinde 2'den az olan)
    if (o.ayar.ozel.length) {
      const adaylar = canlilar().filter(p => p.ozel.length < 2);
      if (adaylar.length) {
        const p = adaylar[rastgele(adaylar.length)];
        p.ozel.push(o.ayar.ozel[rastgele(o.ayar.ozel.length)]);
        setTimeout(() => olay('ozelGeldi', { no: p.no }), 900);
      }
    }
    siraBaslat();
  }

  // no'dan başlayarak sıranın yönünde (dahil ya da hariç) ayakta olan ilk oyuncu
  function siradakiCanli(no, dahil) {
    const n = o.oyuncular.length;
    for (let k = dahil ? 0 : 1; k <= n; k++) {
      const p = o.oyuncular[(((no + k * o.yon) % n) + n) % n];
      if (p.canli) return p.no;
    }
    return no;
  }
  function siradakiKartli(no) {
    const n = o.oyuncular.length;
    for (let k = 1; k <= n; k++) {
      const p = o.oyuncular[(((no + k * o.yon) % n) + n) % n];
      if (p.canli && p.el.length) return p.no;
    }
    return -1;
  }

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
    // Önceki yalan kimse suçlamadan geçtiyse: yutturdu
    if (o.son) {
      o.yigin += o.son.kartlar.length;
      if (o.son.yalan) o.oyuncular[o.son.no].istat.yutturdu++;
    }
    const yalan = kartlar.some(k => !dogruMu(k));
    if (yalan) p.istat.yalan++;
    o.son = { no, kartlar, yalan };
    o.iddiaToplam += kartlar.length;
    clearInterval(sayacZamani);
    olay('oynadi', { no, adet: kartlar.length, kalan: p.el.length, masaKarti: o.masaKarti, r: Math.random() });
    const sonraki = siradakiKartli(no);
    o.sira = sonraki === -1 ? siradakiCanli(no, false) : sonraki;
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
    if (yalanVar) {
      o.oyuncular[atan].istat.yakalandi++;
      o.oyuncular[no].istat.yakaladi++;
    } else o.oyuncular[no].istat.bosSuclama++;
    o.sonAcilan = { atan, kartlar: o.son.kartlar, yalanVar };
    olay('yalanci', { no, atan, kartlar: o.son.kartlar, yalanVar, cezali: o.cezali, r: Math.random() });
    zamanlayici = setTimeout(tetikHazirla, BEKLE.acilis);
    return true;
  }

  // Özel kart kullan (yelek elle kullanılmaz)
  function ozelKullan(no, tur) {
    if (!o || o.asama !== 'oyun' || o.sira !== no) return false;
    const p = o.oyuncular[no];
    const i = p.ozel.indexOf(tur);
    if (i < 0 || tur === 'yelek') return false;
    if (tur === 'durbun') {
      if (!o.son || o.son.no === no) return false;
      p.durbun = { tur: o.son.kartlar[rastgele(o.son.kartlar.length)].tur, sonNo: o.son.no, adet: o.son.kartlar.length };
    } else if (tur === 'ters') {
      o.yon *= -1;
    } else if (tur === 'pas') {
      if (zorunlu(no)) return false;
      const sonraki = siradakiKartli(no);
      if (sonraki === -1 || sonraki === no) return false;
    } else if (tur === 'viski') {
      if (!p.tetik) return false;
      p.tetik = 0;
      p.mermi = rastgele(6);
    }
    p.ozel.splice(i, 1);
    p.istat.ozel++;
    olay('ozelKullandi', { no, tur, yon: o.yon });
    if (tur === 'pas') {
      clearInterval(sayacZamani);
      clearTimeout(botZamani);
      o.sira = siradakiKartli(no);
      zamanlayici = setTimeout(siraBaslat, 600);
    } else if (p.bot) {
      botZamani = setTimeout(() => botOyna(p, true), 1300);
    }
    return true;
  }

  function tetikHazirla() {
    const p = o.oyuncular[o.cezali];
    // Çelik yelek: tetik çekilmez
    const y = p.ozel.indexOf('yelek');
    if (y >= 0) {
      p.ozel.splice(y, 1);
      p.istat.yelek++;
      o.asama = 'tetik';
      olay('yelek', { no: p.no });
      zamanlayici = setTimeout(() => sonrakiEl(p), BEKLE.sonra + 600);
      return;
    }
    o.asama = 'tetik';
    olay('tetikHazir', { no: p.no, tetik: p.tetik, ihtimal: 1 / (6 - p.tetik) });
    zamanlayici = setTimeout(tetikCek, BEKLE.tetikHazir + BEKLE.tetik);
  }

  function tetikCek() {
    const p = o.oyuncular[o.cezali];
    const oldu = p.tetik === p.mermi;
    p.tetik++;
    p.istat.tetik++;
    if (oldu) {
      p.canli = false;
      p.el = [];
      p.istat.olumSirasi = ++o.olenSayisi;
    } else p.istat.kurtuldu++;
    olay('tetik', { no: p.no, oldu, tetik: p.tetik, r: Math.random() });
    zamanlayici = setTimeout(() => sonrakiEl(p), BEKLE.sonra);
  }

  function sonrakiEl(p) {
    const kalan = canlilar();
    if (kalan.length <= 1) {
      o.asama = 'bitti';
      o.kazanan = kalan[0]?.no ?? -1;
      olay('bitti', { kazanan: o.kazanan, istat: o.oyuncular.map(x => ({ no: x.no, ad: x.ad, karakter: x.karakter, bot: x.bot && !x.yedekBot, ...x.istat })) });
      return;
    }
    o.asama = 'dagit';
    olay('elBitti', {});
    zamanlayici = setTimeout(() => elDagit(p.canli ? p.no : siradakiCanli(p.no, false)), BEKLE.dagit);
  }

  // ---------- Botlar ----------
  function botOyna(p, ozelSonrasi) {
    if (o.asama !== 'oyun' || o.sira !== p.no) return;
    // Özel kart kullanma (her turda en fazla bir tane)
    if (!ozelSonrasi && p.ozel.length) {
      if (p.ozel.includes('viski') && p.tetik >= 2 && ozelKullan(p.no, 'viski')) return;
      if (p.ozel.includes('durbun') && o.son && o.son.no !== p.no && Math.random() < 0.8 && ozelKullan(p.no, 'durbun')) return;
      const dogruYok = !p.el.some(dogruMu);
      if (p.ozel.includes('pas') && o.son && dogruYok && Math.random() < 0.6 && ozelKullan(p.no, 'pas')) return;
      if (p.ozel.includes('ters') && Math.random() < 0.15 && ozelKullan(p.no, 'ters')) return;
    }
    if (o.son && botSuclarMi(p)) {
      yalanci(p.no);
      return;
    }
    oyna(p.no, botKartSec(p));
  }

  function botSuclarMi(p) {
    if (zorunlu(p.no)) return true;
    // Dürbünle baktıysa: gördüğü kart yalansa kesin suçlar
    if (p.durbun && p.durbun.sonNo === o.son.no) {
      if (p.durbun.tur !== 'J' && p.durbun.tur !== o.masaKarti) return true;
      if (o.son.kartlar.length === 1) return false;
    }
    const iddia = o.son.kartlar.length;
    const benimDogru = p.el.filter(dogruMu).length;
    const disarida = 8 - benimDogru;
    if (iddia > disarida) return true;
    if (o.iddiaToplam > disarida + 1) return Math.random() < 0.8;
    const atan = o.oyuncular[o.son.no];
    let ihtimal = 0.12 + (iddia - 1) * 0.14;
    ihtimal += (benimDogru >= 3 ? 0.15 : 0) + (benimDogru === 0 ? 0.18 : 0);
    ihtimal += (o.iddiaToplam > disarida - 2 ? 0.15 : 0);
    ihtimal += (atan.el.length === 0 ? 0.08 : 0);
    ihtimal += (p.cesaret - 0.6) * 0.3;
    ihtimal -= p.tetik * 0.03;
    if (p.ozel.includes('yelek')) ihtimal += 0.15;   // yeleği var, cesur
    return Math.random() < Math.max(0.05, Math.min(0.85, ihtimal));
  }

  function botKartSec(p) {
    const dogru = p.el.filter(dogruMu).sort((a, b) => (a.tur === 'J') - (b.tur === 'J'));
    const yanlis = p.el.filter(k => !dogruMu(k));
    if (!dogru.length) {
      const n = Math.random() < 0.7 || yanlis.length < 2 ? 1 : 2;
      return karistir([...yanlis]).slice(0, n).map(k => k.id);
    }
    const n = Math.min(dogru.length, 1 + rastgele(Math.min(3, dogru.length)));
    const secim = dogru.slice(0, n);
    if (yanlis.length && secim.length < 3 && Math.random() < p.cesaret * 0.35) secim.push(yanlis[rastgele(yanlis.length)]);
    return secim.map(k => k.id);
  }

  // ---------- Dışarıya gösterilen hâl ----------
  // no numaralı oyuncu ne görür: başkalarının kartları, özel kartlarının türü ve mermi yerleri gizli
  function gorunum(no) {
    if (!o) return null;
    return {
      masaKarti: o.masaKarti, sira: o.sira, yon: o.yon, asama: o.asama, elNo: o.elNo, yigin: o.yigin,
      sonAdet: o.son ? o.son.kartlar.length : 0, sonNo: o.son ? o.son.no : -1,
      cezali: o.cezali, kazanan: o.kazanan, bitis: o.bitis, sonAcilan: o.sonAcilan, ozelAyar: o.ayar.ozel,
      zorunlu: o.asama === 'oyun' && zorunlu(o.sira),
      oyuncular: o.oyuncular.map(p => ({
        no: p.no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet, bot: p.bot, yedekBot: !!p.yedekBot, canli: p.canli, tetik: p.tetik,
        kartSayisi: p.el.length, el: p.no === no ? p.el : null,
        ozelSayisi: p.ozel.length, ozel: p.no === no ? p.ozel : null, durbun: p.no === no ? p.durbun : null,
      })),
    };
  }

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
    yeni, temizle, oyna, yalanci, ozelKullan, gorunum, botYap, AD, OZEL, SURE,
    get aktif() { return !!o && o.asama !== 'bitti'; },
  };
})();
