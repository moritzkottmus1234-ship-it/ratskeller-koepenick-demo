/* =====================================================================
   Ratskeller Köpenick – main.js (Vanilla JS, keine Abhängigkeiten)
   Inhalte/Einstellungen: data/config.js und data/wochenkarte.js
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.RK_CONFIG || {};
  var PHONE_DISPLAY = '030 655 51 78';
  var WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(hhmm) { var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function fmtTime(min) { var h = Math.floor(min / 60), m = min % 60; return m ? h + ':' + pad(m) + ' Uhr' : h + ' Uhr'; }
  function isoDate(d) { return d.y + '-' + pad(d.m) + '-' + pad(d.d); }

  /* ---------------------------------------------------------------
     Öffnungszeiten-Logik (Zeitzone Europe/Berlin)
     --------------------------------------------------------------- */
  var REG = { open: 720, close: 1320, kitchenClose: 1260, pauseFrom: 960, pauseTo: 1020 }; // 12–22, Küche bis 21, Pause 16–17

  function berlinNow() {
    try {
      var parts = new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { y: +o.year, m: +o.month, d: +o.day, min: (+o.hour % 24) * 60 + (+o.minute) };
    } catch (e) {
      var n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), min: n.getHours() * 60 + n.getMinutes() };
    }
  }
  function addDays(d, k) {
    var t = new Date(Date.UTC(d.y, d.m - 1, d.d + k));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function weekday(d) { return new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay(); }

  /* Liefert die Öffnungszeiten eines Tages oder {closed:true, reason} */
  function daySchedule(d) {
    var key = isoDate(d);
    var special = (CFG.sonderzeiten || []).filter(function (s) { return s && s.datum === key; })[0];
    if (special) {
      if (special.geschlossen) return { closed: true, reason: special.text || 'geschlossen' };
      var o = toMin(special.von || '12:00'), c = toMin(special.bis || '22:00');
      return { open: o, close: c, kitchenClose: Math.min(c - 60, REG.kitchenClose), pauseFrom: REG.pauseFrom, pauseTo: REG.pauseTo, text: special.text };
    }
    // Feiertage 25.12. und 26.12.: ab 11 Uhr geöffnet (auch wenn Montag)
    if (d.m === 12 && (d.d === 25 || d.d === 26)) {
      // TODO: Schließzeit an den Feiertagen prüfen – hier wird die reguläre Zeit (22 Uhr) angenommen
      return { open: 660, close: REG.close, kitchenClose: REG.kitchenClose, pauseFrom: REG.pauseFrom, pauseTo: REG.pauseTo, holiday: true };
    }
    if (weekday(d) === 1) return { closed: true, reason: 'Ruhetag' };
    return { open: REG.open, close: REG.close, kitchenClose: REG.kitchenClose, pauseFrom: REG.pauseFrom, pauseTo: REG.pauseTo };
  }

  function nextOpening(fromDay, offsetStart) {
    for (var k = offsetStart; k < 21; k++) {
      var day = addDays(fromDay, k), s = daySchedule(day);
      if (!s.closed) {
        var label = k === 0 ? 'heute' : k === 1 ? 'morgen' : WEEKDAYS[weekday(day)];
        return { label: label, time: s.open };
      }
    }
    return null;
  }

  function computeStatus() {
    var now = berlinNow(), today = { y: now.y, m: now.m, d: now.d }, s = daySchedule(today), t = now.min;
    var res = { state: 'closed', text: '', phone: '' };

    if (s.closed || t >= s.close) {
      var nx = nextOpening(today, 1);
      var when = nx ? nx.label + ' um ' + fmtTime(nx.time) : '';
      res.text = (s.closed ? 'Heute ' + (s.reason === 'Ruhetag' ? 'Ruhetag' : 'geschlossen') : 'Jetzt geschlossen') + (nx ? ' · öffnet ' + when : '');
      res.phone = nx ? 'Ab ' + (nx.label === 'morgen' ? 'morgen' : nx.label) + ', ' + fmtTime(nx.time) + ' wieder erreichbar' : 'Derzeit nicht erreichbar';
      return res;
    }
    if (t < s.open) {
      res.text = 'Noch geschlossen · öffnet heute um ' + fmtTime(s.open);
      res.phone = 'Ab heute ' + fmtTime(s.open) + ' erreichbar';
      return res;
    }
    res.state = 'open';
    res.phone = 'Jetzt erreichbar';
    if (t >= s.pauseFrom && t < s.pauseTo) {
      res.state = 'pause';
      res.text = 'Geöffnet · Küchenpause bis ' + fmtTime(s.pauseTo);
    } else if (t >= s.kitchenClose) {
      res.state = 'pause';
      res.text = 'Geöffnet bis ' + fmtTime(s.close) + ' · Küche geschlossen';
    } else if (t < s.pauseFrom) {
      res.text = 'Jetzt geöffnet · Küche bis ' + fmtTime(s.pauseFrom);
    } else {
      res.text = 'Jetzt geöffnet · Küche bis ' + fmtTime(s.kitchenClose);
    }
    return res;
  }

  function renderStatus() {
    var st = computeStatus();
    $$('[data-status]').forEach(function (el) {
      el.setAttribute('data-state', st.state);
      var t = $('.status-pill__text', el); if (t) t.textContent = st.text;
    });
    var phoneState = st.state === 'closed' ? 'closed' : 'open';
    $$('[data-phone-status]').forEach(function (el) {
      el.setAttribute('data-state', phoneState);
      var t = $('.phone-status__text', el); if (t) t.textContent = st.phone;
    });
    $$('[data-phone-status-text]').forEach(function (el) {
      el.textContent = st.phone;
      var host = el.closest('.mobile-bar__btn, .float-cta');
      if (host) host.setAttribute('data-state', phoneState);
    });
  }

  /* ---------------------------------------------------------------
     Hinweis-Banner
     --------------------------------------------------------------- */
  function initBanner() {
    var h = CFG.hinweis, banner = $('#notice-banner');
    if (!banner || !h || !h.aktiv || !h.text) return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('rk-notice') === h.text; } catch (e) { /* ignorieren */ }
    if (dismissed) return;
    $('#notice-text').textContent = h.text;
    var link = $('#notice-link');
    if (h.linkText && h.linkZiel) { link.textContent = h.linkText; link.href = h.linkZiel; link.hidden = false; }
    banner.hidden = false;
    $('#notice-close').addEventListener('click', function () {
      banner.hidden = true;
      try { sessionStorage.setItem('rk-notice', h.text); } catch (e) { /* ignorieren */ }
    });
  }

  /* ---------------------------------------------------------------
     Navigation (Mobile-Menü + aktiver Abschnitt)
     --------------------------------------------------------------- */
  function initNav() {
    var toggle = $('#nav-toggle'), nav = $('#site-nav');
    if (!toggle || !nav) return;
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      $('use', toggle).setAttribute('href', open ? '#i-close' : '#i-menu');
    }
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });

    if ('IntersectionObserver' in window) {
      var links = $$('a[href^="#"]', nav), map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && map[en.target.id]) {
            links.forEach(function (l) { l.removeAttribute('aria-current'); });
            map[en.target.id].setAttribute('aria-current', 'true');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ---------------------------------------------------------------
     "Tisch reservieren"-Buttons: zum Formular springen + Fokus
     --------------------------------------------------------------- */
  function initReserveLinks() {
    $$('[data-reserve]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = $('#reservieren'), card = $('.reserve__form');
        if (!target) return;
        e.preventDefault();
        // Auf schmalen Bildschirmen direkt zum Formular (der Telefonblock steht darüber)
        var scrollEl = (card && matchMedia('(max-width: 959px)').matches) ? card : target;
        scrollEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#reservieren');
        setTimeout(function () {
          var first = $('#r-name');
          if (first && !$('#reserve-form').hidden) first.focus({ preventScroll: true });
          if (card) { card.classList.remove('is-flash'); void card.offsetWidth; card.classList.add('is-flash'); }
        }, 600);
      });
    });

    // Schwebenden Button ausblenden, solange der Reservierungsbereich sichtbar ist
    var fl = $('.float-cta'), sec = $('#reservieren');
    if (fl && sec && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { fl.classList.toggle('is-hidden', en[0].isIntersecting); }, { threshold: 0.15 }).observe(sec);
    }
  }

  /* OpenTable-Link aus config.js übernehmen */
  function initOpenTable() {
    var link = CFG.opentableLink || '#OPENTABLE-LINK';
    $$('[data-opentable]').forEach(function (a) {
      a.href = link;
      if (/^https?:/.test(link)) a.target = '_blank';
    });
  }

  /* ---------------------------------------------------------------
     Speisekarte – Reiter (Tabs) + Filter
     --------------------------------------------------------------- */
  var menuApi = null;
  function initMenu() {
    var book = $('.menu-book');
    if (!book) return;
    var tabs = $$('[role="tab"]', book), panels = $$('[role="tabpanel"]', book);
    var chips = $$('[data-filter]', book), empty = $('#filter-empty');
    var current = tabs[0];

    function showTab(tab, focus) {
      current = tab;
      tabs.forEach(function (t) {
        var sel = t === tab;
        t.setAttribute('aria-selected', String(sel));
        t.tabIndex = sel ? 0 : -1;
      });
      panels.forEach(function (p) {
        var show = p.id === tab.getAttribute('aria-controls');
        p.hidden = !show;
        if (show) { p.classList.remove('is-entering'); void p.offsetWidth; p.classList.add('is-entering'); }
      });
      if (focus) tab.focus({ preventScroll: true });
      // Reiterleiste nur horizontal mitscrollen (nicht die ganze Seite)
      var bar = tab.parentNode;
      if (bar.scrollWidth > bar.clientWidth) {
        var target = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
        if (bar.scrollTo) bar.scrollTo({ left: target, behavior: 'smooth' }); else bar.scrollLeft = target;
      }
    }

    function applyFilter(f) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === f)); });
      book.classList.toggle('is-filtering', f !== 'alle');
      var anyVisible = false;
      panels.forEach(function (p) {
        var visible = 0;
        $$('.dish', p).forEach(function (d) {
          var diet = (d.getAttribute('data-diet') || '').split(/\s+/);
          var show = f === 'alle' ||
            (d.hasAttribute('data-diet') && (diet.indexOf(f) > -1 || (f === 'vegetarisch' && diet.indexOf('vegan') > -1)));
          d.hidden = !show;
          if (show) visible++;
        });
        $$('.menu-extra', p).forEach(function (el) { el.hidden = f !== 'alle'; });
        if (f === 'alle') return;
        p.hidden = visible === 0;
        if (visible) anyVisible = true;
      });
      if (f === 'alle') showTab(current);
      if (empty) empty.hidden = anyVisible || f === 'alle';
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        if (book.classList.contains('is-filtering')) applyFilter('alle');
        showTab(tab);
      });
      tab.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (k === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === 'Home') n = tabs[0];
        if (k === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); if (book.classList.contains('is-filtering')) applyFilter('alle'); showTab(n, true); }
      });
    });
    chips.forEach(function (chip) { chip.addEventListener('click', function () { applyFilter(chip.getAttribute('data-filter')); }); });
    showTab(tabs[0]);

    menuApi = {
      openDish: function (id) {
        var dish = document.getElementById(id); if (!dish) return;
        var panel = dish.closest('[role="tabpanel"]');
        applyFilter('alle');
        var tab = tabs.filter(function (t) { return t.getAttribute('aria-controls') === panel.id; })[0];
        if (tab) showTab(tab);
        setTimeout(function () {
          dish.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dish.focus({ preventScroll: true });
          dish.classList.remove('is-highlight'); void dish.offsetWidth; dish.classList.add('is-highlight');
        }, 50);
      }
    };
    $$('[data-goto-dish]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); menuApi.openDish(a.getAttribute('href').slice(1)); });
    });
  }

  /* ---------------------------------------------------------------
     Hero-Diashow (sanfter Bildwechsel)
     --------------------------------------------------------------- */
  function initHero() {
    var slides = $$('.hero__slide'), dots = $$('.hero__dot');
    if (slides.length < 2) return;
    var idx = 0, timer = null;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(n) {
      slides[idx].classList.remove('is-active'); dots[idx] && dots[idx].classList.remove('is-active');
      dots[idx] && dots[idx].setAttribute('aria-pressed', 'false');
      idx = (n + slides.length) % slides.length;
      var img = $('img', slides[idx]); if (img && img.loading === 'lazy') img.loading = 'eager';
      slides[idx].classList.add('is-active'); dots[idx] && dots[idx].classList.add('is-active');
      dots[idx] && dots[idx].setAttribute('aria-pressed', 'true');
    }
    function start() { if (!reduce && !timer) timer = setInterval(function () { go(idx + 1); }, 7000); }
    function stop() { clearInterval(timer); timer = null; }
    dots.forEach(function (d, i) { d.addEventListener('click', function () { stop(); go(i); start(); }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    // Folgebilder vorladen, sobald die Seite steht
    window.addEventListener('load', function () { slides.forEach(function (s) { var i = $('img', s); if (i) i.loading = 'eager'; }); });
    start();
  }

  /* Header: transparent über dem Hero, danach solide */
  function initHeader() {
    var header = $('.site-header'), hero = $('.hero');
    if (!header || !hero) return;
    function update() {
      var menuOpen = $('#site-nav') && $('#site-nav').classList.contains('is-open');
      header.classList.toggle('is-transparent', window.scrollY < 40 && !menuOpen);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    var toggle = $('#nav-toggle'); if (toggle) toggle.addEventListener('click', function () { setTimeout(update, 0); });
  }

  /* Elemente beim Scrollen sanft einblenden */
  function initReveal() {
    var els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Leichter Parallax-Effekt für Bildbänder */
  function initParallax() {
    var items = $$('[data-parallax]');
    if (!items.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ticking = false;
    function update() {
      items.forEach(function (el) {
        var r = el.parentNode.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        var p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        el.style.transform = 'translate3d(0,' + (p * -60).toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* Heutigen Wochentag in der Öffnungszeiten-Liste hervorheben */
  function initWeek() {
    var list = $('#week'); if (!list) return;
    var now = berlinNow(), wd = weekday(now);
    $$('li', list).forEach(function (li) {
      var today = +li.getAttribute('data-wd') === wd;
      li.classList.toggle('is-today', today);
      if (today) {
        var s = daySchedule(now), t = $('span:last-child', li);
        if (s.closed) t.textContent = s.reason === 'Ruhetag' ? 'Ruhetag' : 'geschlossen';
        else t.textContent = fmtTime(s.open).replace(' Uhr', '') + '–' + fmtTime(s.close);
        li.setAttribute('aria-current', 'date');
      }
    });
  }

  /* Routenplaner: leeren Startpunkt weglassen (= aktueller Standort in Google Maps) */
  function initRoute() {
    var form = $('#route-form'); if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var dest = form.elements.destination.value;
      var origin = form.elements.origin.value.trim();
      var modeEl = $('input[name="travelmode"]:checked', form);
      var url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest) +
        (origin ? '&origin=' + encodeURIComponent(origin) : '') +
        (modeEl ? '&travelmode=' + modeEl.value : '');
      var w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (err) { /* ignorieren */ } }
      else window.location.href = url; // Pop-up blockiert → im selben Fenster öffnen
    });
  }

  /* ---------------------------------------------------------------
     Mittagstisch aus data/wochenkarte.js
     --------------------------------------------------------------- */
  var TAG_ICONS = {
    vegetarisch: { cls: 'tag--veg', icon: 'i-leaf', label: 'vegetarisch' },
    vegan: { cls: 'tag--vegan', icon: 'i-vegan', label: 'vegan' },
    fisch: { cls: 'tag--fish', icon: 'i-fish', label: 'Fisch' }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderLunch() {
    var list = $('#lunch-list'), data = window.RK_WOCHENKARTE;
    if (!list) return;
    if (!data || !data.gerichte || !data.gerichte.length) {
      list.innerHTML = '<li class="dish"><p class="dish__desc">Die neue Wochenkarte folgt in Kürze – fragen Sie gern telefonisch nach: <a href="tel:+49306555178">' + PHONE_DISPLAY + '</a>.</p></li>';
      return;
    }
    list.innerHTML = data.gerichte.map(function (g) {
      var tags = (g.tags || []).map(function (t) {
        var c = TAG_ICONS[t]; if (!c) return '';
        return ' <span class="tag ' + c.cls + '" title="' + c.label + '"><svg class="icon"><use href="#' + c.icon + '"/></svg><span class="sr-only">' + c.label + '</span></span>';
      }).join('');
      return '<li class="dish"><div class="dish__head"><span class="dish__name">' + esc(g.name) + tags + '</span><span class="dish__dots" aria-hidden="true"></span>' +
        '<span class="dish__price">' + esc(g.preis) + '</span></div>' +
        (g.beschreibung ? '<p class="dish__desc">' + esc(g.beschreibung) + '</p>' : '') + '</li>';
    }).join('');
    var valid = $('#lunch-valid');
    if (valid && data.gueltig) { valid.textContent = 'Gültig: ' + data.gueltig; valid.hidden = false; }
  }

  /* ---------------------------------------------------------------
     Google Maps – Zwei-Klick-Lösung
     --------------------------------------------------------------- */
  function initMap() {
    var btn = $('#map-load'), box = $('#map-consent');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.className = 'map-frame';
      iframe.title = 'Karte: Ratskeller Köpenick, Alt-Köpenick 21, 12555 Berlin';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Alt-Köpenick 21, 12555 Berlin') + '&output=embed';
      box.replaceWith(iframe);
    });
  }

  /* ---------------------------------------------------------------
     Formulare (Reservierung + Feier-Anfrage)
     --------------------------------------------------------------- */
  var MSG = {
    required: 'Bitte füllen Sie dieses Feld aus.',
    name: 'Bitte geben Sie Ihren Namen an.',
    tel: 'Bitte geben Sie eine gültige Telefonnummer an (z. B. 030 123456).',
    email: 'Bitte prüfen Sie die E-Mail-Adresse (z. B. name@beispiel.de).',
    date: 'Bitte wählen Sie ein Datum.',
    datePast: 'Das Datum liegt in der Vergangenheit.',
    monday: 'Montag ist Ruhetag – bitte wählen Sie einen anderen Tag.',
    time: 'Bitte wählen Sie eine Uhrzeit.',
    pers: 'Bitte wählen Sie die Personenzahl.',
    persNum: 'Bitte geben Sie eine Personenzahl ab 1 an.',
    group: 'Ab 18 Personen bitte die Feier-Anfrage nutzen.',
    privacy: 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    occ: 'Bitte wählen Sie einen Anlass.'
  };

  function todayIso() { var n = berlinNow(); return isoDate(n); }
  function parseIso(v) { var p = v.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }

  function setError(field, msg) {
    var err = document.getElementById(field.id + '-err');
    if (msg) { field.setAttribute('aria-invalid', 'true'); } else { field.removeAttribute('aria-invalid'); }
    if (err) err.textContent = msg || '';
    return !msg;
  }

  function validateField(field) {
    var v = (field.type === 'checkbox') ? field.checked : String(field.value || '').trim();
    var name = field.name;
    if (field.type === 'checkbox') return setError(field, v ? '' : MSG.privacy);
    if (field.required && !v) {
      var m = { name: MSG.name, telefon: MSG.tel, datum: MSG.date, uhrzeit: MSG.time, personen: MSG.pers, anlass: MSG.occ }[name] || MSG.required;
      if (name === 'telefon') m = 'Bitte geben Sie Ihre Telefonnummer an.';
      return setError(field, m);
    }
    if (!v) return setError(field, '');
    if (name === 'name' && v.length < 2) return setError(field, MSG.name);
    if (name === 'telefon' && !/^\+?[0-9][0-9\s\/()\-]{5,}$/.test(v)) return setError(field, MSG.tel);
    if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError(field, MSG.email);
    if (name === 'datum') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return setError(field, MSG.date);
      if (v < todayIso()) return setError(field, MSG.datePast);
      if (field.form && field.form.getAttribute('data-kind') === 'reservierung') {
        var s = daySchedule(parseIso(v));
        if (s.closed) return setError(field, s.reason === 'Ruhetag' ? MSG.monday : 'An diesem Tag haben wir geschlossen' + (s.reason ? ' (' + s.reason + ')' : '') + '.');
      }
    }
    if (name === 'personen') {
      if (field.tagName === 'SELECT' && v === '18+') return setError(field, MSG.group);
      if (field.type === 'number' && (!(+v >= 1) || Math.floor(+v) !== +v)) return setError(field, MSG.persNum);
    }
    return setError(field, '');
  }

  function validateForm(form) {
    var fields = $$('input:not([type=hidden]), select, textarea', form), firstBad = null;
    fields.forEach(function (f) { if (!validateField(f) && !firstBad) firstBad = f; });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* Uhrzeiten abhängig vom Datum erzeugen (30-Minuten-Schritte) */
  function buildTimes(select, dateVal) {
    var prev = select.value;
    select.innerHTML = '';
    function opt(value, label, disabled) {
      var o = document.createElement('option'); o.value = value; o.textContent = label; o.disabled = !!disabled; select.appendChild(o);
    }
    if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) { opt('', 'Bitte zuerst Datum wählen'); select.disabled = false; return; }
    var day = parseIso(dateVal), s = daySchedule(day);
    if (s.closed) { opt('', s.reason === 'Ruhetag' ? 'Montag Ruhetag' : 'Geschlossen'); return; }
    var last = Math.min(s.kitchenClose, 1260); // letzte Reservierung = Küchenschluss (21 Uhr)
    var isToday = dateVal === todayIso(), nowMin = berlinNow().min, count = 0;
    opt('', 'Bitte wählen');
    for (var t = s.open; t <= last; t += 30) {
      if (isToday && t <= nowMin) continue;
      var label = Math.floor(t / 60) + ':' + pad(t % 60) + ' Uhr';
      var pause = t >= s.pauseFrom && t < s.pauseTo;
      opt(pause ? '' : label.replace(' Uhr', ''), pause ? label + ' – Küchenpause' : label, pause);
      if (!pause) count++;
    }
    if (!count) { select.innerHTML = ''; opt('', 'Heute keine Zeiten mehr frei – bitte anrufen'); }
    if (prev && $$('option', select).some(function (o) { return o.value === prev && !o.disabled; })) select.value = prev;
  }

  function collect(form) {
    var data = {};
    $$('input:not([type=hidden]), select, textarea', form).forEach(function (f) {
      if (f.type === 'checkbox') data[f.name] = f.checked ? 'ja' : 'nein';
      else data[f.name] = String(f.value || '').trim();
    });
    return data;
  }

  function fmtDateDe(v) { if (!v) return ''; var p = parseIso(v); return WEEKDAYS[weekday(p)] + ', ' + pad(p.d) + '.' + pad(p.m) + '.' + p.y; }

  function buildMail(form) {
    var d = collect(form), kind = form.getAttribute('data-kind'), lines, subject, to;
    if (kind === 'reservierung') {
      to = CFG.emailReservierung || 'verkauf@ratskeller-koepenick.de';
      subject = 'Reservierungsanfrage: ' + fmtDateDe(d.datum) + ', ' + d.uhrzeit + ' Uhr, ' + d.personen + ' Pers.';
      lines = [
        'Guten Tag,', '', 'ich möchte gern einen Tisch reservieren:', '',
        'Name: ' + d.name, 'Telefon: ' + d.telefon, 'E-Mail: ' + (d.email || '–'),
        'Datum: ' + fmtDateDe(d.datum), 'Uhrzeit: ' + d.uhrzeit + ' Uhr', 'Personen: ' + d.personen,
        'Bereichswunsch: ' + (d.bereich || 'egal'), 'Anlass: ' + (d.anlass || '–'), '',
        'Nachricht / Allergien:', d.nachricht || '–', '', 'Vielen Dank!'
      ];
    } else {
      to = CFG.emailFeier || 'verkauf@ratskeller-koepenick.de';
      subject = 'Anfrage Feier/Gruppe: ' + d.anlass + ', ' + fmtDateDe(d.datum) + ', ' + d.personen + ' Pers.';
      lines = [
        'Guten Tag,', '', 'ich interessiere mich für eine Feier / einen Gruppenbesuch:', '',
        'Anlass: ' + d.anlass, 'Datum: ' + fmtDateDe(d.datum), 'Personen: ' + d.personen,
        'Wunschraum: ' + (d.wunschraum || '–'), 'Buffet-Wahl: ' + (d.buffet || '–'), '',
        'Name: ' + d.name, 'Telefon: ' + d.telefon, 'E-Mail: ' + (d.email || '–'), '',
        'Nachricht:', d.nachricht || '–', '', 'Vielen Dank!'
      ];
    }
    return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function showSuccess(form, demo) {
    var wrap = form.parentNode, ok = $('.form-success', wrap);
    form.hidden = true;
    ok.hidden = false;
    var demoEl = $('.form-success__demo', ok); if (demoEl) demoEl.hidden = !demo;
    ok.focus();
  }

  function initForm(form) {
    if (!form) return;
    var kind = form.getAttribute('data-kind');
    var endpoint = kind === 'reservierung' ? CFG.formularEndpunktReservierung : CFG.formularEndpunktFeier;
    if (endpoint) form.action = endpoint;
    var status = $('.form__status', form);
    var dateInput = $('input[type=date]', form);
    if (dateInput) dateInput.min = todayIso();

    // Live-Validierung: nach dem ersten Verlassen eines Feldes
    $$('input:not([type=hidden]), select, textarea', form).forEach(function (f) {
      f.addEventListener('blur', function () { if (f.value || f.getAttribute('aria-invalid')) validateField(f); });
      f.addEventListener('change', function () { if (f.getAttribute('aria-invalid') || f.type === 'checkbox' || f.tagName === 'SELECT') validateField(f); });
      f.addEventListener('input', function () { if (f.getAttribute('aria-invalid') === 'true') validateField(f); });
    });

    if (kind === 'reservierung') {
      var timeSel = $('#r-time'), persSel = $('#r-pers'), hint = $('#group-hint'), submitBtn = $('button[type=submit]', form);
      for (var i = 1; i <= 17; i++) {
        var o = document.createElement('option'); o.value = String(i); o.textContent = i + (i === 1 ? ' Person' : ' Personen'); persSel.appendChild(o);
      }
      var big = document.createElement('option'); big.value = '18+'; big.textContent = '18 Personen oder mehr'; persSel.appendChild(big);
      persSel.addEventListener('change', function () {
        var isGroup = persSel.value === '18+';
        hint.hidden = !isGroup;
        submitBtn.disabled = isGroup;
        submitBtn.setAttribute('aria-disabled', String(isGroup));
      });
      dateInput.addEventListener('change', function () { buildTimes(timeSel, dateInput.value); validateField(dateInput); });
      buildTimes(timeSel, '');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = ''; status.classList.remove('is-error');
      if (!validateForm(form)) {
        status.textContent = 'Bitte prüfen Sie die markierten Felder.';
        status.classList.add('is-error');
        return;
      }
      var url = form.action || '';
      var configured = /^https?:\/\//.test(url) && url.indexOf('DEINE-ID') === -1;
      if (!configured) { showSuccess(form, true); return; } // Demo-Modus

      var btn = $('button[type=submit]', form), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Wird gesendet …';
      fetch(url, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); showSuccess(form, false); })
        .catch(function () {
          status.textContent = 'Das hat leider nicht geklappt. Bitte nutzen Sie „Per E-Mail senden“ oder rufen Sie uns an: ' + PHONE_DISPLAY + '.';
          status.classList.add('is-error');
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });

    var mailBtn = $('[data-mailto]', form);
    if (mailBtn) mailBtn.addEventListener('click', function () {
      status.textContent = ''; status.classList.remove('is-error');
      if (!validateForm(form)) {
        status.textContent = 'Bitte prüfen Sie die markierten Felder – dann öffnet sich Ihr E-Mail-Programm.';
        status.classList.add('is-error');
        return;
      }
      window.location.href = buildMail(form);
    });

    var wrap = form.parentNode, resetBtn = $('.form-success [data-reset]', wrap);
    if (resetBtn) resetBtn.addEventListener('click', function () {
      form.reset();
      $$('[aria-invalid]', form).forEach(function (f) { setError(f, ''); });
      if (kind === 'reservierung') { buildTimes($('#r-time'), ''); $('#group-hint').hidden = true; $('button[type=submit]', form).disabled = false; }
      $('.form-success', wrap).hidden = true;
      form.hidden = false;
      var first = $('input:not([type=hidden]), select', form); if (first) first.focus();
    });
  }

  /* ---------------------------------------------------------------
     Start
     --------------------------------------------------------------- */
  function init() {
    initBanner();
    renderStatus();
    setInterval(renderStatus, 60 * 1000);
    initNav();
    initReserveLinks();
    initOpenTable();
    initMenu();
    initHero();
    initHeader();
    initReveal();
    initParallax();
    initWeek();
    initRoute();
    renderLunch();
    initMap();
    initForm($('#reserve-form'));
    initForm($('#party-form'));
    $$('[data-year]').forEach(function (el) { el.textContent = berlinNow().y; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Für Tests in der Konsole
  window.RK_debug = { computeStatus: computeStatus, daySchedule: daySchedule };
})();
