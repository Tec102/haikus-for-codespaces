/*
 * Live scoring + in-browser notifications for the World Cup page.
 *
 * Polls /api/live every 30s, merges scores into the predicted match rows,
 * keeps a running feed of changes, and fires a Web Notification whenever a
 * score changes or a match goes live / finishes.
 */
(function () {
  var POLL_MS = 30000;
  var statusEl = document.getElementById('live-status');
  var boardEl = document.getElementById('live-board');
  var feedEl = document.getElementById('live-feed');
  var notifyBtn = document.getElementById('notify-btn');

  var lastState = {}; // matchKey -> { status, home, away, hs, as }
  var firstLoad = true;

  // --- notifications -------------------------------------------------------
  function refreshNotifyBtn() {
    if (!('Notification' in window)) {
      notifyBtn.textContent = 'Notifications unsupported';
      notifyBtn.disabled = true;
      return;
    }
    if (Notification.permission === 'granted') {
      notifyBtn.textContent = '🔔 Notifications on';
      notifyBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      notifyBtn.textContent = 'Notifications blocked';
      notifyBtn.disabled = true;
    } else {
      notifyBtn.textContent = 'Enable notifications';
      notifyBtn.disabled = false;
    }
  }
  notifyBtn.addEventListener('click', function () {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(refreshNotifyBtn);
  });
  refreshNotifyBtn();

  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: body, tag: title }); } catch (e) {}
    }
  }

  // --- feed ----------------------------------------------------------------
  function pushFeed(text) {
    var li = document.createElement('div');
    li.className = 'feed-item';
    var t = new Date().toLocaleTimeString();
    li.textContent = '[' + t + '] ' + text;
    feedEl.insertBefore(li, feedEl.firstChild);
    while (feedEl.childNodes.length > 30) feedEl.removeChild(feedEl.lastChild);
  }

  function keyOf(m) { return (m.home || '?') + '|' + (m.away || '?'); }

  // Merge a live score into any predicted match/tie row with the same teams.
  function paintRows(m) {
    var rows = document.querySelectorAll(
      '[data-home="' + cssEsc(m.home) + '"][data-away="' + cssEsc(m.away) + '"],' +
      '[data-home="' + cssEsc(m.away) + '"][data-away="' + cssEsc(m.home) + '"]'
    );
    rows.forEach(function (row) {
      var span = row.querySelector('[data-live]');
      if (!span) return;
      if (m.homeScore == null) { span.textContent = ''; return; }
      var flipped = row.getAttribute('data-home') === m.away;
      var hs = flipped ? m.awayScore : m.homeScore;
      var as = flipped ? m.homeScore : m.awayScore;
      var label = m.status === 'LIVE' ? (m.minute ? m.minute + "'" : 'LIVE') : m.status;
      span.textContent = ' ' + hs + '–' + as + ' (' + label + ')';
      span.className = 'live-score s-' + m.status;
    });
  }

  function cssEsc(s) { return (s || '').replace(/"/g, '\\"'); }

  // --- board ---------------------------------------------------------------
  function renderBoard(matches) {
    var live = matches.filter(function (m) { return m.status === 'LIVE'; });
    var soon = matches.filter(function (m) { return m.status === 'SCHEDULED'; });
    var done = matches.filter(function (m) { return m.status === 'FINISHED'; });
    var show = live.concat(soon.slice(0, 4)).concat(done.slice(-4));
    if (!show.length) { boardEl.innerHTML = ''; return; }
    boardEl.innerHTML = show.map(function (m) {
      var score = m.homeScore == null ? 'v' : m.homeScore + '–' + m.awayScore;
      var label = m.status === 'LIVE' ? (m.minute ? m.minute + "'" : 'LIVE') : m.status;
      return '<div class="lb s-' + m.status + '">' +
        '<span class="lb-team">' + m.home + '</span>' +
        '<span class="lb-score">' + score + '</span>' +
        '<span class="lb-team">' + m.away + '</span>' +
        '<span class="lb-status">' + label + '</span></div>';
    }).join('');
  }

  // --- diffing -------------------------------------------------------------
  function process(matches) {
    matches.forEach(function (m) {
      paintRows(m);
      var k = keyOf(m);
      var prev = lastState[k];
      var hs = m.homeScore, as = m.awayScore;
      if (!firstLoad) {
        if (!prev && m.status === 'LIVE') {
          var msg = 'Kickoff: ' + m.home + ' v ' + m.away;
          pushFeed(msg); notify('Match started', msg);
        } else if (prev) {
          if ((prev.hs !== hs || prev.as !== as) && hs != null) {
            var s = m.home + ' ' + hs + '–' + as + ' ' + m.away;
            pushFeed('GOAL! ' + s); notify('⚽ Goal — ' + s, m.minute ? m.minute + "'" : '');
          }
          if (prev.status !== 'FINISHED' && m.status === 'FINISHED') {
            var f = 'FT: ' + m.home + ' ' + hs + '–' + as + ' ' + m.away;
            pushFeed(f); notify('Full time', f);
          }
        }
      }
      lastState[k] = { status: m.status, hs: hs, as: as, home: m.home, away: m.away };
    });
  }

  function poll() {
    fetch('/api/live', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.configured) {
          statusEl.textContent = '⚪ ' + (data.message || 'Live scores not configured.');
        } else if (!data.live) {
          statusEl.textContent = '🟡 ' + (data.message || 'Live feed unavailable.');
        } else {
          var n = data.matches.filter(function (m) { return m.status === 'LIVE'; }).length;
          statusEl.textContent = n
            ? '🔴 ' + n + ' match' + (n > 1 ? 'es' : '') + ' live now'
            : '🟢 Live feed connected — no matches in play right now.';
          process(data.matches);
          renderBoard(data.matches);
        }
        firstLoad = false;
      })
      .catch(function () { statusEl.textContent = '🟡 Could not reach live feed.'; });
  }

  poll();
  setInterval(poll, POLL_MS);
})();
