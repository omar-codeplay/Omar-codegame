/* ════════════════════════════════════════
   CHESS.JS  — Full-featured local chess (Clean Version)
   ════════════════════════════════════════ */

'use strict';

// ── TIME CONTROL DATA ──────────────────────────────────────────────────────
const TIME_CONTROLS = {
  bullet:    [
    { label:'1+0',  min:1,  inc:0  },
    { label:'1+1',  min:1,  inc:1  },
    { label:'2+1',  min:2,  inc:1  },
  ],
  blitz:     [
    { label:'3+0',  min:3,  inc:0  },
    { label:'3+2',  min:3,  inc:2  },
    { label:'5+0',  min:5,  inc:0  },
    { label:'5+3',  min:5,  inc:3  },
    { label:'5+5',  min:5,  inc:5  },
    { label:'10+0', min:10, inc:0  },
  ],
  rapid:     [
    { label:'10+0', min:10, inc:0  },
    { label:'10+5', min:10, inc:5  },
    { label:'15+10',min:15, inc:10 },
    { label:'20+0', min:20, inc:0  },
    { label:'30+0', min:30, inc:0  },
    { label:'30+20',min:30, inc:20 },
  ],
  classical: [
    { label:'60+0', min:60, inc:0  },
    { label:'90+30',min:90, inc:30 },
    { label:'120+0',min:120,inc:0  },
  ],
  unlimited: [
    { label:'∞',    min:0,  inc:0  },
  ],
  custom:    [],
};

const PIECE_VALUES = { p:1, n:3, b:3, r:5, q:9 };
const PIECE_SYMBOLS = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛' };
const PIECE_NAMES   = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };

// ── GAME LIBRARY ───────────────────────────────────────────────────────────
class GameLibrary {
  constructor() { this.games = JSON.parse(localStorage.getItem('chess_games_v2') || '[]'); }
  save(name, pgn, tc) {
    const g = { id: Date.now(), name, date: new Date().toLocaleString(), pgn, tc,
      moves: (pgn.match(/\d+\./g)||[]).length };
    this.games.push(g);
    this._persist();
    return g.id;
  }
  delete(id) { this.games = this.games.filter(g => g.id !== id); this._persist(); }
  get(id)    { return this.games.find(g => g.id === id); }
  all()      { return [...this.games].reverse(); }
  _persist() { localStorage.setItem('chess_games_v2', JSON.stringify(this.games)); }
}

// ── CLOCK ──────────────────────────────────────────────────────────────────
class Clock {
  constructor(seconds, increment) {
    this.initial   = seconds;
    this.increment = increment;
    this.white     = seconds;
    this.black     = seconds;
    this.active    = null; // 'white' | 'black'
    this._tid      = null;
    this._last     = null;
  }

  start(color) {
    this.stop();
    this.active = color;
    this._last  = Date.now();
    this._tid   = setInterval(() => this._tick(), 100);
  }

  stop() {
    if (this._tid) { clearInterval(this._tid); this._tid = null; }
    this.active = null;
  }

  switch(fromColor) {
    if (this.increment > 0) this[fromColor] += this.increment;
    const nextColor = fromColor === 'white' ? 'black' : 'white';
    this.start(nextColor);
  }

  _tick() {
    const now = Date.now();
    const dt  = (now - this._last) / 1000;
    this._last = now;
    if (this.active === 'white') this.white = Math.max(0, this.white - dt);
    else if (this.active === 'black') this.black = Math.max(0, this.black - dt);
    if (this[this.active] <= 0) {
      this.stop();
      if (window._gameActive) {
        window._gameActive = false;
        showResult(`timeout-${this.active}`);
      }
    }
  }

  fmt(color) {
    if (this.initial === 0) return '∞';
    const s = Math.ceil(this[color]);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
  }

  isLow(color) {
    return this.initial > 0 && this[color] < 30;
  }
}

