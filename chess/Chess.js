class GameLibrary {
    constructor() {
        this.games = this.loadGames();
    }

    loadGames() {
        const stored = localStorage.getItem('chessGames');
        return stored ? JSON.parse(stored) : [];
    }

    saveGame(name, pgn) {
        const game = {
            id: Date.now(),
            name: name,
            date: new Date().toLocaleString(),
            pgn: pgn,
            moveCount: (pgn.match(/\d+\./g) || []).length
        };
        this.games.push(game);
        this.persist();
        return game.id;
    }

    deleteGame(id) {
        this.games = this.games.filter(g => g.id !== id);
        this.persist();
    }

    loadGame(id) {
        return this.games.find(g => g.id === id);
    }

    getAllGames() {
        return [...this.games];
    }

    persist() {
        localStorage.setItem('chessGames', JSON.stringify(this.games));
    }
}

class ChessGame {
    constructor() {
        try {
            if (typeof Chess === 'undefined') throw new Error('Chess library not loaded');
            this.chess = new Chess();
        } catch (e) {
            this.chess = null;
            console.error('Chess library failed to load');
            return;
        }

        this.library = new GameLibrary();
        this.selectedSquare = null;
        this.isDragging = false;

        this.board = ChessBoard('board', {
            draggable: true,
            position: 'start',
            orientation: 'white',
            onDragStart: this.onDragStart.bind(this),
            onDrop: this.onDrop.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            pieceTheme: this.pieceTheme.bind(this)
        });

        window.addEventListener('resize', () => this.board.resize());

        // THEME INITIALIZATION
        this.themeSelect = document.getElementById('board-theme');
        this.applyTheme(this.themeSelect ? this.themeSelect.value : 'green');

        // CLICK-TO-MOVE HANDLER
        document.getElementById('board').addEventListener('click', (e) => {
            const squareElement = e.target.closest('.square-55d63');
            if (!squareElement) return;

            const square = squareElement.getAttribute('data-square');
            if (square) {
                this.onSquareClick(square);
            }
        });

        this.updateTurnDisplay();
        this.updateMoveLog();
        this.attachEventListeners();
    }

    getSquareElement(square) {
        return document.querySelector(`#board .square-55d63[data-square="${square}"]`);
    }

    applyTheme(themeName) {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        // Remove all potential theme classes
        boardEl.classList.remove('theme-green', 'theme-wood', 'theme-ocean');
        // Add the selected one
        boardEl.classList.add(`theme-${themeName}`);
    }

    highlightLastMove() {
        // Remove old highlights
        document.querySelectorAll('.last-move').forEach(el => el.classList.remove('last-move'));

        const history = this.chess.history({ verbose: true });
        if (history.length === 0) return;

        const lastMove = history[history.length - 1];
        const fromEl = this.getSquareElement(lastMove.from);
        const toEl = this.getSquareElement(lastMove.to);

        if (fromEl) fromEl.classList.add('last-move');
        if (toEl) toEl.classList.add('last-move');
    }

    pieceTheme(piece) {
        const color = piece[0] === 'w' ? 'white' : 'black';
        const type = piece[1].toLowerCase();
        const pieceNames = { 'p': 'pawn', 'n': 'knight', 'b': 'bishop', 'r': 'rook', 'q': 'queen', 'k': 'king' };
        return `chess/images/${color}-${pieceNames[type]}.png`;
    }

