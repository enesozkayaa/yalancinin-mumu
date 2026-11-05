// =============================================================
// Yalancının Mumu - sesler (hepsi o an üretilir, ses dosyası yok)
// Kart atma, kart açma, "Yalancı!", tabanca topu dönmesi, boş tetik "tık", "BAM", mum sönmesi,
// sıra sende zili, kazanma.
// =============================================================

const Ses = (() => {
  let ctx = null, ana = null, acik = true, gurultu = null;
  const ANAHTAR = 'yalancininMumu.ses';
  try { acik = localStorage.getItem(ANAHTAR) !== '0'; } catch (e) { /* yok */ }

  function motor() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ana = ctx.createGain();
      ana.gain.value = acik ? 0.8 : 0;
      ana.connect(ctx.destination);
      // Beyaz gürültü (2 sn)
      gurultu = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const v = gurultu.getChannelData(0);
      for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const oyna = (a, b) => a + Math.random() * (b - a);

  // Gürültü patlaması (filtreli)
  function hisirti(gecikme, sure, frekans, q, seviye, tip = 'bandpass') {
    motor();
    const t = ctx.currentTime + gecikme;
    const k = ctx.createBufferSource();
    k.buffer = gurultu;
    const f = ctx.createBiquadFilter();
    f.type = tip;
    f.frequency.value = frekans;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(seviye, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    k.connect(f).connect(g).connect(ana);
    k.start(t, Math.random() * 1.5, sure + 0.05);
    return { f, t };
  }

  function nota(gecikme, frekans, sure, seviye, tip = 'sine', kayma = 0) {
    motor();
    const t = ctx.currentTime + gecikme;
    const o = ctx.createOscillator();
    o.type = tip;
    o.frequency.setValueAtTime(frekans, t);
    if (kayma) o.frequency.exponentialRampToValueAtTime(frekans * kayma, t + sure);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(seviye, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(ana);
    o.start(t);
    o.stop(t + sure + 0.05);
  }

  return {
    // Kart seçme: kısa kâğıt tıkı
    sec: () => hisirti(0, 0.05, 3500, 1.5, 0.25),
    // Kart masaya atılınca: kâğıt kayması + masaya değme
    kartAt: (adet = 1) => {
      for (let i = 0; i < adet; i++) {
        hisirti(i * 0.08, 0.14, 2600, 0.8, 0.22);
        hisirti(i * 0.08 + 0.12, 0.06, 900, 1, 0.35);
      }
    },
    // Kart çevirme
    kartAc: (adet = 1) => {
      for (let i = 0; i < adet; i++) hisirti(i * 0.15, 0.09, 4200, 1.2, 0.3);
    },
    // Dağıtma: art arda kart sesleri
    dagit: () => {
      for (let i = 0; i < 10; i++) hisirti(i * 0.06, 0.07, oyna(2200, 3400), 1, 0.16);
    },
    // "YALANCI!": dramatik vuruş + akor
    yalanci: () => {
      hisirti(0, 0.3, 120, 0.7, 0.9, 'lowpass');
      [196, 233, 277, 330].forEach(f => nota(0.02, f, 1.1, 0.09, 'sawtooth'));
      nota(0, 98, 0.8, 0.3, 'triangle', 0.7);
    },
    // Doğru çıktı / yalan çıktı
    dogruCikti: () => [523, 659, 784].forEach((f, i) => nota(i * 0.09, f, 0.35, 0.12, 'triangle')),
    yalanCikti: () => [392, 330, 262].forEach((f, i) => nota(i * 0.12, f, 0.4, 0.13, 'square')),
    // Tabanca topu döner: tırtıklı tıkırtılar
    topDon: () => {
      for (let i = 0; i < 14; i++) hisirti(i * 0.035 * (1 + i * 0.06), 0.02, 5200, 4, 0.18);
    },
    // Horoz çekilir (kalp atışı gibi gerilim)
    gerilim: () => {
      for (let i = 0; i < 3; i++) {
        nota(i * 0.75, 55, 0.18, 0.5, 'sine', 0.6);
        nota(i * 0.75 + 0.2, 50, 0.16, 0.35, 'sine', 0.6);
      }
      hisirti(2.1, 0.05, 2500, 3, 0.4);   // horozun kalkması
    },
    // Boş hazne: kuru metal tık
    tik: () => {
      hisirti(0, 0.04, 3800, 6, 0.9);
      nota(0, 2400, 0.05, 0.15, 'square');
    },
    // Mermi: güçlü patlama + yankı
    bam: () => {
      hisirti(0, 0.08, 3000, 0.5, 1.0, 'highpass');
      hisirti(0, 0.9, 400, 0.5, 1.0, 'lowpass');
      nota(0, 70, 0.6, 0.9, 'sine', 0.4);
      hisirti(0.25, 1.2, 250, 0.7, 0.25, 'lowpass');
    },
    // Mum söner: pfff
    mum: () => hisirti(0, 0.5, 700, 0.4, 0.3, 'lowpass'),
    // Sıra sende: iki notalı zil
    siraSende: () => {
      nota(0, 784, 0.4, 0.14);
      nota(0.13, 1175, 0.55, 0.14);
    },
    // Kazanma
    kazandin: () => [392, 494, 587, 784, 988].forEach((f, i) => nota(i * 0.12, f, 0.5, 0.12, 'triangle')),
    // Süre azalıyor
    tikTak: () => hisirti(0, 0.03, 2800, 4, 0.25),
    hazirla: () => motor(),
    get acik() { return acik; },
    ac(deger) {
      acik = deger;
      try { localStorage.setItem(ANAHTAR, deger ? '1' : '0'); } catch (e) { /* yok */ }
      if (ana) ana.gain.value = deger ? 0.8 : 0;
    },
  };
})();