// ── GLOBAL VARIABLES ────────────────────────────────────────────────────────
let _chess, _board, _clock, _lib;
let _orientation  = 'white';
let _theme        = 'green';
let _selectedSq   = null;
let _isDragging   = false;
let _promoFrom    = null, _promoTo = null;
let _gameActive   = false;
let _moveHistory  = [];
let _viewIdx      = -1;
let _pWhite       = 'Player 1';
let _pBlack       = 'Player 2';
let _tc           = { label:'10+0', min:10, inc:0, category:'rapid' };
let _clockTimer   = null;
let _eventsAttached = false;

// Expose _gameActive for clock
window._gameActive = _gameActive;

// ── HELPER FUNCTIONS ───────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function sqEl(sq) {
  return $(`#board .square-55d63[data-square="${sq}"]`);
}

function clearClass(cls) {
  $$(`#board .${cls}`).forEach(e => e.classList.remove(cls));
}

function catLabel(cat) {
  return { bullet:'Bullet', blitz:'Blitz', rapid:'Rapid', classical:'Classical',
           unlimited:'Unlimited', custom:'Custom' }[cat] || cat;
}

// ── PIECE THEME ────────────────────────────────────────────────────────────
function pieceTheme(piece) {
  const color = piece[0] === 'w' ? 'white' : 'black';
  const type  = PIECE_NAMES[piece[1].toLowerCase()];
  return `chess/images/${color}-${type}.png`;
}

// ── SOUND ──────────────────────────────────────────────────────────────────
function playSound(id) {
  const el = document.getElementById('snd-' + id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

// ── SETUP UI ───────────────────────────────────────────────────────────────
function renderTCOpts(cat) {
  const container = $('#tc-options');
  const list = TIME_CONTROLS[cat] || [];
  container.innerHTML = '';

  if (cat === 'unlimited') {
    _tc = { label:'∞', min:0, inc:0, category:'unlimited' };
    const div = document.createElement('div');
    div.className = 'tc-opt selected';
    div.innerHTML = `<div class="tc-opt-main">∞</div><div class="tc-opt-label">No limit</div>`;
    container.appendChild(div);
    return;
  }

  if (cat === 'custom') {
    _tc = { label:'Custom', min:10, inc:0, category:'custom' };
    return;
  }

  list.forEach((tc, i) => {
    const div = document.createElement('div');
    div.className = 'tc-opt' + (i === 0 ? ' selected' : '');
    div.innerHTML = `<div class="tc-opt-main">${tc.label}</div><div class="tc-opt-label">${catLabel(cat)}</div>`;
    div.addEventListener('click', () => {
      $$('.tc-opt').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      _tc = { ...tc, category: cat };
    });
    if (i === 0) _tc = { ...tc, category: cat };
    container.appendChild(div);
  });
}

function getCurrentTC() {
  const cat = $('.tc-tab.active')?.dataset.cat || 'rapid';
  if (cat === 'custom') {
    const min = parseInt($('#custom-min').value) || 0;
    const inc = parseInt($('#custom-inc').value) || 0;
    return { label: `${min}+${inc}`, min, inc, category:'custom' };
  }
  if (cat === 'unlimited') return { label:'∞', min:0, inc:0, category:'unlimited' };
  return _tc;
}

// ── INIT SETUP TABS ────────────────────────────────────────────────────────
(function initSetup() {
  $$('.tc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;
      renderTCOpts(cat);
      $('#custom-tc').style.display = cat === 'custom' ? 'block' : 'none';
    });
  });
  renderTCOpts('bullet');
})();

// ── GAME FUNCTIONS ──────────────────────────────────────────────────────────

