// Jelly Pop: «Поделиться в историю» Telegram.
// Рисует картинку 1080×1920 со счётом, загружает её через серверную функцию (window.JM_LB_URL)
// в хранилище Supabase и открывает редактор историй Telegram (WebApp.shareToStory, Bot API 7.8+).
(function () {
  var W = 1080, H = 1920;
  var COLORS = ['#FF2442', '#A83AFF', '#1E6EFF', '#44E01C', '#FFCC14', '#FF8A12', '#FF2D8E', '#12D6FF', '#F2F4FF', 'rainbow'];
  var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : 'TemplateData/';

  function tg() { return window.Telegram && window.Telegram.WebApp; }

  /** Можно ли делиться в историю в этом Telegram. */
  window.JM_CanStory = function () {
    var t = tg();
    return !!(t && t.shareToStory && t.initData && t.isVersionAtLeast && t.isVersionAtLeast('7.8'));
  };

  var fontReady = null;
  function loadFont() {
    if (!fontReady) {
      fontReady = (function () {
        try {
          var f = new FontFace('JellyNunito', 'url(' + base + 'nunito.ttf)', { weight: '700' });
          return f.load().then(function (ff) { document.fonts.add(ff); }).catch(function () { });
        } catch (e) { return Promise.resolve(); }
      })();
    }
    return fontReady;
  }

  function loadImage(src) {
    return new Promise(function (ok, fail) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { ok(im); };
      im.onerror = fail;
      im.src = src;
    });
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function shade(hex, k) { // k > 0 — светлее, k < 0 — темнее
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = k > 0 ? 255 : 0, a = Math.abs(k);
    return 'rgb(' + Math.round(r + (t - r) * a) + ',' + Math.round(g + (t - g) * a) + ',' + Math.round(b + (t - b) * a) + ')';
  }

  /** Желешка: круг с объёмом, бликом и личиком. */
  function drawJelly(c, x, y, r, level) {
    var col = COLORS[Math.max(0, Math.min(9, level))];
    c.save();
    // свечение
    var glowCol = col === 'rainbow' ? '#ff5adc' : col;
    c.shadowColor = glowCol; c.shadowBlur = r * 0.9;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (col === 'rainbow') {
      var g;
      if (c.createConicGradient) {
        g = c.createConicGradient(0, x, y);
        ['#ff2442', '#ff8a12', '#ffcc14', '#44e01c', '#12d6ff', '#1e6eff', '#a83aff', '#ff2d8e', '#ff2442']
          .forEach(function (s, i, a) { g.addColorStop(i / (a.length - 1), s); });
      } else {
        g = c.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, '#ff2442'); g.addColorStop(0.33, '#ffcc14'); g.addColorStop(0.66, '#12d6ff'); g.addColorStop(1, '#a83aff');
      }
      c.fillStyle = g;
    } else {
      var rg = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      rg.addColorStop(0, shade(col, 0.45)); rg.addColorStop(0.55, col); rg.addColorStop(1, shade(col, -0.35));
      c.fillStyle = rg;
    }
    c.fill();
    c.restore();
    // объём: тень снизу и блик сверху
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    var sh = c.createRadialGradient(x, y - r * 0.4, r * 0.6, x, y, r * 1.15);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.28)');
    c.fillStyle = sh; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.5, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath(); c.arc(x - r * 0.08, y - r * 0.66, r * 0.07, 0, Math.PI * 2); c.fill();
    c.restore();
    // личико
    c.fillStyle = '#111';
    c.beginPath(); c.ellipse(x - r * 0.26, y + r * 0.02, r * 0.085, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + r * 0.26, y + r * 0.02, r * 0.085, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(x - r * 0.15, y + r * 0.24); c.quadraticCurveTo(x, y + r * 0.5, x + r * 0.15, y + r * 0.24); c.closePath(); c.fill();
    c.fillStyle = '#ff9fb2';
    c.beginPath(); c.ellipse(x, y + r * 0.36, r * 0.07, r * 0.045, 0, 0, Math.PI * 2); c.fill();
  }

  /** Картинка истории (Promise<Blob> JPEG). */
  window.JM_StoryImage = function (score, maxlvl, ru) {
    return Promise.all([loadImage(base + 'splash3.jpg'), loadFont()]).then(function (r) {
      var bg = r[0];
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      var F = function (px) { return '700 ' + px + 'px JellyNunito, "Arial Rounded MT Bold", system-ui, sans-serif'; };

      // фон — заставка игры с логотипом
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      var s = Math.max(W / bg.width, H / bg.height);
      c.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
      // затемняем низ, чтобы карточка читалась
      var dim = c.createLinearGradient(0, 640, 0, H);
      dim.addColorStop(0, 'rgba(0,0,0,0)'); dim.addColorStop(0.25, 'rgba(0,0,0,0.45)'); dim.addColorStop(1, 'rgba(0,0,0,0.7)');
      c.fillStyle = dim; c.fillRect(0, 640, W, H - 640);

      // карточка
      var cx = 90, cy = 760, cw = W - 180, ch = 545;
      c.save();
      c.shadowColor = 'rgba(255,45,142,0.45)'; c.shadowBlur = 60;
      roundRect(c, cx, cy, cw, ch, 70);
      c.fillStyle = 'rgba(22,16,40,0.92)'; c.fill();
      c.restore();
      roundRect(c, cx, cy, cw, ch, 70);
      c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.14)'; c.stroke();

      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#c8b8ff';
      c.font = F(46);
      c.fillText(ru ? 'МОЙ СЧЁТ' : 'MY SCORE', W / 2, cy + 90);

      // счёт: розовое свечение, крупно
      var txt = fmt(score), size = 210;
      c.font = F(size);
      while (c.measureText(txt).width > cw - 100 && size > 90) { size -= 10; c.font = F(size); }
      c.save();
      c.shadowColor = 'rgba(255,60,170,0.9)'; c.shadowBlur = 40;
      var sg = c.createLinearGradient(0, cy + 150, 0, cy + 330);
      sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#ffd2ec');
      c.fillStyle = sg;
      c.fillText(txt, W / 2, cy + 245);
      c.restore();

      // плашка «самая большая желешка»
      var py = cy + 380, ph = 120, px = cx + 50, pw = cw - 100;
      roundRect(c, px, py, pw, ph, 60);
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
      drawJelly(c, px + 80, py + ph / 2, 42, maxlvl);
      c.textAlign = 'right';
      c.fillStyle = '#fff';
      c.font = F(46);
      var lvl = (Math.min(9, maxlvl) + 1) + '/10';
      c.fillText(lvl, px + pw - 44, py + ph / 2 + 2);
      var room = pw - 44 - c.measureText(lvl).width - 30 - 150;   // место под подпись
      c.textAlign = 'left';
      c.fillStyle = '#d9dbe8';
      var label = ru ? 'Самая большая желешка' : 'Biggest jelly', ls = 40;
      c.font = F(ls);
      while (c.measureText(label).width > room && ls > 26) { ls -= 2; c.font = F(ls); }
      c.fillText(label, px + 150, py + ph / 2 + 2);

      // призыв
      c.textAlign = 'center';
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 24;
      c.fillStyle = '#fff';
      c.font = F(76);
      c.fillText(ru ? 'Сможешь больше?' : 'Can you beat me?', W / 2, 1440);
      c.fillStyle = '#ffd34d';
      c.font = F(44);
      c.fillText('@JellyPops_bot', W / 2, 1530);
      c.restore();

      return new Promise(function (ok, fail) {
        cv.toBlob(function (b) { b ? ok(b) : fail(new Error('toBlob')); }, 'image/jpeg', 0.9);
      });
    });
  };

  function toBase64(blob) {
    return new Promise(function (ok, fail) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1]); };
      fr.onerror = fail;
      fr.readAsDataURL(blob);
    });
  }

  var busy = false;
  /**
   * Поделиться результатом в истории. done(true/false) — получилось ли открыть редактор историй.
   */
  window.JM_ShareStory = function (score, maxlvl, ru, text, done) {
    done = done || function () { };
    var t = tg();
    if (busy || !window.JM_CanStory() || !window.JM_LB_URL) { done(false); return; }
    busy = true;
    window.JM_StoryImage(score, maxlvl, ru).then(toBase64).then(function (b64) {
      return fetch(window.JM_LB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: t.initData, story: b64 })
      }).then(function (r) { return r.json(); });
    }).then(function (res) {
      busy = false;
      if (!res || !res.url) { done(false); return; }
      var params = { text: text };
      var user = t.initDataUnsafe && t.initDataUnsafe.user;
      // ссылка-виджет в истории доступна только с Telegram Premium
      if (user && user.is_premium) params.widget_link = { url: 'https://t.me/JellyPops_bot?startapp=story', name: 'Jelly Pop' };
      try { t.shareToStory(res.url, params); done(true); } catch (e) { done(false); }
    }).catch(function () { busy = false; done(false); });
  };
})();
