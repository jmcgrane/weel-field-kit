// ─────────────────────────────────────────────────────────────────────────
// Weel Field Kit — engine
//
// This file is intentionally industry-agnostic. It knows nothing about
// "Aged Care" or "Multi-Site Clinics" by name — it just reads whichever
// industries are listed in data/industries.json and fetches that
// industry's JSON files from data/<id>/*.json.
//
// To add a new industry: create data/<id>/*.json matching the schema in
// README.md, add one entry to data/industries.json, done. No JS/HTML
// changes required for content-only additions.
// ─────────────────────────────────────────────────────────────────────────

// ── REGISTRY / STATE ───────────────────────────────
var INDUSTRIES = [];
var currentIndustry = null;
var PAINS = [], FLASHCARDS = [], QUIZ_QUESTIONS = [], SCENARIOS = [], PAIN_NAMES = [];
var WHY_WEEL = [], USE_CASES = [], COMPETITORS = [], CUSTOMERS = [];

async function fetchJSON(path, fallback) {
  try {
    var res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

async function loadIndustryRegistry() {
  INDUSTRIES = await fetchJSON('data/industries.json', []);
}

async function applyIndustry(id) {
  if (!INDUSTRIES.some(function (x) { return x.id === id; })) {
    id = INDUSTRIES.length ? INDUSTRIES[0].id : null;
  }
  if (!id) return;
  currentIndustry = id;
  var meta = INDUSTRIES.find(function (x) { return x.id === id; });
  var base = 'data/' + id + '/';

  var results = await Promise.all([
    fetchJSON(base + 'pains.json', []),
    fetchJSON(base + 'flashcards.json', []),
    fetchJSON(base + 'quiz.json', []),
    fetchJSON(base + 'scenarios.json', []),
    fetchJSON(base + 'why-weel-wins.json', []),
    fetchJSON(base + 'use-cases.json', []),
    fetchJSON(base + 'competitors.json', []),
    fetchJSON(base + 'customers.json', [])
  ]);
  PAINS = results[0]; FLASHCARDS = results[1]; QUIZ_QUESTIONS = results[2]; SCENARIOS = results[3];
  WHY_WEEL = results[4]; USE_CASES = results[5]; COMPETITORS = results[6]; CUSTOMERS = results[7];
  PAIN_NAMES = (meta && meta.painNames) || PAINS.map(function (p, i) { return 'Pain ' + (i + 1); });

  document.body.className = 'icp-' + id;
  applyIcpTextVisibility();
  renderIcpSwitcher();
  renderVerticalPlaybookSection();

  var badge = document.getElementById('icp-badge');
  if (badge) badge.innerHTML = (meta ? meta.label : id) + ' &#8646;';

  try { localStorage.setItem('weel_bis_icp', id); } catch (e) {}

  refreshCurrentScreen();
}

function toggleICP() {
  var idx = INDUSTRIES.findIndex(function (x) { return x.id === currentIndustry; });
  var next = INDUSTRIES[(idx + 1) % INDUSTRIES.length];
  if (next) applyIndustry(next.id);
}

// Elements marked class="icp-text <industryId>" only show for that industry.
// This replaces the old "one CSS rule per industry" approach — a new
// industry's icp-text spans just work with zero CSS edits.
function applyIcpTextVisibility() {
  document.querySelectorAll('.icp-text').forEach(function (el) {
    el.style.display = el.classList.contains(currentIndustry) ? '' : 'none';
  });
}

function renderIcpSwitcher() {
  var wrap = document.getElementById('icp-switch');
  if (!wrap) return;
  wrap.innerHTML = INDUSTRIES.map(function (ind) {
    return '<button class="icp-switch-btn' + (ind.id === currentIndustry ? ' active' : '') + '" onclick="applyIndustry(\'' + ind.id + '\')">' + ind.label + '</button>';
  }).join('');
}

// The 4 "vertical playbook" tiles on the home screen only appear once an
// industry actually has content for them — so a brand-new industry with
// only pains filled in doesn't show broken/empty tabs.
function renderVerticalPlaybookSection() {
  var wrap = document.getElementById('vertical-playbook');
  if (!wrap) return;
  var tiles = [];
  if (WHY_WEEL.length) tiles.push({ fn: 'goWhyWeel', icon: '&#127942;', name: 'Why Weel Wins', desc: 'The USPs that matter most for this vertical.' });
  if (CUSTOMERS.length) tiles.push({ fn: 'goCustomers', icon: '&#129309;', name: 'Existing Customers', desc: 'Named wins and social proof for this vertical.' });
  if (USE_CASES.length) tiles.push({ fn: 'goUseCases', icon: '&#129513;', name: 'Core Use Cases', desc: 'The main jobs Weel gets hired to do here.' });
  if (COMPETITORS.length) tiles.push({ fn: 'goCompetitors', icon: '&#129362;', name: 'Competitor Landscape', desc: 'Who else comes up, and how to position against them.' });
  if (!tiles.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div class="sec-label">Vertical Playbook</div><div class="mode-grid">'
    + tiles.map(function (t) {
      return '<div class="mode-card" onclick="' + t.fn + '()"><div class="mode-icon">' + t.icon + '</div><div class="mode-name">' + t.name + '</div><div class="mode-desc">' + t.desc + '</div></div>';
    }).join('')
    + '</div>';
}

function refreshCurrentScreen() {
  var active = document.querySelector('.screen.active');
  if (!active) return;
  var id = active.id;
  if (id === 'home') updateHomeUI();
  else if (id === 'study') { curPain = 0; buildPainNav(); showPain(0); }
  else if (id === 'flashcards') initFlashcards();
  else if (id === 'quiz') initQuiz();
  else if (id === 'scenario') { scIdx = 0; showScenario(); }
  else if (id === 'whyweel') renderCardGrid('whyweel-body', WHY_WEEL, 'Multi-site medical, dental, radiology and allied-health groups grow fast — spend management usually can\'t keep up. Here\'s what actually wins the deal in this vertical.');
  else if (id === 'usecases') renderCardGrid('usecases-body', USE_CASES, 'The main jobs Weel gets hired to do inside this vertical.');
  else if (id === 'customers') renderCustomers();
  else if (id === 'competitors') renderCompetitors();
}

// ── STATE (per-browser progress, keyed by industry) ────────────────────
function load() { try { return JSON.parse(localStorage.getItem('weel_bis_v2') || '{}'); } catch (e) { return {}; } }
function save(s) { try { localStorage.setItem('weel_bis_v2', JSON.stringify(s)); } catch (e) {} }
function icpState(s) { if (!s[currentIndustry]) s[currentIndustry] = {}; return s[currentIndustry]; }

function recordStreak() {
  var s = load(), today = new Date().toDateString(), yesterday = new Date(Date.now() - 86400000).toDateString();
  if (s.lastDay === today) return;
  s.streak = s.lastDay === yesterday ? (s.streak || 0) + 1 : 1;
  s.lastDay = today;
  save(s);
}
function getStreak() { return load().streak || 0; }
function saveCardRating(id, r) { var s = load(), st = icpState(s); if (!st.cr) st.cr = {}; if (!st.cr[id]) st.cr[id] = []; st.cr[id].push(r); save(s); }
function saveQuizResult(id, correct) { var s = load(), st = icpState(s); if (!st.qr) st.qr = {}; if (!st.qr[id]) st.qr[id] = []; st.qr[id].push(correct); save(s); }

function getPainScore(i) {
  var s = load(), st = icpState(s), cards = FLASHCARDS.filter(function (c) { return c.pain === i; }), qs = QUIZ_QUESTIONS.filter(function (q) { return q.pain === i; }), total = 0, earned = 0;
  cards.forEach(function (c) { var r = (st.cr || {})[c.id] || []; if (r.length) { var last = r[r.length - 1]; total += 3; earned += last; } });
  qs.forEach(function (q) { var r = (st.qr || {})[q.id] || []; if (r.length) { total += 1; earned += r[r.length - 1] ? 1 : 0; } });
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}
function getOverall() {
  var scores = PAINS.map(function (_, i) { return getPainScore(i); }), attempted = scores.filter(function (s) { return s > 0; });
  return attempted.length === 0 ? 0 : Math.round(attempted.reduce(function (a, b) { return a + b; }, 0) / attempted.length);
}
function getWeightedDeck() {
  var s = load(), st = icpState(s), weighted = [];
  FLASHCARDS.forEach(function (c) { var r = (st.cr || {})[c.id] || [], last = r.length ? r[r.length - 1] : 2, w = last === 1 ? 3 : last === 2 ? 2 : 1; for (var i = 0; i < w; i++) weighted.push(c); });
  return shuffle(weighted).slice(0, 15);
}
function shuffle(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// ── NAV ────────────────────────────────────────────
function show(id) { document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); }); document.getElementById(id).classList.add('active'); }
function goHome() { updateHomeUI(); show('home'); }
function goStudy() { show('study'); buildPainNav(); showPain(0); }
function goFlashcards() { recordStreak(); updateHomeUI(); show('flashcards'); initFlashcards(); }
function goQuiz() { recordStreak(); updateHomeUI(); show('quiz'); initQuiz(); }
function goScenario() { show('scenario'); scIdx = 0; showScenario(); }
function goWalkthrough() { show('walkthrough'); window.scrollTo(0, 0); }
function goProduct() { show('product'); loadPitch(); window.scrollTo(0, 0); }
function goIntegrations() { show('integrations'); window.scrollTo(0, 0); }
function goWhyWeel() { show('whyweel'); renderCardGrid('whyweel-body', WHY_WEEL, 'Multi-site medical, dental, radiology and allied-health groups grow fast — spend management usually can\'t keep up. Here\'s what actually wins the deal in this vertical.'); window.scrollTo(0, 0); }
function goCustomers() { show('customers'); renderCustomers(); window.scrollTo(0, 0); }
function goUseCases() { show('usecases'); renderCardGrid('usecases-body', USE_CASES, 'The main jobs Weel gets hired to do inside this vertical.'); window.scrollTo(0, 0); }
function goCompetitors() { show('competitors'); renderCompetitors(); window.scrollTo(0, 0); }

function toggleTile(id) {
  var tile = document.getElementById(id + '-arrow').closest('.prod-tile');
  tile.classList.toggle('open');
}
function loadPitch() {
  var s = load(), box = document.getElementById('pitch-box');
  if (!box) return;
  var saved = s.pitch;
  var textEl = box.querySelector('.pitch-text');
  if (saved && saved.trim()) {
    textEl.textContent = '"' + saved + '"';
    textEl.classList.remove('placeholder');
  } else {
    textEl.textContent = '[ Your pitch goes here — tap edit and paste it in. ]';
    textEl.classList.add('placeholder');
  }
}
function editPitch() {
  event.stopPropagation();
  var s = load(), current = s.pitch || '';
  var next = prompt('Paste your high-level pitch here. This is what you say when someone asks "what does Weel do?".', current);
  if (next === null) return;
  s.pitch = next.trim();
  save(s);
  loadPitch();
}

// ── VERTICAL-PLAYBOOK SCREENS (why weel wins / use cases / customers / competitors) ──
function renderCardGrid(elId, items, introText) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="pitch-box"><div class="pitch-text placeholder">[ No data yet for this industry — to be added. ]</div></div>';
    return;
  }
  el.innerHTML = (introText ? '<p class="pi-sub">' + introText + '</p>' : '')
    + '<div class="wt-grid">' + items.map(function (it) {
      return '<div class="wt-card"><div class="wt-card-title">' + it.title + '</div><div class="wt-card-text">' + it.text + '</div></div>';
    }).join('') + '</div>';
}
// Customers support two shapes: the simple {industry, businesses} directory
// (used when all you have is a list of named accounts) and a richer
// {name, segment, challenge, solution, proof} story format (used when real
// case-study detail exists, e.g. from a sales deck). Detected automatically.
function renderCustomers() {
  var el = document.getElementById('customers-body');
  if (!el) return;
  if (!CUSTOMERS.length) {
    el.innerHTML = '<div class="pitch-box"><div class="pitch-text placeholder">[ Named customer wins and social proof for this industry go here — to be added. ]</div></div>';
    return;
  }
  var intro = '<p class="pi-sub">Real, named customers already running Weel. Use these when a prospect asks &ldquo;who else uses this?&rdquo;</p>';
  if (CUSTOMERS[0].name) {
    el.innerHTML = intro + CUSTOMERS.map(function (c) {
      return '<div class="intg-card">'
        + '<div class="intg-top"><div class="intg-name">' + c.name + '</div></div>'
        + '<div class="intg-when">' + c.segment + '</div>'
        + '<div class="pt-d-row"><strong>Challenge:</strong> ' + c.challenge + '</div>'
        + '<div class="pt-d-row"><strong>Solution:</strong> ' + c.solution + '</div>'
        + '<div class="pt-d-row"><strong>Proof:</strong> ' + c.proof + '</div>'
        + '</div>';
    }).join('');
    return;
  }
  el.innerHTML = intro + '<div class="wt-grid">'
    + CUSTOMERS.map(function (c) {
      return '<div class="wt-card"><div class="wt-card-title">' + c.industry + '</div><div class="wt-card-text">' + c.businesses + '</div></div>';
    }).join('') + '</div>';
}
function renderCompetitors() {
  var el = document.getElementById('competitors-body');
  if (!el) return;
  if (!COMPETITORS.length) {
    el.innerHTML = '<div class="pitch-box"><div class="pitch-text placeholder">[ Competitor landscape for this industry goes here — to be added. ]</div></div>';
    return;
  }
  el.innerHTML = COMPETITORS.map(function (c) {
    var statusClass = 'intg-status' + (c.statusClass ? ' ' + c.statusClass : '');
    return '<div class="intg-card"><div class="intg-top"><div class="intg-name">' + c.name + '</div><div class="' + statusClass + '">' + c.status + '</div></div><div class="intg-when">' + c.when + '</div><div class="intg-flow"><strong>Angle:</strong> ' + c.angle + '</div></div>';
  }).join('');
}