function launchGame(pWhite, pBlack, tc) {
  _pWhite = pWhite;
  _pBlack = pBlack;
  _tc     = tc;
  _lib    = _lib || new GameLibrary();

  // Set names in UI
  $('#pname-white').textContent = pWhite;
  $('#pname-black').textContent = pBlack;
  $('#game-badge').textContent  = `${catLabel(tc.category)} · ${tc.label}`;
  $('#rs-white').textContent    = pWhite;
  $('#rs-black').textContent    = pBlack;

  // Reset chess state
  _chess = new Chess();
  _moveHistory = [];
  _viewIdx     = -1;
  _gameActive  = true;
  window._gameActive = true;
  _selectedSq  = null;
  _isDragging  = false;

  // Initialize board
  if (_board) { _board.destroy(); _board = null; }

  _board = ChessBoard('board', {
    draggable:   true,
    position:    'start',
    orientation: _orientation,
    pieceTheme:  pieceTheme,
    onDragStart: _onDragStart,
    onDrop:      _onDrop,
    onSnapEnd:   _onSnapEnd,
  });

  window.addEventListener('resize', () => _board && _board.resize());

  // Board click and touch handling
  const boardEl = $('#board');
  boardEl.onclick = null;
  boardEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  boardEl.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
  boardEl.addEventListener('click', _onBoardClick);

  // Clock
  const secs = tc.min * 60;
  _clock = new Clock(secs, tc.inc);
  if (secs > 0) _clock.start('white');

  if (_clockTimer) clearInterval(_clockTimer);
  _clockTimer = setInterval(_updateClocks, 100);

  _renderMoveList();
  _updateAllUI();
  _attachGameEvents();
}

// ── DRAG / DROP ────────────────────────────────────────────────────────────
function _onDragStart(source, piece) {
  _isDragging = true;
  _clearSel();
  if (!_gameActive || _chess.game_over()) return false;
  if (_viewIdx !== -1) return false;
  if (piece[0] !== _chess.turn()) return false;
  _showDots(source);
  return true;
}

function _onDrop(source, target) {
  _clearDots();
  if (target === 'offboard') { _isDragging = false; return 'snapback'; }

  const promoMove = _chess.moves({ verbose: true })
    .find(m => m.from === source && m.to === target && m.flags.includes('p'));

  if (promoMove) {
    _promoFrom = source; _promoTo = target;
    _openPromo(_chess.turn());
    _isDragging = false;
    return 'snapback';
  }

  const move = _chess.move({ from: source, to: target, promotion: 'q' });
  if (!move) { _isDragging = false; return 'snapback'; }
  _afterMove(move);
  _isDragging = false;
}

function _onSnapEnd() {
  _board.position(_chess.fen(), false);
}

// ── CLICK-TO-MOVE ──────────────────────────────────────────────────────────
function _onBoardClick(e) {
  if (_isDragging || !_gameActive || _viewIdx !== -1) return;
  const sqEl = e.target.closest('.square-55d63');
  if (!sqEl) return;
  const target = sqEl.getAttribute('data-square');
  if (!target) return;

  if (!_selectedSq) {
    const piece = _chess.get(target);
    if (!piece || piece.color !== _chess.turn()) return;
    _selectedSq = target;
    sqEl.classList.add('sq-selected');
    _showDots(target);
    return;
  }

  if (_selectedSq === target) { _clearSel(); return; }

  const promoMove = _chess.moves({ verbose: true })
    .find(m => m.from === _selectedSq && m.to === target && m.flags.includes('p'));

  if (promoMove) {
    _promoFrom = _selectedSq; _promoTo = target;
    _clearSel();
    _openPromo(_chess.turn());
    return;
  }

  const move = _chess.move({ from: _selectedSq, to: target, promotion: 'q' });
  if (move) {
    _clearSel();
    _afterMove(move);
  } else {
    _clearSel();
    const piece = _chess.get(target);
    if (piece && piece.color === _chess.turn()) {
      _selectedSq = target;
      sqEl(target)?.classList.add('sq-selected');
      _showDots(target);
    }
  }
}

// ── AFTER MOVE ─────────────────────────────────────────────────────────────
function _afterMove(move) {
  _viewIdx = -1;
  const mover = move.color === 'w' ? 'white' : 'black';

  if (_clock && _clock.initial > 0) _clock.switch(mover);

  // Sound
  if      (_chess.in_checkmate())                                  playSound('gameend');
  else if (move.flags.includes('k') || move.flags.includes('q'))  playSound('castle');
  else if (move.promotion)                                         playSound('promote');
  else if (_chess.in_check())                                      playSound('check');
  else if (move.captured)                                          playSound('capture');
  else                                                             playSound('move');

  _moveHistory.push({ san: move.san, from: move.from, to: move.to, fen: _chess.fen(), move });
  _board.position(_chess.fen(), false);
  _updateAllUI();
  _renderMoveList();
  _scrollMoves();

  if (_chess.game_over()) {
    _clock?.stop();
    _gameActive = false;
    window._gameActive = false;
    setTimeout(() => showResult(), 500);
  }
}