    onDragStart(source, piece, position, orientation) {
        this.isDragging = true;
        this.clearSelection();
        if (this.chess.game_over()) return false;
        if ((this.chess.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (this.chess.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
        return true;
    }

    onDrop(source, target) {
        const move = this.chess.move({ from: source, to: target, promotion: 'q' });
        if (move === null) {
            setTimeout(() => { this.isDragging = false; }, 100);
            return 'snapback';
        }
        this.updateTurnDisplay();
        this.updateMoveLog();
        this.highlightLastMove();
        setTimeout(() => { this.isDragging = false; }, 100);
        this.clearSelection();
    }

    onSnapEnd() {
        this.board.position(this.chess.fen());
        setTimeout(() => { this.isDragging = false; }, 100);
    }

    onSquareClick(square) {
        if (this.isDragging) return;

        if (!this.selectedSquare) {
            const piece = this.chess.get(square);
            if (piece && piece.color === this.chess.turn()) {
                this.selectedSquare = square;
                this.highlightSquare(square);
            }
            return;
        }

        if (this.selectedSquare === square) {
            this.clearSelection();
            return;
        }

        const move = this.chess.move({ from: this.selectedSquare, to: square, promotion: 'q' });

        if (move) {
            this.board.position(this.chess.fen());
            this.updateTurnDisplay();
            this.updateMoveLog();
            this.highlightLastMove();
            this.clearSelection();
        } else {
            const piece = this.chess.get(square);
            if (piece && piece.color === this.chess.turn()) {
                this.clearSelection();
                this.selectedSquare = square;
                this.highlightSquare(square);
            } else {
                this.clearSelection();
            }
        }
    }

    highlightSquare(square) {
        const squareEl = this.getSquareElement(square);
        if (squareEl) squareEl.classList.add('selected');
    }

    clearSelection() {
        if (this.selectedSquare) {
            const oldEl = this.getSquareElement(this.selectedSquare);
            if (oldEl) oldEl.classList.remove('selected');
        }
        this.selectedSquare = null;
    }

    resetGame() {
        this.chess.reset();
        this.board.position('start');
        this.clearSelection();
        document.querySelectorAll('.last-move').forEach(el => el.classList.remove('last-move'));
        this.updateTurnDisplay();
        this.updateMoveLog();
    }

    undoMove() {
        if (this.chess.history().length > 0) {
            this.chess.undo();
            this.board.position(this.chess.fen());
            this.clearSelection();
            this.highlightLastMove();
            this.updateTurnDisplay();
            this.updateMoveLog();
        }
    }

    loadFen(fen) {
        try {
            this.chess.load(fen);
            this.board.position(this.chess.fen());
            this.clearSelection();
            this.highlightLastMove();
            this.updateTurnDisplay();
            this.updateMoveLog();
        } catch (e) { }
    }

    generatePGN() {
        const dateStr = new Date().toISOString().split('T')[0];
        let pgn = `[Event "Casual Chess Game"]\n[Site "Offline"]\n[Date "${dateStr}"]\n[White "Player 1"]\n[Black "Player 2"]\n[Result "*"]\n\n`;
        pgn += this.chess.pgn({ max_width: 80, newline: '\n' });
        return pgn;
    }

    updateTurnDisplay() {
        const turnDisplay = document.getElementById('turn');
        const statusDisplay = document.getElementById('game-status');
        if (!turnDisplay) return;

        const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
        const symbol = this.chess.turn() === 'w' ? '⚪' : '⚫';
        turnDisplay.textContent = `${symbol} ${turn.toUpperCase()}'S TURN`;

        if (statusDisplay) {
            if (this.chess.in_checkmate()) {
                const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
                statusDisplay.textContent = `♔ Checkmate! ${winner} wins!`;
            } else if (this.chess.in_check()) {
                statusDisplay.textContent = '⚠️ Check!';
            } else if (this.chess.in_draw()) {
                statusDisplay.textContent = 'Game Draw';
            } else {
                statusDisplay.textContent = '';
            }
        }
    }

    updateMoveLog() {
        const history = this.chess.history({ verbose: true });
        const movesDiv = document.getElementById('moves');
        if (!movesDiv) return;
        movesDiv.innerHTML = '';

        for (let i = 0; i < history.length; i++) {
            const moveNum = Math.floor(i / 2) + 1;
            if (i % 2 === 0) {
                const entry = document.createElement('span');
                entry.className = 'move-entry';
                entry.textContent = `${moveNum}. ${history[i].san} `;
                movesDiv.appendChild(entry);
            } else {
                movesDiv.lastChild.textContent += `${history[i].san} `;
            }
        }
        const pgnText = document.getElementById('pgn-notation');
        if (pgnText) pgnText.textContent = this.generatePGN();
    }

    updateLibraryUI() {
        const libraryList = document.getElementById('library-list');
        if (!libraryList) return;
        libraryList.innerHTML = '';
        const games = this.library.getAllGames();

        if (games.length === 0) {
            libraryList.innerHTML = '<p>No saved games.</p>';
            return;
        }

        games.reverse().forEach(game => {
            const item = document.createElement('div');
            item.className = 'library-item';
            item.innerHTML = `
                <div class="library-item-info">
                    <div class="library-item-name">${game.name}</div>
                    <div class="library-item-date">${game.date} - ${game.moveCount} moves</div>
                </div>
                <div class="library-item-buttons">
                    <button class="load">Load</button>
                    <button class="delete">Delete</button>
                </div>`;

            item.querySelector('.load').addEventListener('click', () => {
                const savedGame = this.library.loadGame(game.id);
                if (savedGame) {
                    this.chess.reset();
                    this.chess.load_pgn(savedGame.pgn);
                    this.board.position(this.chess.fen());
                    this.clearSelection();
                    this.highlightLastMove();
                    this.updateTurnDisplay();
                    this.updateMoveLog();
                    document.getElementById('library-modal').classList.remove('show');
                }
            });

            item.querySelector('.delete').addEventListener('click', () => {
                this.library.deleteGame(game.id);
                this.updateLibraryUI();
            });
            libraryList.appendChild(item);
        });
    }

    attachEventListeners() {
        document.getElementById('reset-btn')?.addEventListener('click', () => this.resetGame());
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undoMove());

        this.themeSelect?.addEventListener('change', (e) => this.applyTheme(e.target.value));

        const loadFenBtn = document.getElementById('load-fen-btn');
        const fenModal = document.getElementById('fen-modal');
        if (loadFenBtn) {
            loadFenBtn.addEventListener('click', () => {
                document.getElementById('fen-input').value = this.chess.fen();
                fenModal.classList.add('show');
            });
        }

        document.getElementById('export-pgn-btn')?.addEventListener('click', () => {
            const pgn = this.generatePGN();
            const blob = new Blob([pgn], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'game.pgn'; a.click();
            URL.revokeObjectURL(url);
        });

        const saveLibBtn = document.getElementById('save-lib-btn');
        const saveModal = document.getElementById('save-modal');
        if (saveLibBtn) {
            saveLibBtn.addEventListener('click', () => {
                saveModal.classList.add('show');
                document.getElementById('game-name').value = `Game ${new Date().toLocaleTimeString()}`;
            });
        }

        document.getElementById('lib-btn')?.addEventListener('click', () => {
            this.updateLibraryUI();
            document.getElementById('library-modal').classList.add('show');
        });

        document.getElementById('confirm-fen-btn')?.addEventListener('click', () => {
            this.loadFen(document.getElementById('fen-input').value);
            fenModal.classList.remove('show');
        });

        document.getElementById('confirm-save-btn')?.addEventListener('click', () => {
            const name = document.getElementById('game-name').value || 'Untitled Game';
            this.library.saveGame(name, this.generatePGN());
            saveModal.classList.remove('show');
        });

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) e.target.classList.remove('show');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});