// ── HOME UI ────────────────────────────────────────
function updateHomeUI() {
  var pct = getOverall();
  document.getElementById('streak-num').textContent = getStreak();
  document.getElementById('home-pct').textContent = pct + '%';
  document.getElementById('home-fill').style.width = pct + '%';
  document.getElementById('readiness-mini').innerHTML = PAINS.map(function (p, i) {
    var score = getPainScore(i), col = score === 0 ? '#cdc7b9' : score < 40 ? '#EF5B49' : score < 70 ? '#F2A93C' : score < 85 ? '#5B8DEF' : '#2FB673';
    var label = PAIN_NAMES[i] || p.title || ('Pain ' + (i + 1));
    return '<div class="rm-item"><div style="font-weight:800;font-size:18px;color:' + col + ';margin-bottom:2px;letter-spacing:-.01em">' + (score > 0 ? score + '%' : String(i + 1)) + '</div><div style="font-size:10px;color:#8a847a;font-weight:600;letter-spacing:.04em;text-transform:uppercase">' + label + '</div><div class="rm-bar"><div class="rm-fill" style="width:' + score + '%;background:' + col + '"></div></div></div>';
  }).join('');
}

// ── TOP PAIN POINTS ────────────────────────────────
var curPain = 0;
function isSimplePains() { return !!(PAINS && PAINS[0] && PAINS[0].summary !== undefined); }
function buildPainNav() {
  if (isSimplePains()) { document.getElementById('pain-nav').innerHTML = ''; return; }
  document.getElementById('pain-nav').innerHTML = PAINS.map(function (p, i) {
    return '<div class="pain-dot' + (i === curPain ? ' active' : '') + '" onclick="showPain(' + i + ')">' + (i + 1) + '</div>';
  }).join('');
}
function showPain(i) {
  if (isSimplePains()) { renderPainsList(); return; }
  curPain = i; buildPainNav();
  var p = PAINS[i];
  var html = '<div class="pain-number">' + p.num + '</div>'
    + '<div class="pain-title">' + p.title + '</div>'
    + '<div class="they-say">They say: <em>&ldquo;' + p.theySay + '&rdquo;</em></div>'
    + '<div class="chain-label">The story &mdash; field reality &rarr; broken system &rarr; consequence &rarr; risk</div>'
    + '<div class="story-block">' + p.story + '</div>'
    + '<div class="phone-line"><div class="phone-label">&#128222; What to say on the phone</div><div class="phone-text">' + p.phoneQ + '</div></div>'
    + '<div class="root-cause"><div class="rc-label">&#9889; Root cause</div><div class="rc-text">' + p.rootCause + '</div></div>'
    + '<div class="nav-btns">'
    + (i > 0 ? '<button class="btn" onclick="showPain(' + (i - 1) + ')">&#8592; Prev</button>' : '')
    + (i < PAINS.length - 1 ? '<button class="btn primary" onclick="showPain(' + (i + 1) + ')">Next Pain &#8594;</button>' : '<button class="btn primary" onclick="goHome()">Done &mdash; Back to Home</button>')
    + '</div>';
  var el = document.getElementById('pain-card');
  el.innerHTML = html;
  el.style.animation = 'none';
  setTimeout(function () { el.style.animation = ''; }, 10);
}
function renderPainsList() {
  var html = PAINS.map(function (p, i) {
    return '<div class="story-block" style="margin-bottom:14px">'
      + '<div style="font-weight:900;font-size:20px;color:var(--text);margin-bottom:8px;letter-spacing:-.01em">' + (i + 1) + '. ' + p.title + '</div>'
      + '<div>' + p.summary + '</div>'
      + '</div>';
  }).join('')
    + '<div class="nav-btns"><button class="btn primary" onclick="goHome()">Done &mdash; Back to Home</button></div>';
  var el = document.getElementById('pain-card');
  el.innerHTML = html;
  el.style.animation = 'none';
  setTimeout(function () { el.style.animation = ''; }, 10);
}