// ── PROMOTION ──────────────────────────────────────────────────────────────
function _openPromo(color) {
  const col   = color === 'w' ? 'white' : 'black';
  const grid  = $('#promo-grid');
  grid.innerHTML = '';
  ['q','r','b','n'].forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'promo-piece';
    btn.innerHTML = `<img src="chess/images/${col}-${PIECE_NAMES[p]}.png" alt="${p}">`;
    btn.addEventListener('click', () => {
      $('#promo-overlay').style.display = 'none';
      const mv = _chess.move({ from: _promoFrom, to: _promoTo, promotion: p });
      if (mv) _afterMove(mv);
      _promoFrom = _promoTo = null;
    });
    grid.appendChild(btn);
  });
  $('#promo-overlay').style.display = 'flex';
}

// ── HIGHLIGHTS ─────────────────────────────────────────────────────────────
function _clearDots() { clearClass('sq-dot'); clearClass('sq-capture'); }

function _clearSel() {
  if (_selectedSq) { sqEl(_selectedSq)?.classList.remove('sq-selected'); _selectedSq = null; }
  _clearDots();
}

function _hlLast() {
  clearClass('sq-last');
  const h = _chess.history({ verbose: true });
  if (!h.length) return;
  const last = h[h.length-1];
  sqEl(last.from)?.classList.add('sq-last');
  sqEl(last.to)?.classList.add('sq-last');
}

function _hlCheck() {
  clearClass('sq-check');
  if (!_chess.in_check()) return;
  const color = _chess.turn();
  for (const f of 'abcdefgh') for (const r of '12345678') {
    const pc = _chess.get(f+r);
    if (pc && pc.type === 'k' && pc.color === color) sqEl(f+r)?.classList.add('sq-check');
  }
}

function _showDots(from) {
  _clearDots();
  _chess.moves({ square: from, verbose: true }).forEach(m => {
    const el = sqEl(m.to);
    if (!el) return;
    if (_chess.get(m.to) || m.flags.includes('e')) el.classList.add('sq-capture');
    else el.classList.add('sq-dot');
  });
}

// ── UI UPDATE ──────────────────────────────────────────────────────────────
function _updateAllUI() {
  _clearDots();
  _hlLast();
  _hlCheck();
  _updateStatus();
  _updateCaptures();
  _updateClocks();
}

function _updateStatus() {
  const turn    = _chess.turn();
  const isWhite = turn === 'w';
  const dot = $('.ss-dot');
  const txt = $('#status-txt');

  if (dot) dot.className = 'ss-dot ' + (isWhite ? 'white-dot' : 'black-dot');

  if      (_chess.in_checkmate())  { if (txt) txt.textContent = `♔ ${isWhite ? _pBlack : _pWhite} wins by checkmate`; }
  else if (_chess.in_stalemate())  { if (txt) txt.textContent = 'Stalemate — Draw'; }
  else if (_chess.in_draw())       { if (txt) txt.textContent = 'Draw'; }
  else if (_chess.in_check())      { if (txt) txt.textContent = `⚠ ${isWhite ? _pWhite : _pBlack} in check`; }
  else                             { if (txt) txt.textContent = `${isWhite ? '⚪' : '⚫'} ${isWhite ? _pWhite : _pBlack}'s turn`; }
}

