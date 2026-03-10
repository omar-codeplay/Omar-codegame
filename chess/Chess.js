/* ════════════════════════════════════════
   CHESS.JS  — Full-featured local chess
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

// ── SOUND MANAGER ──────────────────────────────────────────────────────────
const SFX = {
  play(id) {
    const el = document.getElementById('snd-' + id);
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }
};

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
    // add increment to the player who just moved
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
      Chess_App.onTimeout(this.active);
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

// ── MAIN CHESS APP ─────────────────────────────────────────────────────────
const Chess_App = (() => {

  let chess, board, clock, library;
  let orientation  = 'white';
  let currentTheme = 'green';
  let selectedSq   = null;
  let isDragging   = false;
  let promotionFrom= null, promotionTo = null;
  let gameActive   = false;
  let moveHistory  = [];  // {san, from, to, fen}
  let viewIndex    = -1;   // -1 = live end
  let playerWhite  = 'Player 1';
  let playerBlack  = 'Player 2';
  let currentTC    = { label: '10+0', min: 10, inc: 0, category: 'rapid' };
  let clockTimer   = null;
  let selectedTCIndex = 0;

  // ── DOM helpers ────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function sq(sq) {
    return document.querySelector(`#board .square-55d63[data-square="${sq}"]`);
  }

  function clearSqClasses(cls) {
    $$(`#board .${cls}`).forEach(e => e.classList.remove(cls));
  }

  // ── PIECE THEME ────────────────────────────────────────────────────────
  function pieceTheme(piece) {
    const color = piece[0] === 'w' ? 'white' : 'black';
    const type  = PIECE_NAMES[piece[1].toLowerCase()];
    return `chess/images/${color}-${type}.png`;
  }

  // ── SETUP SCREEN ───────────────────────────────────────────────────────
  function initSetup() {
    library = new GameLibrary();

    // Default category
    renderTCOptions('bullet');

    $$('.tc-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tc-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        renderTCOptions(cat);
        $('#custom-tc').style.display = cat === 'custom' ? 'block' : 'none';
      });
    });

    $('#start-btn').addEventListener('click', startGame);
  }

  function renderTCOptions(cat) {
    const container = $('#tc-options');
    const list = TIME_CONTROLS[cat] || [];
    container.innerHTML = '';
    selectedTCIndex = 0;

    list.forEach((tc, i) => {
      const div = document.createElement('div');
      div.className = 'tc-opt' + (i === 0 ? ' selected' : '');
      div.innerHTML = `<div class="tc-opt-main">${tc.label}</div>
                       <div class="tc-opt-label">${getCatName(cat)}</div>`;
      div.addEventListener('click', () => {
        $$('.tc-opt').forEach(o => o.classList.remove('selected'));
        div.classList.add('selected');
        currentTC = { ...tc, category: cat };
      });
      if (i === 0) currentTC = { ...tc, category: cat };
      container.appendChild(div);
    });

    if (cat === 'custom') {
      currentTC = { label: 'Custom', min: 0, inc: 0, category: 'custom' };
    }
    if (cat === 'unlimited') {
      currentTC = { label: '∞', min: 0, inc: 0, category: 'unlimited' };
    }
  }

  function getCatName(cat) {
    return { bullet:'Bullet', blitz:'Blitz', rapid:'Rapid', classical:'Classical',
             unlimited:'Unlimited', custom:'Custom' }[cat] || cat;
  }

  function startGame(rematch) {
    // Collect names
    playerWhite = $('#name-white').value.trim() || 'Player 1';
    playerBlack = $('#name-black').value.trim() || 'Player 2';

    // Custom TC
    if (currentTC.category === 'custom') {
      const min = parseInt($('#custom-min').value) || 0;
      const inc = parseInt($('#custom-inc').value) || 0;
      currentTC = { label: min + '+' + inc, min, inc, category: 'custom' };
    }

    // Hide setup, show game
    $('#setup-overlay').style.display = 'none';
    $('#game-app').style.display      = 'flex';

    initBoard();
    resetGame();
  }

  // ── BOARD INIT ─────────────────────────────────────────────────────────
  function initBoard() {
    if (board) { board.destroy(); board = null; }

    board = ChessBoard('board', {
      draggable:   true,
      position:    'start',
      orientation,
      pieceTheme,
      onDragStart: onDragStart,
      onDrop:      onDrop,
      onSnapEnd:   onSnapEnd,
    });

    window.addEventListener('resize', () => board && board.resize());

    // Click-to-move
    document.getElementById('board').addEventListener('click', onBoardClick);

    // Touch — prevent scroll
    document.getElementById('board').addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    document.getElementById('board').addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
  }

  // ── RESET ──────────────────────────────────────────────────────────────
  function resetGame() {
    chess       = new Chess();
    moveHistory = [];
    viewIndex   = -1;
    selectedSq  = null;
    isDragging  = false;
    gameActive  = true;

    board.position('start', false);

    // Clock
    const totalSecs = currentTC.min * 60;
    clock = new Clock(totalSecs, currentTC.inc);
    if (totalSecs > 0) clock.start('white');

    updateAllUI();
    clearHighlights();
    renderMoveList();
    startClockUI();
  }

  // ── CLOCK UI ───────────────────────────────────────────────────────────
  function startClockUI() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClocks, 100);
  }

  function updateClocks() {
    if (!clock) return;
    const wt = clock.fmt('white');
    const bt = clock.fmt('black');

    const wtEl = $('#time-white');
    const btEl = $('#time-black');
    const cwEl = $('#clock-white');
    const cbEl = $('#clock-black');

    if (wtEl) wtEl.textContent = wt;
    if (btEl) btEl.textContent = bt;

    // Active / low time styling
    const isWhiteTurn = chess.turn() === 'w';

    cwEl?.classList.toggle('active', isWhiteTurn && gameActive);
    cbEl?.classList.toggle('active', !isWhiteTurn && gameActive);
    cwEl?.classList.toggle('low-time', clock.isLow('white'));
    cbEl?.classList.toggle('low-time', clock.isLow('black'));

    // Player strip active state
    const sw = $('#strip-white');
    const sb = $('#strip-black');
    if (sw) sw.classList.toggle('active-strip', isWhiteTurn && gameActive);
    if (sb) sb.classList.toggle('active-strip', !isWhiteTurn && gameActive);
  }

  // ── TIMEOUT HANDLER ────────────────────────────────────────────────────
  Chess_App && (Chess_App.onTimeout = function(loser) {});  // patched below

  // ── DRAG / DROP ────────────────────────────────────────────────────────
  function onDragStart(source, piece) {
    isDragging = true;
    clearSelection();
    if (!gameActive || chess.game_over()) return false;
    if (!isLiveTurn()) return false;
    if (piece[0] !== chess.turn()) return false;
    showLegalDots(source);
    return true;
  }

  function onDrop(source, target) {
    clearDots();
    if (target === 'offboard') {
      isDragging = false;
      return 'snapback';
    }

    // Check promotion
    const moveCandidate = chess.moves({ verbose: true })
      .find(m => m.from === source && m.to === target && m.flags.includes('p'));

    if (moveCandidate) {
      promotionFrom = source;
      promotionTo   = target;
      openPromotion(chess.turn());
      isDragging = false;
      return 'snapback';
    }

    const move = chess.move({ from: source, to: target, promotion: 'q' });
    if (!move) {
      isDragging = false;
      return 'snapback';
    }

    afterMove(move);
    isDragging = false;
  }

  function onSnapEnd() {
    board.position(chess.fen());
  }

  // ── CLICK-TO-MOVE ──────────────────────────────────────────────────────
  function onBoardClick(e) {
    if (isDragging || !gameActive || !isLiveTurn()) return;
    const sqEl = e.target.closest('.square-55d63');
    if (!sqEl) return;
    const target = sqEl.getAttribute('data-square');
    if (!target) return;

    if (!selectedSq) {
      const piece = chess.get(target);
      if (!piece || piece.color !== chess.turn()) return;
      selectedSq = target;
      sqEl.classList.add('sq-selected');
      showLegalDots(target);
      return;
    }

    if (selectedSq === target) { clearSelection(); return; }

    // Check promotion
    const moveCandidate = chess.moves({ verbose: true })
      .find(m => m.from === selectedSq && m.to === target && m.flags.includes('p'));

    if (moveCandidate) {
      promotionFrom = selectedSq;
      promotionTo   = target;
      clearSelection();
      openPromotion(chess.turn());
      return;
    }

    const move = chess.move({ from: selectedSq, to: target, promotion: 'q' });
    if (move) {
      clearSelection();
      afterMove(move);
    } else {
      clearSelection();
      const piece = chess.get(target);
      if (piece && piece.color === chess.turn()) {
        selectedSq = target;
        sq(target)?.classList.add('sq-selected');
        showLegalDots(target);
      }
    }
  }

  function isLiveTurn() {
    return viewIndex === -1;
  }

  // ── AFTER MOVE ─────────────────────────────────────────────────────────
  function afterMove(move) {
    viewIndex = -1;

    // Clock switch
    if (clock && clock.initial > 0) {
      const mover = move.color === 'w' ? 'white' : 'black';
      clock.switch(mover);
    }

    // Sound
    if      (chess.in_checkmate())                     SFX.play('gameend');
    else if (move.flags.includes('k') ||
             move.flags.includes('q'))                 SFX.play('castle');
    else if (move.promotion)                           SFX.play('promote');
    else if (chess.in_check())                         SFX.play('check');
    else if (move.captured)                            SFX.play('capture');
    else                                               SFX.play('move');

    // Store
    moveHistory.push({ san: move.san, from: move.from, to: move.to, fen: chess.fen(), move });

    board.position(chess.fen(), false);
    updateAllUI();
    renderMoveList();
    scrollMoveList();

    if (chess.game_over()) {
      clock?.stop();
      gameActive = false;
      setTimeout(showResult, 600);
    }
  }

  // ── PROMOTION ──────────────────────────────────────────────────────────
  function openPromotion(color) {
    const col     = color === 'w' ? 'white' : 'black';
    const pieces  = ['q','r','b','n'];
    const grid    = $('#promo-grid');
    grid.innerHTML = '';
    pieces.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'promo-piece';
      btn.innerHTML = `<img src="chess/images/${col}-${PIECE_NAMES[p]}.png" alt="${p}">`;
      btn.addEventListener('click', () => {
        $('#promo-overlay').style.display = 'none';
        const move = chess.move({ from: promotionFrom, to: promotionTo, promotion: p });
        if (move) afterMove(move);
        promotionFrom = promotionTo = null;
      });
      grid.appendChild(btn);
    });
    $('#promo-overlay').style.display = 'flex';
  }

  // ── HIGHLIGHTS ─────────────────────────────────────────────────────────
  function clearHighlights() {
    clearSqClasses('sq-last');
    clearSqClasses('sq-selected');
    clearSqClasses('sq-check');
    clearDots();
  }

  function clearDots() {
    clearSqClasses('sq-dot');
    clearSqClasses('sq-capture');
  }

  function clearSelection() {
    if (selectedSq) {
      sq(selectedSq)?.classList.remove('sq-selected');
      selectedSq = null;
    }
    clearDots();
  }

  function highlightLastMove() {
    clearSqClasses('sq-last');
    const hist = chess.history({ verbose: true });
    if (!hist.length) return;
    const last = hist[hist.length - 1];
    sq(last.from)?.classList.add('sq-last');
    sq(last.to)?.classList.add('sq-last');
  }

  function highlightCheck() {
    clearSqClasses('sq-check');
    if (!chess.in_check()) return;
    const color = chess.turn();
    // Find the king square
    for (const f of 'abcdefgh') for (const r of '12345678') {
      const piece = chess.get(f+r);
      if (piece && piece.type === 'k' && piece.color === color) {
        sq(f+r)?.classList.add('sq-check');
      }
    }
  }

  function showLegalDots(fromSq) {
    clearDots();
    const moves = chess.moves({ square: fromSq, verbose: true });
    moves.forEach(m => {
      const el = sq(m.to);
      if (!el) return;
      if (chess.get(m.to) || m.flags.includes('e')) {
        el.classList.add('sq-capture');
      } else {
        el.classList.add('sq-dot');
      }
    });
  }

  // ── UI UPDATE ──────────────────────────────────────────────────────────
  function updateAllUI() {
    board.position(chess.fen(), false);
    clearHighlights();
    highlightLastMove();
    highlightCheck();
    updateStatus();
    updateCaptures();
    updateClocks();
  }

  function updateStatus() {
    const turn    = chess.turn();
    const isWhite = turn === 'w';
    const dotEl   = $('.ss-dot');
    const txtEl   = $('#status-txt');

    if (dotEl) {
      dotEl.className = 'ss-dot ' + (isWhite ? 'white-dot' : 'black-dot');
    }

    if (chess.in_checkmate()) {
      const winner = isWhite ? playerBlack : playerWhite;
      if (txtEl) txtEl.textContent = `♔ ${winner} wins by checkmate`;
    } else if (chess.in_stalemate()) {
      if (txtEl) txtEl.textContent = 'Stalemate — Draw';
    } else if (chess.in_draw()) {
      if (txtEl) txtEl.textContent = 'Draw';
    } else if (chess.in_check()) {
      const name = isWhite ? playerWhite : playerBlack;
      if (txtEl) txtEl.textContent = `⚠ ${name} is in check`;
    } else {
      const name = isWhite ? playerWhite : playerBlack;
      if (txtEl) txtEl.textContent = `${isWhite ? '⚪' : '⚫'} ${name}'s turn`;
    }
  }

  function updateCaptures() {
    const hist  = chess.history({ verbose: true });
    const wCaps = [], bCaps = [];
    hist.forEach(m => {
      if (m.captured) {
        if (m.color === 'w') bCaps.push(m.captured); // white captured a black piece
        else wCaps.push(m.captured);
      }
    });

    const wMat = wCaps.reduce((a,p) => a + (PIECE_VALUES[p]||0), 0);
    const bMat = bCaps.reduce((a,p) => a + (PIECE_VALUES[p]||0), 0);

    function fmt(caps, mat, oppMat) {
      const sorted = caps.slice().sort((a,b) => (PIECE_VALUES[b]||0) - (PIECE_VALUES[a]||0));
      let html = sorted.map(p => `<span title="${p}">${PIECE_SYMBOLS[p]||''}</span>`).join('');
      const adv = mat - oppMat;
      if (adv > 0) html += ` <b style="color:var(--green);font-size:11px">+${adv}</b>`;
      return html;
    }

    const capW = $('#cap-white');
    const capB = $('#cap-black');
    if (capW) capW.innerHTML = fmt(wCaps, wMat, bMat);
    if (capB) capB.innerHTML = fmt(bCaps, bMat, wMat);
  }

  // ── MOVE LIST ──────────────────────────────────────────────────────────
  function renderMoveList() {
    const grid = $('#move-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < moveHistory.length; i += 2) {
      const num = Math.floor(i / 2) + 1;

      const numEl = document.createElement('div');
      numEl.className = 'mg-num';
      numEl.textContent = num + '.';

      const wEl = document.createElement('div');
      wEl.className = 'mg-move' + (viewIndex === i ? ' active' : (viewIndex === -1 && i === moveHistory.length - (moveHistory.length % 2 === 1 ? 1 : 2) ? ' active' : ''));
      wEl.textContent = moveHistory[i].san;
      wEl.addEventListener('click', () => gotoMove(i));

      const bEl = document.createElement('div');
      if (moveHistory[i+1]) {
        bEl.className = 'mg-move' + (viewIndex === i+1 ? ' active' : (viewIndex === -1 && i+1 === moveHistory.length - 1 ? ' active' : ''));
        bEl.textContent = moveHistory[i+1].san;
        bEl.addEventListener('click', () => gotoMove(i+1));
      }

      grid.appendChild(numEl);
      grid.appendChild(wEl);
      grid.appendChild(bEl);
    }
  }

  function scrollMoveList() {
    const s = $('.move-scroll');
    if (s) s.scrollTop = s.scrollHeight;
  }

  function gotoMove(idx) {
    viewIndex = idx;
    const fen = moveHistory[idx].fen;
    board.position(fen, false);
    // Highlight that move
    clearSqClasses('sq-last');
    const m = moveHistory[idx];
    sq(m.from)?.classList.add('sq-last');
    sq(m.to)?.classList.add('sq-last');
    clearSqClasses('sq-check');
    // Update active class in move list
    $$('.mg-move').forEach((el, i) => el.classList.toggle('active', i === idx));
  }

  // ── NAVIGATION ─────────────────────────────────────────────────────────
  function navStart() {
    if (!moveHistory.length) return;
    board.position('start', false);
    clearHighlights();
    viewIndex = -2; // before any move
    $$('.mg-move').forEach(el => el.classList.remove('active'));
  }

  function navPrev() {
    if (!moveHistory.length) return;
    const cur = viewIndex === -1 ? moveHistory.length - 1 : viewIndex;
    if (cur > 0) gotoMove(cur - 1);
    else navStart();
  }

  function navNext() {
    if (!moveHistory.length) return;
    if (viewIndex === -1) return;
    const cur = viewIndex === -2 ? -1 : viewIndex;
    const next = cur + 1;
    if (next < moveHistory.length) gotoMove(next);
    else { viewIndex = -1; board.position(chess.fen(), false); highlightLastMove(); $$('.mg-move').forEach((el,i) => el.classList.toggle('active', i === moveHistory.length-1)); }
  }

  function navEnd() {
    viewIndex = -1;
    board.position(chess.fen(), false);
    clearSqClasses('sq-last');
    highlightLastMove();
    $$('.mg-move').forEach((el,i) => el.classList.toggle('active', i === moveHistory.length-1));
  }

  // ── RESULT ─────────────────────────────────────────────────────────────
  function showResult(reason) {
    let title = '', sub = '', icon = '🤝';

    if (chess.in_checkmate()) {
      const winner = chess.turn() === 'w' ? playerBlack : playerWhite;
      title = `${winner} Wins!`;
      sub   = 'by checkmate';
      icon  = chess.turn() === 'w' ? '♛' : '♕';
    } else if (chess.in_stalemate()) {
      title = 'Draw'; sub = 'by stalemate';
    } else if (chess.in_threefold_repetition()) {
      title = 'Draw'; sub = 'by repetition';
    } else if (chess.insufficient_material()) {
      title = 'Draw'; sub = 'insufficient material';
    } else if (chess.in_draw()) {
      title = 'Draw'; sub = 'by 50-move rule';
    } else if (reason === 'timeout-white') {
      title = `${playerBlack} Wins!`; sub = 'White ran out of time'; icon = '♛';
    } else if (reason === 'timeout-black') {
      title = `${playerWhite} Wins!`; sub = 'Black ran out of time'; icon = '♕';
    } else if (reason === 'resign-white') {
      title = `${playerBlack} Wins!`; sub = 'White resigned'; icon = '♛';
    } else if (reason === 'resign-black') {
      title = `${playerWhite} Wins!`; sub = 'Black resigned'; icon = '♕';
    } else if (reason === 'draw-agreed') {
      title = 'Draw'; sub = 'by agreement';
    }

    SFX.play('gameend');
    $('#result-emblem').textContent = icon;
    $('#result-title').textContent  = title;
    $('#result-reason').textContent = sub;
    $('#rs-white').textContent      = playerWhite;
    $('#rs-black').textContent      = playerBlack;
    $('#result-overlay').style.display = 'flex';
  }

  // ── PGN / FEN ──────────────────────────────────────────────────────────
  function generatePGN() {
    const date = new Date().toISOString().split('T')[0];
    return `[Event "Local Game"]\n[Site "Chess App"]\n[Date "${date}"]\n[White "${playerWhite}"]\n[Black "${playerBlack}"]\n[TimeControl "${currentTC.label}"]\n[Result "*"]\n\n${chess.pgn({ max_width:80, newline:'\n' })}`;
  }

  // ── EVENT LISTENERS ────────────────────────────────────────────────────
  function attachEvents() {

    // Flip
    $('#flip-btn').addEventListener('click', () => {
      orientation = orientation === 'white' ? 'black' : 'white';
      board.flip();
    });

    // Theme toggle
    $('#theme-btn').addEventListener('click', () => {
      const row = $('#theme-row');
      row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    });

    $$('.th-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTheme = btn.dataset.theme;
        $$('.th-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const boardEl = document.getElementById('board');
        boardEl.className = `board-el theme-${currentTheme}`;
        $('#theme-row').style.display = 'none';
      });
    });

    // Nav
    $('#nav-start').addEventListener('click', navStart);
    $('#nav-prev' ).addEventListener('click', navPrev);
    $('#nav-next' ).addEventListener('click', navNext);
    $('#nav-end'  ).addEventListener('click', navEnd);

    // Undo
    $('#undo-btn').addEventListener('click', () => {
      if (!gameActive && !chess.history().length) return;
      chess.undo();
      if (moveHistory.length > 0) moveHistory.pop();
      viewIndex = -1;
      board.position(chess.fen(), false);
      updateAllUI();
      renderMoveList();
    });

    // Resign
    $('#resign-btn').addEventListener('click', () => {
      if (!gameActive) return;
      if (!confirm('Resign?')) return;
      clock?.stop();
      gameActive = false;
      const color = chess.turn() === 'w' ? 'resign-white' : 'resign-black';
      showResult(color);
    });

    // Draw
    $('#draw-btn').addEventListener('click', () => {
      if (!gameActive) return;
      if (!confirm('Offer draw — accept?')) return;
      clock?.stop();
      gameActive = false;
      showResult('draw-agreed');
    });

    // New game
    $('#new-game-btn').addEventListener('click', () => {
      clock?.stop();
      $('#game-app').style.display    = 'none';
      $('#setup-overlay').style.display = 'flex';
    });

    // Result screen buttons
    $('#ra-new').addEventListener('click', () => {
      $('#result-overlay').style.display = 'none';
      clock?.stop();
      $('#game-app').style.display    = 'none';
      $('#setup-overlay').style.display = 'flex';
    });

    $('#ra-rematch').addEventListener('click', () => {
      $('#result-overlay').style.display = 'none';
      resetGame();
    });

    // Save
    $('#save-btn').addEventListener('click', () => {
      $('#game-name').value = `${playerWhite} vs ${playerBlack} — ${new Date().toLocaleTimeString()}`;
      showModal('save-modal');
    });

    $('#confirm-save').addEventListener('click', () => {
      const name = $('#game-name').value.trim() || 'Untitled';
      library.save(name, generatePGN(), currentTC.label);
      closeModal('save-modal');
    });

    // Export PGN
    $('#export-btn').addEventListener('click', () => {
      const pgn  = generatePGN();
      const blob = new Blob([pgn], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'game.pgn'; a.click();
      URL.revokeObjectURL(url);
    });

    // FEN
    $('#fen-btn').addEventListener('click', () => {
      $('#fen-input').value = chess.fen();
      showModal('fen-modal');
    });

    $('#confirm-fen').addEventListener('click', () => {
      try {
        chess.load($('#fen-input').value.trim());
        moveHistory = [];
        viewIndex   = -1;
        board.position(chess.fen(), false);
        updateAllUI();
        renderMoveList();
        closeModal('fen-modal');
      } catch(e) { alert('Invalid FEN'); }
    });

    $('#copy-fen').addEventListener('click', () => {
      navigator.clipboard?.writeText(chess.fen()).catch(() => {});
      $('#fen-input').value = chess.fen();
    });

    // Library
    $('#lib-btn').addEventListener('click', () => {
      renderLibrary();
      showModal('library-modal');
    });

    // Modal close buttons
    $$('.mc-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });

    $$('.modal').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('show');
      });
    });

    // Game badge
    const badge = $('#game-badge');
    if (badge) badge.textContent = `${getCatName(currentTC.category)} · ${currentTC.label}`;
  }

  function showModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('show');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
  }

  function renderLibrary() {
    const list = $('#lib-list');
    list.innerHTML = '';
    const games = library.all();
    if (!games.length) { list.innerHTML = '<p style="color:var(--txd);font-size:13px">No saved games.</p>'; return; }
    games.forEach(g => {
      const item = document.createElement('div');
      item.className = 'lib-item';
      item.innerHTML = `
        <div>
          <div class="lib-item-name">${g.name}</div>
          <div class="lib-item-meta">${g.date} · ${g.moves} moves · ${g.tc || '?'}</div>
        </div>
        <div class="lib-item-btns">
          <button class="load-btn">Load</button>
          <button class="del">Delete</button>
        </div>`;
      item.querySelector('.load-btn').addEventListener('click', () => {
        const saved = library.get(g.id);
        if (!saved) return;
        chess.reset();
        chess.load_pgn(saved.pgn);
        moveHistory = chess.history({ verbose: true }).map(m => ({ san: m.san, from: m.from, to: m.to, fen: '', move: m }));
        // re-fill FENs
        const tmp = new Chess();
        for (let i = 0; i < moveHistory.length; i++) {
          tmp.move(moveHistory[i].move);
          moveHistory[i].fen = tmp.fen();
        }
        viewIndex = -1;
        gameActive = false;
        clock?.stop();
        board.position(chess.fen(), false);
        updateAllUI();
        renderMoveList();
        closeModal('library-modal');
      });
      item.querySelector('.del').addEventListener('click', () => {
        library.delete(g.id);
        renderLibrary();
      });
      list.appendChild(item);
    });
  }

  // ── PUBLIC INIT ────────────────────────────────────────────────────────
  function init() {
    initSetup();
    // Will be called after startGame → initBoard → attachEvents
  }

  // Expose timeout handler
  const api = {
    onTimeout(color) {
      if (!gameActive) return;
      clock?.stop();
      gameActive = false;
      showResult(`timeout-${color}`);
    },
    init
  };

  return api;
})();

// ── BOOT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Chess_App.init();

  // Wire start button — needs game fully initialised first
  document.getElementById('start-btn').addEventListener('click', () => {
    startAndAttach();
  });

  function startAndAttach() {
    const playerWhite = document.getElementById('name-white').value.trim() || 'Player 1';
    const playerBlack = document.getElementById('name-black').value.trim() || 'Player 2';

    // Resolve custom TC
    let tc = getCurrentTC();

    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('game-app').style.display      = 'flex';

    launchGame(playerWhite, playerBlack, tc);
  }
});

// ══════════════════════════════════════════════════════════════════════
// Rewrite as flat module — cleaner for single-file use
// ══════════════════════════════════════════════════════════════════════

// ── GLOBALS ───────────────────────────────────────────────────────────
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

// ── SETUP UI ─────────────────────────────────────────────────────────
(function setupUI() {
  const tcTabs = document.querySelectorAll('.tc-tab');
  tcTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tcTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;
      renderTCOpts(cat);
      document.getElementById('custom-tc').style.display = cat === 'custom' ? 'block' : 'none';
    });
  });

  // Initial render
  renderTCOpts('bullet');
})();

function renderTCOpts(cat) {
  const container = document.getElementById('tc-options');
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
    div.innerHTML = `<div class="tc-opt-main">${tc.label}</div><div class="tc-opt-label">${_catLabel(cat)}</div>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.tc-opt').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      _tc = { ...tc, category: cat };
    });
    if (i === 0) _tc = { ...tc, category: cat };
    container.appendChild(div);
  });
}

function _catLabel(cat) {
  return { bullet:'Bullet', blitz:'Blitz', rapid:'Rapid', classical:'Classical',
           unlimited:'Unlimited', custom:'Custom' }[cat] || cat;
}

function getCurrentTC() {
  const cat = document.querySelector('.tc-tab.active')?.dataset.cat || 'rapid';
  if (cat === 'custom') {
    const min = parseInt(document.getElementById('custom-min').value) || 0;
    const inc = parseInt(document.getElementById('custom-inc').value) || 0;
    return { label: `${min}+${inc}`, min, inc, category:'custom' };
  }
  if (cat === 'unlimited') return { label:'∞', min:0, inc:0, category:'unlimited' };
  return _tc;
}

// ── LAUNCH GAME ───────────────────────────────────────────────────────
function launchGame(pWhite, pBlack, tc) {
  _pWhite = pWhite;
  _pBlack = pBlack;
  _tc     = tc;
  _lib    = _lib || new GameLibrary();

  // Names
  document.getElementById('pname-white').textContent = pWhite;
  document.getElementById('pname-black').textContent = pBlack;
  document.getElementById('game-badge').textContent  = `${_catLabel(tc.category)} · ${tc.label}`;
  document.getElementById('rs-white').textContent    = pWhite;
  document.getElementById('rs-black').textContent    = pBlack;

  // Chess engine
  _chess = new Chess();
  _moveHistory = [];
  _viewIdx     = -1;
  _gameActive  = true;
  _selectedSq  = null;
  _isDragging  = false;

  // Board
  if (_board) { _board.destroy(); _board = null; }

  _board = ChessBoard('board', {
    draggable:   true,
    position:    'start',
    orientation: _orientation,
    pieceTheme:  _pieceTheme,
    onDragStart: _onDragStart,
    onDrop:      _onDrop,
    onSnapEnd:   _onSnapEnd,
  });

  window.addEventListener('resize', () => _board && _board.resize());

  // Touch - prevent scroll on board
  const boardEl = document.getElementById('board');
  boardEl.onclick = null;
  boardEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  boardEl.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
  boardEl.addEventListener('click', _onBoardClick);

  // Clock
  const secs = tc.min * 60;
  _clock = new Clock(secs, tc.inc);
  if (secs > 0) _clock.start('white');

  // Clock UI loop
  if (_clockTimer) clearInterval(_clockTimer);
  _clockTimer = setInterval(_updateClocks, 100);

  _renderMoveList();
  _updateAllUI();
  _attachGameEvents();
}

// ── PIECE THEME ───────────────────────────────────────────────────────
function _pieceTheme(piece) {
  const color = piece[0] === 'w' ? 'white' : 'black';
  const type  = PIECE_NAMES[piece[1].toLowerCase()];
  return `chess/images/${color}-${type}.png`;
}

// ── DRAG / DROP ───────────────────────────────────────────────────────
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

// ── CLICK-TO-MOVE ────────────────────────────────────────────────────
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
      _sqEl(target)?.classList.add('sq-selected');
      _showDots(target);
    }
  }
}

// ── AFTER MOVE ────────────────────────────────────────────────────────
function _afterMove(move) {
  _viewIdx = -1;
  const mover = move.color === 'w' ? 'white' : 'black';

  if (_clock && _clock.initial > 0) _clock.switch(mover);

  // Sound
  if      (_chess.in_checkmate())                                  _sfx('gameend');
  else if (move.flags.includes('k') || move.flags.includes('q'))  _sfx('castle');
  else if (move.promotion)                                         _sfx('promote');
  else if (_chess.in_check())                                      _sfx('check');
  else if (move.captured)                                          _sfx('capture');
  else                                                             _sfx('move');

  _moveHistory.push({ san: move.san, from: move.from, to: move.to, fen: _chess.fen(), move });
  _board.position(_chess.fen(), false);
  _updateAllUI();
  _renderMoveList();
  _scrollMoves();

  if (_chess.game_over()) {
    _clock?.stop();
    _gameActive = false;
    setTimeout(() => _showResult(), 500);
  }
}

// ── PROMOTION ─────────────────────────────────────────────────────────
function _openPromo(color) {
  const col   = color === 'w' ? 'white' : 'black';
  const grid  = document.getElementById('promo-grid');
  grid.innerHTML = '';
  ['q','r','b','n'].forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'promo-piece';
    btn.innerHTML = `<img src="chess/images/${col}-${PIECE_NAMES[p]}.png" alt="${p}">`;
    btn.addEventListener('click', () => {
      document.getElementById('promo-overlay').style.display = 'none';
      const mv = _chess.move({ from: _promoFrom, to: _promoTo, promotion: p });
      if (mv) _afterMove(mv);
      _promoFrom = _promoTo = null;
    });
    grid.appendChild(btn);
  });
  document.getElementById('promo-overlay').style.display = 'flex';
}

// ── HIGHLIGHTS ────────────────────────────────────────────────────────
function _sqEl(sq) {
  return document.querySelector(`#board .square-55d63[data-square="${sq}"]`);
}

function _clearClass(cls) {
  document.querySelectorAll(`#board .${cls}`).forEach(e => e.classList.remove(cls));
}

function _clearDots() { _clearClass('sq-dot'); _clearClass('sq-capture'); }
function _clearSel() {
  if (_selectedSq) { _sqEl(_selectedSq)?.classList.remove('sq-selected'); _selectedSq = null; }
  _clearDots();
}

function _hlLast() {
  _clearClass('sq-last');
  const h = _chess.history({ verbose: true });
  if (!h.length) return;
  const last = h[h.length-1];
  _sqEl(last.from)?.classList.add('sq-last');
  _sqEl(last.to)?.classList.add('sq-last');
}

function _hlCheck() {
  _clearClass('sq-check');
  if (!_chess.in_check()) return;
  const color = _chess.turn();
  for (const f of 'abcdefgh') for (const r of '12345678') {
    const pc = _chess.get(f+r);
    if (pc && pc.type === 'k' && pc.color === color) _sqEl(f+r)?.classList.add('sq-check');
  }
}

function _showDots(from) {
  _clearDots();
  _chess.moves({ square: from, verbose: true }).forEach(m => {
    const el = _sqEl(m.to);
    if (!el) return;
    if (_chess.get(m.to) || m.flags.includes('e')) el.classList.add('sq-capture');
    else el.classList.add('sq-dot');
  });
}

// ── UI UPDATE ─────────────────────────────────────────────────────────
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
  const dot = document.querySelector('.ss-dot');
  const txt = document.getElementById('status-txt');

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

  const cW = document.getElementById('cap-white');
  const cB = document.getElementById('cap-black');
  if (cW) cW.innerHTML = fmt(wC, wMat, bMat);
  if (cB) cB.innerHTML = fmt(bC, bMat, wMat);
}

function _updateClocks() {
  if (!_clock) return;
  const wt = document.getElementById('time-white');
  const bt = document.getElementById('time-black');
  if (wt) wt.textContent = _clock.fmt('white');
  if (bt) bt.textContent = _clock.fmt('black');

  const isWhite = _chess.turn() === 'w';
  const cw = document.getElementById('clock-white');
  const cb = document.getElementById('clock-black');
  cw?.classList.toggle('active',    isWhite  && _gameActive);
  cb?.classList.toggle('active',   !isWhite  && _gameActive);
  cw?.classList.toggle('low-time',  _clock.isLow('white'));
  cb?.classList.toggle('low-time',  _clock.isLow('black'));

  const sw = document.getElementById('strip-white');
  const sb = document.getElementById('strip-black');
  sw?.classList.toggle('active-strip',  isWhite && _gameActive);
  sb?.classList.toggle('active-strip', !isWhite && _gameActive);
}

// ── MOVE LIST ─────────────────────────────────────────────────────────
function _renderMoveList() {
  const grid = document.getElementById('move-grid');
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
  document.querySelectorAll('.mg-move').forEach((el, i) => {
    el.classList.toggle('active', i === active);
  });
}

function _scrollMoves() {
  const s = document.querySelector('.move-scroll');
  if (s) s.scrollTop = s.scrollHeight;
}

function _gotoMove(idx) {
  _viewIdx = idx;
  const m = _moveHistory[idx];
  _board.position(m.fen, false);
  _clearClass('sq-last');
  _sqEl(m.from)?.classList.add('sq-last');
  _sqEl(m.to)?.classList.add('sq-last');
  _clearClass('sq-check');
  _syncActive();
}

// ── NAVIGATION ────────────────────────────────────────────────────────
function _navStart() {
  _board.position('start', false);
  _clearClass('sq-last');
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

// ── RESULT ────────────────────────────────────────────────────────────
function _showResult(reason) {
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

  _sfx('gameend');
  document.getElementById('result-emblem').textContent = icon;
  document.getElementById('result-title').textContent  = title;
  document.getElementById('result-reason').textContent = sub;
  document.getElementById('result-overlay').style.display = 'flex';
}

// ── SOUND ─────────────────────────────────────────────────────────────
function _sfx(id) {
  const el = document.getElementById('snd-' + id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

// ── PGN ───────────────────────────────────────────────────────────────
function _pgn() {
  const date = new Date().toISOString().split('T')[0];
  return `[Event "Local Game"]\n[Site "Chess App"]\n[Date "${date}"]\n[White "${_pWhite}"]\n[Black "${_pBlack}"]\n[TimeControl "${_tc.label}"]\n[Result "*"]\n\n${_chess.pgn({ max_width:80, newline:'\n' })}`;
}

// ── EVENT WIRING ──────────────────────────────────────────────────────
let _eventsAttached = false;

function _attachGameEvents() {
  if (_eventsAttached) return;
  _eventsAttached = true;

  document.getElementById('flip-btn').addEventListener('click', () => {
    _orientation = _orientation === 'white' ? 'black' : 'white';
    _board.flip();
  });

  document.getElementById('theme-btn').addEventListener('click', () => {
    const row = document.getElementById('theme-row');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  });

  document.querySelectorAll('.th-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      _theme = btn.dataset.theme;
      document.querySelectorAll('.th-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('board').className = `board-el theme-${_theme}`;
      document.getElementById('theme-row').style.display = 'none';
    });
  });

  document.getElementById('nav-start').addEventListener('click', _navStart);
  document.getElementById('nav-prev' ).addEventListener('click', _navPrev);
  document.getElementById('nav-next' ).addEventListener('click', _navNext);
  document.getElementById('nav-end'  ).addEventListener('click', _navEnd);

  // Keyboard nav
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { _navPrev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { _navNext(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { _navStart(); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { _navEnd(); e.preventDefault(); }
    if (e.key === 'f' || e.key === 'F') { _orientation = _orientation === 'white' ? 'black' : 'white'; _board.flip(); }
  });

  document.getElementById('undo-btn').addEventListener('click', () => {
    if (!_chess.history().length) return;
    _chess.undo();
    if (_moveHistory.length) _moveHistory.pop();
    _viewIdx = -1;
    _board.position(_chess.fen(), false);
    _updateAllUI();
    _renderMoveList();
  });

  document.getElementById('resign-btn').addEventListener('click', () => {
    if (!_gameActive) return;
    if (!confirm('Resign this game?')) return;
    _clock?.stop();
    _gameActive = false;
    _showResult(_chess.turn() === 'w' ? 'resign-white' : 'resign-black');
  });

  document.getElementById('draw-btn').addEventListener('click', () => {
    if (!_gameActive) return;
    if (!confirm('Accept draw?')) return;
    _clock?.stop();
    _gameActive = false;
    _showResult('draw-agreed');
  });

  document.getElementById('new-game-btn').addEventListener('click', () => {
    _clock?.stop();
    document.getElementById('game-app').style.display    = 'none';
    document.getElementById('setup-overlay').style.display = 'flex';
  });

  document.getElementById('ra-new').addEventListener('click', () => {
    document.getElementById('result-overlay').style.display = 'none';
    _clock?.stop();
    document.getElementById('game-app').style.display    = 'none';
    document.getElementById('setup-overlay').style.display = 'flex';
  });

  document.getElementById('ra-rematch').addEventListener('click', () => {
    document.getElementById('result-overlay').style.display = 'none';
    launchGame(_pWhite, _pBlack, _tc);
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    document.getElementById('game-name').value = `${_pWhite} vs ${_pBlack}`;
    document.getElementById('save-modal').classList.add('show');
  });

  document.getElementById('confirm-save').addEventListener('click', () => {
    const name = document.getElementById('game-name').value.trim() || 'Untitled';
    _lib.save(name, _pgn(), _tc.label);
    document.getElementById('save-modal').classList.remove('show');
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([_pgn()], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'game.pgn'; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('fen-btn').addEventListener('click', () => {
    document.getElementById('fen-input').value = _chess.fen();
    document.getElementById('fen-modal').classList.add('show');
  });

  document.getElementById('confirm-fen').addEventListener('click', () => {
    try {
      _chess.load(document.getElementById('fen-input').value.trim());
      _moveHistory = []; _viewIdx = -1;
      _board.position(_chess.fen(), false);
      _updateAllUI(); _renderMoveList();
      document.getElementById('fen-modal').classList.remove('show');
    } catch(e) { alert('Invalid FEN'); }
  });

  document.getElementById('copy-fen').addEventListener('click', () => {
    navigator.clipboard?.writeText(_chess.fen()).catch(() => {});
    document.getElementById('fen-input').value = _chess.fen();
  });

  document.getElementById('lib-btn').addEventListener('click', () => {
    _renderLib();
    document.getElementById('library-modal').classList.add('show');
  });

  document.querySelectorAll('.mc-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.modal)?.classList.remove('show');
    });
  });

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
}

function _renderLib() {
  const list = document.getElementById('lib-list');
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
      _clock?.stop();
      _board.position(_chess.fen(), false);
      _updateAllUI(); _renderMoveList();
      document.getElementById('library-modal').classList.remove('show');
    });
    item.querySelector('.del').addEventListener('click', () => {
      _lib.delete(g.id); _renderLib();
    });
    list.appendChild(item);
  });
}

// ── Clock timeout callback ────────────────────────────────────────────
Clock.prototype._onTimeout = function(color) {
  if (!_gameActive) return;
  _clock?.stop();
  _gameActive = false;
  _showResult(`timeout-${color}`);
};

// Patch Clock to call global timeout
const _OrigClockTick = Clock.prototype._tick;
Clock.prototype._tick = function() {
  const now = Date.now();
  const dt  = (now - this._last) / 1000;
  this._last = now;
  if (this.active === 'white') this.white = Math.max(0, this.white - dt);
  else if (this.active === 'black') this.black = Math.max(0, this.black - dt);
  if (this[this.active] <= 0) {
    this.stop();
    const color = this.active || 'white';
    this.active = null;
    if (_gameActive) {
      _gameActive = false;
      _showResult(`timeout-${color}`);
    }
  }
};

// ── START BUTTON (DOMContentLoaded) ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _lib = new GameLibrary();

  document.getElementById('start-btn').addEventListener('click', () => {
    const pW = document.getElementById('name-white').value.trim() || 'Player 1';
    const pB = document.getElementById('name-black').value.trim() || 'Player 2';
    const tc = getCurrentTC();
    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('game-app').style.display      = 'flex';
    launchGame(pW, pB, tc);
  });
});