// ── FLASHCARDS ─────────────────────────────────────
var fDeck = [], fIdx = 0, fFlipped = false, fSess = { s: 0, g: 0, c: 0 };
function initFlashcards() {
  fDeck = getWeightedDeck(); fIdx = 0; fFlipped = false; fSess = { s: 0, g: 0, c: 0 };
  document.getElementById('fc-done').classList.remove('visible');
  document.querySelector('.card-scene').style.display = 'block';
  document.getElementById('conf-row').classList.remove('visible');
  showFC();
}
function showFC() {
  if (fIdx >= fDeck.length) { showFCDone(); return; }
  var c = fDeck[fIdx]; fFlipped = false;
  document.getElementById('card-3d').classList.remove('flipped');
  document.getElementById('fc-pain-tag').textContent = 'Pain 0' + (c.pain + 1) + ' — ' + PAINS[c.pain].title;
  document.getElementById('fc-q').textContent = c.q;
  document.getElementById('fc-a').textContent = c.a;
  document.getElementById('conf-row').classList.remove('visible');
  var pct = Math.round((fIdx / fDeck.length) * 100);
  document.getElementById('fc-bar').style.width = pct + '%';
  document.getElementById('fc-counter').textContent = fIdx + ' / ' + fDeck.length;
}
function flipCard() {
  if (fFlipped) return; fFlipped = true;
  document.getElementById('card-3d').classList.add('flipped');
  document.getElementById('conf-row').classList.add('visible');
}
function rateCard(r) {
  saveCardRating(fDeck[fIdx].id, r);
  if (r === 1) fSess.s++; else if (r === 2) fSess.g++; else fSess.c++;
  fIdx++; showFC();
}
function showFCDone() {
  document.getElementById('conf-row').classList.remove('visible');
  document.getElementById('fc-done').classList.add('visible');
  document.getElementById('fc-done-scores').innerHTML =
    '<div class="fc-score-pill r">😬 Shaky: ' + fSess.s + '</div>'
    + '<div class="fc-score-pill a">👍 Got it: ' + fSess.g + '</div>'
    + '<div class="fc-score-pill g">🧊 Cold: ' + fSess.c + '</div>';
}

