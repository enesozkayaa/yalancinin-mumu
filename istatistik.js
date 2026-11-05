// =============================================================
// Yalancının Mumu - istatistikler ve rozetler
// Oyun sonunda masadakilere ödüller dağıtılır (En şanslı, Yalan makinesi, Keskin göz...).
// Bu cihazdaki oyuncunun toplam istatistikleri saklanır; belli hedeflere ulaşınca rozet kazanılır.
// =============================================================

const Istatistik = (() => {
  const ANAHTAR = 'yalancininMumu.istatistik';
  const ROZETLER = [
    { id: 'ilkZafer', emoji: '🏆', ad: 'İlk Zafer', aciklama: 'Bir oyun kazan', sart: (t) => t.galibiyet >= 1 },
    { id: 'kral', emoji: '👑', ad: 'Saloon Kralı', aciklama: '10 oyun kazan', sart: (t) => t.galibiyet >= 10 },
    { id: 'emektar', emoji: '🤠', ad: 'Emektar Kovboy', aciklama: '25 oyun oyna', sart: (t) => t.oyun >= 25 },
    { id: 'kedi', emoji: '🐈', ad: 'Dokuz Canlı', aciklama: 'Bir oyunda 4 kez tetikten sağ çık', sart: (t, o) => o && o.kurtuldu >= 4 },
    { id: 'melek', emoji: '😇', ad: 'Melek', aciklama: 'Hiç yalan söylemeden bir oyun kazan', sart: (t, o, kazandi) => kazandi && o && o.yalan === 0 },
    { id: 'serif', emoji: '🕵️', ad: 'Şerif Gözü', aciklama: 'Toplam 20 yalancı yakala', sart: (t) => t.yakaladi >= 20 },
    { id: 'poker', emoji: '🃏', ad: 'Poker Yüzü', aciklama: 'Toplam 25 yalanı yutturduysan', sart: (t) => t.yutturdu >= 25 },
    { id: 'domatesci', emoji: '🍅', ad: 'Domatesçi', aciklama: 'Toplam 30 domates fırlat', sart: (t) => t.domates >= 30 },
    { id: 'kartci', emoji: '🎴', ad: 'Hokkabaz', aciklama: 'Toplam 15 özel kart kullan', sart: (t) => t.ozel >= 15 },
    { id: 'ilkKursun', emoji: '💀', ad: 'Talihsiz', aciklama: 'İlk tetikte mumu sön', sart: (t, o) => o && o.olumSirasi > 0 && o.tetik === 1 },
  ];
  const ALANLAR = ['oyun', 'galibiyet', 'yalan', 'yakalandi', 'yakaladi', 'bosSuclama', 'yutturdu', 'tetik', 'kurtuldu', 'domates', 'ozel'];

  function oku() {
    let t = null;
    try { t = JSON.parse(localStorage.getItem(ANAHTAR)); } catch (e) { /* yok */ }
    t = t && typeof t === 'object' ? t : {};
    ALANLAR.forEach(a => (t[a] = +t[a] || 0));
    t.rozetler = Array.isArray(t.rozetler) ? t.rozetler : [];
    return t;
  }
  function yaz(t) {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(t)); } catch (e) { /* yok */ }
  }

  // Oyun bitti: benim istatistiklerimi topla, yeni kazanılan rozetleri döndür
  function oyunBitti(benim, kazandi) {
    const t = oku();
    t.oyun++;
    if (kazandi) t.galibiyet++;
    ['yalan', 'yakalandi', 'yakaladi', 'bosSuclama', 'yutturdu', 'tetik', 'kurtuldu', 'ozel'].forEach(a => (t[a] += +benim?.[a] || 0));
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t, benim, kazandi));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }
  function domatesAtildi() {
    const t = oku();
    t.domates++;
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }

  // Oyun sonu ödülleri: masadaki herkes arasından
  function oduller(istat, ozelVar) {
    const liste = [];
    const enCok = (alan, emoji, ad, aciklama) => {
      const max = Math.max(...istat.map(p => p[alan] || 0));
      if (max <= 0) return;
      const kim = istat.filter(p => (p[alan] || 0) === max);
      liste.push({ emoji, ad, kim: kim.map(p => p.ad).join(', '), aciklama: aciklama(max) });
    };
    enCok('kurtuldu', '🍀', 'En şanslı', n => `${n} kez tetikten sağ çıktı`);
    const ilk = istat.find(p => p.olumSirasi === 1);
    if (ilk) liste.push({ emoji: '💀', ad: 'En şanssız', kim: ilk.ad, aciklama: `İlk mumu sönen (${ilk.tetik}. tetikte)` });
    enCok('yalan', '🤥', 'Yalan makinesi', n => `${n} kez yalan söyledi`);
    enCok('yakalandi', '🚔', 'En çok yakalanan', n => `${n} kez yalanı yakalandı`);
    enCok('yakaladi', '🕵️', 'Keskin göz', n => `${n} yalancı yakaladı`);
    enCok('yutturdu', '🃏', 'Blöf ustası', n => `${n} yalanı kimse fark etmedi`);
    enCok('bosSuclama', '🙈', 'Boşa suçlayan', n => `${n} kez masum birini suçladı`);
    const durust = istat.filter(p => (p.yalan || 0) === 0);
    if (durust.length && durust.length < istat.length) liste.push({ emoji: '😇', ad: 'Dürüst kovboy', kim: durust.map(p => p.ad).join(', '), aciklama: 'Hiç yalan söylemedi' });
    if (ozelVar) enCok('ozel', '🎴', 'Hokkabaz', n => `${n} özel kart kullandı`);
    enCok('yelek', '🛡️', 'Yelekli', n => `Çelik yelek ${n} kez hayatını kurtardı`);
    return liste;
  }

  function paneliCiz() {
    const t = oku();
    const oran = t.oyun ? Math.round((t.galibiyet / t.oyun) * 100) : 0;
    const kutu = (deger, ad) => `<div class="istKutu"><b>${deger}</b><small>${ad}</small></div>`;
    $('istatistikIcerik').innerHTML = `<div class="istIzgara">${kutu(t.oyun, 'Oyun')}${kutu(t.galibiyet, 'Galibiyet')}${kutu('%' + oran, 'Kazanma')}`
      + `${kutu(t.yalan, 'Yalan')}${kutu(t.yutturdu, 'Yutturulan yalan')}${kutu(t.yakalandi, 'Yakalandın')}`
      + `${kutu(t.yakaladi, 'Yakaladın')}${kutu(t.bosSuclama, 'Boşa suçlama')}${kutu(t.kurtuldu + '/' + t.tetik, 'Sağ çıkılan tetik')}`
      + `${kutu(t.domates, 'Domates')}${kutu(t.ozel, 'Özel kart')}</div>`
      + `<h3>Rozetler (${t.rozetler.length}/${ROZETLER.length})</h3><div class="rozetler">`
      + ROZETLER.map(r => `<div class="rozet${t.rozetler.includes(r.id) ? ' var' : ''}"><span>${r.emoji}</span><b>${r.ad}</b><small>${r.aciklama}</small></div>`).join('')
      + '</div>';
  }
  $('istatistikBtn').addEventListener('click', () => {
    paneliCiz();
    $('istatistikPaneli').hidden = false;
  });
  $('istatistikKapat').addEventListener('click', () => ($('istatistikPaneli').hidden = true));

  return { oyunBitti, domatesAtildi, oduller };
})();
