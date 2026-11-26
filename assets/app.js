(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var root = document.documentElement;
  var bnDigits = function (s) { return String(s).replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'[d]; }); };

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---- theme ----
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#121614' : '#1f4e3d');
  }
  document.querySelectorAll('[data-act="theme"]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(t); store.set('theme', t);
    });
  });

  // ---- font size ----
  var sizes = [0.95, 1.0625, 1.18, 1.3];
  var si = parseInt(store.get('fs') || '1', 10);
  function applySize() { root.style.setProperty('--fs', sizes[si] + 'rem'); }
  applySize();
  document.querySelectorAll('[data-act="font"]').forEach(function (b) {
    b.addEventListener('click', function () {
      si = (si + 1) % sizes.length; applySize(); store.set('fs', String(si));
      toast('লেখার আকার: ' + bnDigits(si + 1) + '/' + bnDigits(sizes.length));
    });
  });

  // ---- reading progress ----
  var prog = document.querySelector('.progress');
  if (prog) {
    var onScroll = function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // ---- share ----
  document.querySelectorAll('[data-act="share"]').forEach(function (b) {
    b.addEventListener('click', function () {
      var data = { title: document.title, url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(location.href).then(function () { toast('লিংক কপি হয়েছে'); }); }
    });
  });

  // ---- install (PWA) ----
  var deferred = null;
  var installBtns = document.querySelectorAll('[data-act="install"]');
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (!standalone) installBtns.forEach(function (b) { b.hidden = false; });
  });
  installBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; installBtns.forEach(function (x) { x.hidden = true; }); });
    });
  });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && !standalone) document.querySelectorAll('.ios-hint').forEach(function (el) { el.style.display = 'block'; });

  // ---- service worker ----
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) toast('নতুন সংস্করণ এসেছে — পেজ রিফ্রেশ করুন');
            if (w.state === 'activated' && !navigator.serviceWorker.controller) toast('অফলাইনে পড়ার জন্য প্রস্তুত');
          });
        });
      }).catch(function () {});
    });
  }

  // ---- search (home page) ----
  var input = document.getElementById('q');
  if (!input) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.grid .card'));
  var countEl = document.getElementById('count');
  var empty = document.getElementById('empty');
  var index = null;

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return s.normalize('NFC').toLowerCase(); }

  function load() {
    if (index) return Promise.resolve(index);
    return fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (j) { index = j; return j; });
  }

  function run() {
    var q = norm(input.value.trim());
    if (!q) {
      cards.forEach(function (c) { c.hidden = false; var s = c.querySelector('.snip'); if (s) s.remove(); });
      countEl.textContent = ''; empty.hidden = true; return;
    }
    load().then(function (idx) {
      var shown = 0;
      cards.forEach(function (c) {
        var item = idx[c.getAttribute('data-slug')];
        var text = norm(item.text), head = norm(item.head);
        var pos = text.indexOf(q), hit = head.indexOf(q) > -1 || pos > -1;
        c.hidden = !hit;
        var old = c.querySelector('.snip'); if (old) old.remove();
        if (hit) {
          shown++;
          if (pos > -1) {
            var raw = item.text, a = Math.max(0, pos - 45), b = Math.min(raw.length, pos + q.length + 70);
            var snip = (a > 0 ? '…' : '') + esc(raw.slice(a, pos)) + '<mark>' + esc(raw.slice(pos, pos + q.length)) + '</mark>' + esc(raw.slice(pos + q.length, b)) + (b < raw.length ? '…' : '');
            var p = document.createElement('p'); p.className = 'snip'; p.innerHTML = snip;
            c.querySelector('.meta').before(p);
          }
        }
      });
      countEl.textContent = bnDigits(shown) + 'টি লেখায় পাওয়া গেছে';
      empty.hidden = shown > 0;
    });
  }
  var t; input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 120); });
  input.addEventListener('focus', load, { once: true });
})();