// ── QUIZ ───────────────────────────────────────────
var qType = 'all', qDeck = [], qIdx = 0, qCorrect = 0, qAnswered = false, qResults = [];
function setQType(t) {
  qType = t;
  document.querySelectorAll('.qt-pill').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('qt-' + t).classList.add('active');
  initQuiz();
}
function initQuiz() {
  var pool = QUIZ_QUESTIONS;
  if (qType !== 'all') pool = pool.filter(function (q) { return q.type === qType; });
  qDeck = shuffle(pool).slice(0, Math.min(8, pool.length));
  qIdx = 0; qCorrect = 0; qAnswered = false; qResults = [];
  document.getElementById('quiz-done').classList.remove('visible');
  renderQ();
}
function renderQ() {
  if (qIdx >= qDeck.length) { showQuizDone(); return; }
  var q = qDeck[qIdx]; qAnswered = false;
  var pct = Math.round((qIdx / qDeck.length) * 100);
  document.getElementById('qp-bar').style.width = pct + '%';
  document.getElementById('qp-label').textContent = (qIdx + 1) + ' / ' + qDeck.length;
  var typeLabel = { mc: 'Multiple Choice', fitb: 'Fill in the Blank', scenario: 'Scenario' }[q.type];
  var h = '<div class="quiz-card">'
    + '<div class="q-type-tag">' + typeLabel + '</div>'
    + '<div class="q-pain-tag">Pain 0' + (q.pain + 1) + ' — ' + PAINS[q.pain].title + '</div>'
    + '<div class="q-text">' + q.q + '</div>';
  if (q.type === 'scenario') h += '<div class="scenario-ctx"><div class="sc-ctx-label">The situation</div>' + q.context + '</div>';
  if (q.type === 'mc' || q.type === 'scenario')
    h += '<div class="options">' + q.options.map(function (o, i) { return '<div class="option" id="opt-' + i + '" onclick="answerMC(' + i + ')">' + o + '</div>'; }).join('') + '</div>';
  if (q.type === 'fitb') {
    var parts = q.q.split('___________');
    h += '<div class="fitb-wrap">' + parts[0] + '<input class="fitb-input" id="fitb-in" placeholder="' + q.hint + '" onkeydown="if(event.keyCode===13)checkFitb()"/>' + (parts[1] || '') + '</div>';
  }
  h += '<div class="q-feedback" id="q-feedback"><div class="fb-title" id="fb-title"></div><div id="fb-exp"></div></div>';
  h += '<div class="quiz-nav">';
  if (q.type === 'fitb') h += '<button class="btn primary" id="check-btn" onclick="checkFitb()">Check answer</button>';
  h += '<button class="btn" id="next-btn" style="display:none" onclick="nextQ()">Next →</button></div></div>';
  document.getElementById('quiz-card-wrap').innerHTML = h;
}
function answerMC(idx) {
  if (qAnswered) return; qAnswered = true;
  var q = qDeck[qIdx], ok = idx === q.correct;
  saveQuizResult(q.id, ok); if (ok) qCorrect++;
  qResults.push({ q: q.q.substring(0, 55) + '…', ok: ok });
  document.querySelectorAll('.option').forEach(function (el, i) {
    el.setAttribute('disabled', 'true');
    if (i === q.correct) el.classList.add('correct');
    else if (i === idx && !ok) el.classList.add('wrong');
  });
  showFeedback(ok, q.explanation);
}
function checkFitb() {
  if (qAnswered) return; qAnswered = true;
  var q = qDeck[qIdx], inp = document.getElementById('fitb-in');
  if (!inp) return;
  var val = inp.value.trim().toLowerCase(), tgt = q.blank.toLowerCase();
  var ok = val.includes(tgt) || tgt.includes(val) || simScore(val, tgt) > 0.65;
  saveQuizResult(q.id, ok); if (ok) qCorrect++;
  qResults.push({ q: q.q.substring(0, 55) + '…', ok: ok });
  inp.classList.add(ok ? 'correct' : 'wrong');
  if (!ok) inp.value = q.blank;
  var cb = document.getElementById('check-btn'); if (cb) cb.style.display = 'none';
  showFeedback(ok, q.explanation);
}
function simScore(a, b) {
  if (!a || !b) return 0;
  var l = a.length > b.length ? a : b, s = a.length > b.length ? b : a;
  if (l.length === 0) return 1;
  function ed(s, t) { var m = s.length, n = t.length, d = []; for (var i = 0; i <= m; i++) { d[i] = []; for (var j = 0; j <= n; j++) d[i][j] = i === 0 ? j : j === 0 ? i : 0; } for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++) d[i][j] = s[i - 1] === t[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]); return d[m][n]; }
  return (l.length - ed(l, s)) / l.length;
}
function showFeedback(ok, exp) {
  var fb = document.getElementById('q-feedback');
  fb.classList.add('visible', ok ? 'good' : 'bad');
  document.getElementById('fb-title').textContent = ok ? '✓ Correct' : '✗ Not quite';
  document.getElementById('fb-exp').textContent = exp;
  document.getElementById('next-btn').style.display = 'inline-block';
}
function nextQ() { qIdx++; renderQ(); }
function showQuizDone() {
  document.getElementById('quiz-card-wrap').innerHTML = '';
  document.getElementById('quiz-done').classList.add('visible');
  var pct = Math.round((qCorrect / qDeck.length) * 100);
  var el = document.getElementById('result-score');
  el.textContent = pct + '%';
  el.style.color = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--accent2)' : 'var(--red)';
  document.getElementById('result-label').textContent = qCorrect + ' of ' + qDeck.length + ' correct — ' + (pct >= 80 ? 'You know this cold.' : pct >= 60 ? 'Getting there. Run it again.' : 'Study first, then come back.');
  document.getElementById('result-breakdown').innerHTML = qResults.map(function (r) {
    return '<div class="result-item"><span class="ri-q">' + r.q + '</span><span class="' + (r.ok ? 'ri-pass' : 'ri-fail') + '">' + (r.ok ? '✓' : '✗') + '</span></div>';
  }).join('');
}