function _updateCaptures() {
  const hist = _chess.history({ verbose: true });
  const wC = [], bC = [];
  hist.forEach(m => { if (m.captured) (m.color === 'w' ? wC : bC).push(m.captured); });

  function fmt(caps, myMat, theirMat) {
    const sorted = caps.slice().sort((a,b) => (PIECE_VALUES[b]||0)-(PIECE_VALUES[a]||0));
    let html = sorted.map(p => `<span>${PIECE_SYMBOLS[p]||''}</span>`).join('');
    const adv = myMat - theirMat;
    if (adv > 0) html += ` <b style="color:var(--green);font-size:11px">+${adv}</b>`;
    return html;
  }

  const wMat = wC.reduce((a,p) => a+(PIECE_VALUES[p]||0), 0);
  const bMat = bC.reduce((a,p) => a+(PIECE_VALUES[p]||0), 0);

  const cW = $('#cap-white');
  const cB = $('#cap-black');
  if (cW) cW.innerHTML = fmt(wC, wMat, bMat);
  if (cB) cB.innerHTML = fmt(bC, bMat, wMat);
}

function _updateClocks() {
  if (!_clock) return;
  const wt = $('#time-white');
  const bt = $('#time-black');
  if (wt) wt.textContent = _clock.fmt('white');
  if (bt) bt.textContent = _clock.fmt('black');

  const isWhite = _chess.turn() === 'w';
  const cw = $('#clock-white');
  const cb = $('#clock-black');
  cw?.classList.toggle('active',    isWhite  && _gameActive);
  cb?.classList.toggle('active',   !isWhite  && _gameActive);
  cw?.classList.toggle('low-time',  _clock.isLow('white'));
  cb?.classList.toggle('low-time',  _clock.isLow('black'));

  const sw = $('#strip-white');
  const sb = $('#strip-black');
  sw?.classList.toggle('active-strip',  isWhite && _gameActive);
  sb?.classList.toggle('active-strip', !isWhite && _gameActive);
}

// ── MOVE LIST ──────────────────────────────────────────────────────────────
function _renderMoveList() {
  const grid = $('#move-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < _moveHistory.length; i += 2) {
    const num = Math.floor(i/2) + 1;
    const numEl = document.createElement('div');
    numEl.className = 'mg-num';
    numEl.textContent = num + '.';

    const wEl = _mkMoveEl(i);
    const bEl = _moveHistory[i+1] ? _mkMoveEl(i+1) : document.createElement('div');
    if (!_moveHistory[i+1]) bEl.className = 'mg-move';

    grid.appendChild(numEl);
    grid.appendChild(wEl);
    grid.appendChild(bEl);
  }
  _syncActive();
}

function _mkMoveEl(idx) {
  const el = document.createElement('div');
  el.className = 'mg-move';
  el.textContent = _moveHistory[idx].san;
  el.addEventListener('click', () => _gotoMove(idx));
  return el;
}

function _syncActive() {
  const active = _viewIdx === -1 ? _moveHistory.length - 1 : _viewIdx;
  $$('.mg-move').forEach((el, i) => {
    el.classList.toggle('active', i === active);
  });
}

function _scrollMoves() {
  const s = $('.move-scroll');
  if (s) s.scrollTop = s.scrollHeight;
}