// ── SCENARIOS ──────────────────────────────────────
var scIdx = 0;
function showScenario() {
  var sc = SCENARIOS[scIdx];
  document.getElementById('sc-counter').textContent = (scIdx + 1) + ' of ' + SCENARIOS.length;
  var h = '<div class="scenario-box"><div class="sc-box-label">&#128222; The prospect says...</div><div class="sc-box-text">&ldquo;' + sc.prospect + '&rdquo;</div></div>'
    + '<p style="font-size:10px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.15em">Your response &mdash; write it before you look:</p>'
    + '<textarea class="answer-area" placeholder="Type how you would respond... be specific. What do you actually say?"></textarea>'
    + '<div style="display:flex;gap:10px;margin-bottom:16px"><button class="btn primary" onclick="revealSc()">Reveal ideal response</button></div>'
    + '<div class="reveal-panel" id="reveal-panel"><strong>What you should be doing:</strong><br>' + sc.ideal + '<div class="reveal-hook"><strong>The exact words:</strong><br>' + sc.hook + '</div></div>'
    + '<div style="display:flex;gap:10px;margin-top:4px">'
    + (scIdx > 0 ? '<button class="btn" onclick="scNav(-1)">&#8592; Prev</button>' : '')
    + (scIdx < SCENARIOS.length - 1 ? '<button class="btn primary" onclick="scNav(1)">Next Scenario &#8594;</button>' : '<button class="btn" onclick="goHome()">Done &#10003;</button>')
    + '</div>';
  document.getElementById('scenario-body').innerHTML = h;
}
function revealSc() { document.getElementById('reveal-panel').classList.add('show'); }
function scNav(d) { scIdx = Math.max(0, Math.min(SCENARIOS.length - 1, scIdx + d)); showScenario(); }

// ── INIT ───────────────────────────────────────────
(async function init() {
  await loadIndustryRegistry();
  if (!INDUSTRIES.length) {
    document.getElementById('home').innerHTML = '<div class="home-inner"><p class="subtitle">No industries configured. Check data/industries.json.</p></div>';
    return;
  }
  var saved = INDUSTRIES[0].id;
  try { var stored = localStorage.getItem('weel_bis_icp'); if (stored) saved = stored; } catch (e) {}
  await applyIndustry(INDUSTRIES.some(function (x) { return x.id === saved; }) ? saved : INDUSTRIES[0].id);
  recordStreak();
  updateHomeUI();
})();