function _gotoMove(idx) {
  _viewIdx = idx;
  const m = _moveHistory[idx];
  _board.position(m.fen, false);
  clearClass('sq-last');
  sqEl(m.from)?.classList.add('sq-last');
  sqEl(m.to)?.classList.add('sq-last');
  clearClass('sq-check');
  _syncActive();
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function _navStart() {
  _board.position('start', false);
  clearClass('sq-last');
  _viewIdx = -2;
  _syncActive();
}

function _navPrev() {
  const cur = _viewIdx === -1 ? _moveHistory.length - 1 : _viewIdx;
  if (cur > 0) _gotoMove(cur - 1);
  else _navStart();
}

function _navNext() {
  if (_viewIdx === -1) return;
  const cur  = _viewIdx === -2 ? -1 : _viewIdx;
  const next = cur + 1;
  if (next < _moveHistory.length) _gotoMove(next);
  else {
    _viewIdx = -1;
    _board.position(_chess.fen(), false);
    _hlLast();
    _syncActive();
  }
}

function _navEnd() {
  _viewIdx = -1;
  _board.position(_chess.fen(), false);
  _hlLast();
  _syncActive();
}

// ── RESULT ─────────────────────────────────────────────────────────────────
function showResult(reason) {
  let title = '', sub = '', icon = '🤝';

  if (_chess.in_checkmate()) {
    const winner = _chess.turn() === 'w' ? _pBlack : _pWhite;
    title = winner + ' Wins!'; sub = 'by checkmate';
    icon  = _chess.turn() === 'w' ? '♛' : '♕';
  } else if (_chess.in_stalemate())           { title = 'Draw'; sub = 'by stalemate'; }
  else if (_chess.in_threefold_repetition())  { title = 'Draw'; sub = 'by repetition'; }
  else if (_chess.insufficient_material())    { title = 'Draw'; sub = 'insufficient material'; }
  else if (_chess.in_draw())                  { title = 'Draw'; sub = 'by 50-move rule'; }
  else if (reason === 'timeout-white')        { title = _pBlack + ' Wins!'; sub = 'White ran out of time'; icon = '♛'; }
  else if (reason === 'timeout-black')        { title = _pWhite + ' Wins!'; sub = 'Black ran out of time'; icon = '♕'; }
  else if (reason === 'resign-white')         { title = _pBlack + ' Wins!'; sub = 'White resigned'; icon = '♛'; }
  else if (reason === 'resign-black')         { title = _pWhite + ' Wins!'; sub = 'Black resigned'; icon = '♕'; }
  else if (reason === 'draw-agreed')          { title = 'Draw'; sub = 'by agreement'; }

  playSound('gameend');
  $('#result-emblem').textContent = icon;
  $('#result-title').textContent  = title;
  $('#result-reason').textContent = sub;
  $('#result-overlay').style.display = 'flex';
}

// ── PGN ────────────────────────────────────────────────────────────────────
function generatePGN() {
  const date = new Date().toISOString().split('T')[0];
  return `[Event "Local Game"]\n[Site "Chess App"]\n[Date "${date}"]\n[White "${_pWhite}"]\n[Black "${_pBlack}"]\n[TimeControl "${_tc.label}"]\n[Result "*"]\n\n${_chess.pgn({ max_width:80, newline:'\n' })}`;
}

// ── LIBRARY RENDER ─────────────────────────────────────────────────────────
function renderLibrary() {
  const list = $('#lib-list');
  list.innerHTML = '';
  const games = _lib.all();
  if (!games.length) {
    list.innerHTML = '<p style="color:var(--txd);font-size:13px;padding:8px">No saved games.</p>';
    return;
  }
  games.forEach(g => {
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="lib-item-name">${g.name}</div>
        <div class="lib-item-meta">${g.date} · ${g.moves} moves · ${g.tc||'?'}</div>
      </div>
      <div class="lib-item-btns">
        <button class="lb-load">Load</button>
        <button class="del">Delete</button>
      </div>`;
    item.querySelector('.lb-load').addEventListener('click', () => {
      const saved = _lib.get(g.id);
      if (!saved) return;
      const tmp = new Chess();
      tmp.load_pgn(saved.pgn);
      _chess = tmp;
      const hist = _chess.history({ verbose: true });
      _moveHistory = [];
      const replay = new Chess();
      hist.forEach(m => {
        replay.move(m);
        _moveHistory.push({ san: m.san, from: m.from, to: m.to, fen: replay.fen(), move: m });
      });
      _viewIdx = -1;
      _gameActive = false;
      window._gameActive = false;
      _clock?.stop();
      _board.position(_chess.fen(), false);
      _updateAllUI(); _renderMoveList();
      $('#library-modal').classList.remove('show');
    });
    item.querySelector('.del').addEventListener('click', () => {
      _lib.delete(g.id); renderLibrary();
    });
    list.appendChild(item);
  });
}

// ── ATTACH GAME EVENTS (once) ──────────────────────────────────────────────
function _attachGameEvents() {
  if (_eventsAttached) return;
  _eventsAttached = true;

  $('#flip-btn').addEventListener('click', () => {
    _orientation = _orientation === 'white' ? 'black' : 'white';
    _board.flip();
  });

  $('#theme-btn').addEventListener('click', () => {
    const row = $('#theme-row');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  });

  $$('.th-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      _theme = btn.dataset.theme;
      $$('.th-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#board').className = `board-el theme-${_theme}`;
      $('#theme-row').style.display = 'none';
    });
  });

  $('#nav-start').addEventListener('click', _navStart);
  $('#nav-prev' ).addEventListener('click', _navPrev);
  $('#nav-next' ).addEventListener('click', _navNext);
  $('#nav-end'  ).addEventListener('click', _navEnd);

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { _navPrev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { _navNext(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { _navStart(); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { _navEnd(); e.preventDefault(); }
    if (e.key === 'f' || e.key === 'F') { _orientation = _orientation === 'white' ? 'black' : 'white'; _board.flip(); }
  });

  $('#undo-btn').addEventListener('click', () => {
    if (!_chess.history().length) return;
    _chess.undo();
    if (_moveHistory.length) _moveHistory.pop();
    _viewIdx = -1;
    _board.position(_chess.fen(), false);
    _updateAllUI();
    _renderMoveList();
  });

  $('#resign-btn').addEventListener('click', () => {
    if (!_gameActive) return;
    if (!confirm('Resign this game?')) return;
    _clock?.stop();
    _gameActive = false;
    window._gameActive = false;
    showResult(_chess.turn() === 'w' ? 'resign-white' : 'resign-black');
  });

  $('#draw-btn').addEventListener('click', () => {
    if (!_gameActive) return;
    if (!confirm('Accept draw?')) return;
    _clock?.stop();
    _gameActive = false;
    window._gameActive = false;
    showResult('draw-agreed');
  });

  $('#new-game-btn').addEventListener('click', () => {
    _clock?.stop();
    $('#game-app').style.display    = 'none';
    $('#setup-overlay').style.display = 'flex';
  });

  $('#ra-new').addEventListener('click', () => {
    $('#result-overlay').style.display = 'none';
    _clock?.stop();
    $('#game-app').style.display    = 'none';
    $('#setup-overlay').style.display = 'flex';
  });

  $('#ra-rematch').addEventListener('click', () => {
    $('#result-overlay').style.display = 'none';
    launchGame(_pWhite, _pBlack, _tc);
  });

  $('#save-btn').addEventListener('click', () => {
    $('#game-name').value = `${_pWhite} vs ${_pBlack}`;
    $('#save-modal').classList.add('show');
  });

  $('#confirm-save').addEventListener('click', () => {
    const name = $('#game-name').value.trim() || 'Untitled';
    _lib.save(name, generatePGN(), _tc.label);
    $('#save-modal').classList.remove('show');
  });

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([generatePGN()], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'game.pgn'; a.click();
    URL.revokeObjectURL(url);
  });

  $('#fen-btn').addEventListener('click', () => {
    $('#fen-input').value = _chess.fen();
    $('#fen-modal').classList.add('show');
  });

  $('#confirm-fen').addEventListener('click', () => {
    try {
      _chess.load($('#fen-input').value.trim());
      _moveHistory = []; _viewIdx = -1;
      _board.position(_chess.fen(), false);
      _updateAllUI(); _renderMoveList();
      $('#fen-modal').classList.remove('show');
    } catch(e) { alert('Invalid FEN'); }
  });

  $('#copy-fen').addEventListener('click', () => {
    navigator.clipboard?.writeText(_chess.fen()).catch(() => {});
    $('#fen-input').value = _chess.fen();
  });

  $('#lib-btn').addEventListener('click', () => {
    renderLibrary();
    $('#library-modal').classList.add('show');
  });

  $$('.mc-close').forEach(btn => {
    btn.addEventListener('click', () => {
      $(`#${btn.dataset.modal}`)?.classList.remove('show');
    });
  });

  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
}

// ── START BUTTON (唯一的事件绑定) ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _lib = new GameLibrary();

  $('#start-btn').addEventListener('click', () => {
    const pW = $('#name-white').value.trim() || 'Player 1';
    const pB = $('#name-black').value.trim() || 'Player 2';
    const tc = getCurrentTC();
    $('#setup-overlay').style.display = 'none';
    $('#game-app').style.display      = 'flex';
    launchGame(pW, pB, tc);
  });
});