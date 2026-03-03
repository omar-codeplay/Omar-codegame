const pieceImages = {
    'p': 'chess/images/black-pawn.png',
    'r': 'chess/images/black-rook.png',
    'n': 'chess/images/black-knight.png',
    'b': 'chess/images/black-bishop.png',
    'q': 'chess/images/black-queen.png',
    'k': 'chess/images/black-king.png',
    'P': 'chess/images/white-pawn.png',
    'R': 'chess/images/white-rook.png',
    'N': 'chess/images/white-knight.png',
    'B': 'chess/images/white-bishop.png',
    'Q': 'chess/images/white-queen.png',
    'K': 'chess/images/white-king.png'
};

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
            if (typeof Chess === 'undefined') {
                throw new Error('Chess library not loaded');
            }
            this.chess = new Chess();
        } catch (e) {
            this.chess = null;
        }
        
        this.selectedSquare = null;
        this.library = new GameLibrary();
        this.audioContext = null;
        this.currentMoveIndex = -1; // -1 means we're at the current game position
        
        // Drag-to-move properties
        this.isDragging = false;
        this.dragSource = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        this.renderBoard();
        this.updateTurnDisplay();
        this.attachEventListeners();
    }

    renderBoard() {
        const boardElement = document.getElementById('board');
        if (!boardElement) {
            console.error('Board element not found');
            return;
        }
        
        boardElement.innerHTML = '';
        
        // Get FEN - use default if chess library not available
        let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        if (this.chess && typeof this.chess.fen === 'function') {
            try {
                fen = this.chess.fen();
            } catch (e) {
                // Use default
            }
        }
        
        // Parse FEN and create board
        const fenBoard = fen.split(' ')[0].split('/');
        let squareIdx = 0;
        
        for (let row = 0; row < 8; row++) {
            const rankStr = fenBoard[row];
            for (let col = 0; col < rankStr.length; col++) {
                const char = rankStr[col];
                
                if (/\d/.test(char)) {
                    // Empty squares
                    const emptyCount = parseInt(char);
                    for (let e = 0; e < emptyCount; e++) {
                        const currentCol = (squareIdx) % 8;
                        const isLight = (row + currentCol) % 2 === 0;
                        const squareName = this.getSquareName(row, currentCol);
                        
                        const square = document.createElement('div');
                        square.className = 'square ' + (isLight ? 'light' : 'dark');
                        square.id = `square-${squareName}`;
                        square.dataset.square = squareName;
                        square.addEventListener('click', () => this.onSquareClick(squareName));
                        square.addEventListener('mousedown', (e) => this.onSquareMouseDown(e, squareName));
                        square.addEventListener('mousemove', (e) => this.onSquareMouseMove(e, squareName));
                        square.addEventListener('mouseup', (e) => this.onSquareMouseUp(e, squareName));
                        square.addEventListener('mouseleave', (e) => this.onSquareMouseLeave(e, squareName));
                        boardElement.appendChild(square);
                        squareIdx++;
                    }
                } else {
                    // Piece square
                    const currentCol = (squareIdx) % 8;
                    const isLight = (row + currentCol) % 2 === 0;
                    const squareName = this.getSquareName(row, currentCol);
                    
                    const square = document.createElement('div');
                    square.className = 'square ' + (isLight ? 'light' : 'dark');
                    square.id = `square-${squareName}`;
                    square.dataset.square = squareName;
                    
                    if (pieceImages[char]) {
                        const img = document.createElement('img');
                        img.src = pieceImages[char];
                        img.className = 'piece';
                        img.draggable = false;
                        square.appendChild(img);
                    }
                    
                    square.addEventListener('click', () => this.onSquareClick(squareName));
                    square.addEventListener('mousedown', (e) => this.onSquareMouseDown(e, squareName));
                    square.addEventListener('mousemove', (e) => this.onSquareMouseMove(e, squareName));
                    square.addEventListener('mouseup', (e) => this.onSquareMouseUp(e, squareName));
                    square.addEventListener('mouseleave', (e) => this.onSquareMouseLeave(e, squareName));
                    boardElement.appendChild(square);
                    squareIdx++;
                }
            }
        }
    }

    getSquareName(row, col) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        return files[col] + ranks[row];
    }

    onSquareClick(square) {
        if (!this.selectedSquare) {
            // Select a piece
            const piece = this.chess.get(square);
            if (piece && piece.color === (this.chess.turn() === 'w' ? 'w' : 'b')) {
                this.selectedSquare = square;
                document.getElementById(`square-${square}`).classList.add('selected');
                this.showLegalMoves(square);
            }
        } else {
            // Try to move or select another piece
            if (this.selectedSquare === square) {
                // Deselect
                this.clearSelection();
            } else {
                // Try to move
                const move = this.chess.move({
                    from: this.selectedSquare,
                    to: square,
                    promotion: 'q' // default to queen promotion
                });

                if (move) {
                    this.renderBoard();
                    this.updateTurnDisplay();
                    this.updateMoveLog();
                    this.selectedSquare = null;
                } else {
                    // Try selecting another piece
                    this.clearSelection();
                    const piece = this.chess.get(square);
                    if (piece && piece.color === (this.chess.turn() === 'w' ? 'w' : 'b')) {
                        this.selectedSquare = square;
                        document.getElementById(`square-${square}`).classList.add('selected');
                        this.showLegalMoves(square);
                    }
                }
            }
        }
    }

    onSquareMouseDown(e, square) {
        // Check if there's a piece on this square and it's the current player's piece
        const piece = this.chess.get(square);
        if (piece && piece.color === (this.chess.turn() === 'w' ? 'w' : 'b')) {
            this.isDragging = true;
            this.dragSource = square;
            const squareElement = document.getElementById(`square-${square}`);
            squareElement.classList.add('dragging');
            this.clearSelection();
            this.selectedSquare = square;
            squareElement.classList.add('selected');
            this.showLegalMoves(square);
            e.preventDefault();
        }
    }

    onSquareMouseMove(e, square) {
        // Optional: Could add visual feedback here (e.g., highlight potential drop target)
    }

    onSquareMouseUp(e, square) {
        if (this.isDragging && this.dragSource) {
            const sourceElement = document.getElementById(`square-${this.dragSource}`);
            if (sourceElement) {
                sourceElement.classList.remove('dragging');
            }

            if (this.dragSource === square) {
                // Dropped on same square - just clear selection
                this.clearSelection();
            } else {
                // Try to move
                const move = this.chess.move({
                    from: this.dragSource,
                    to: square,
                    promotion: 'q' // default to queen promotion
                });

                if (move) {
                    this.renderBoard();
                    this.updateTurnDisplay();
                    this.updateMoveLog();
                    this.selectedSquare = null;
                } else {
                    // Invalid move - reselect source piece
                    this.clearSelection();
                    this.selectedSquare = this.dragSource;
                    sourceElement.classList.add('selected');
                    this.showLegalMoves(this.dragSource);
                }
            }

            this.isDragging = false;
            this.dragSource = null;
        }
        e.preventDefault();
    }

    onSquareMouseLeave(e, square) {
        // Optional: Could add visual feedback here
    }

    showLegalMoves(square) {
        const moves = this.chess.moves({ square: square, verbose: true });
        moves.forEach(move => {
            const squareElement = document.getElementById(`square-${move.to}`);
            if (squareElement) {
                squareElement.classList.add('legal-move');
            }
        });
    }

    clearSelection() {
        if (this.selectedSquare) {
            document.getElementById(`square-${this.selectedSquare}`).classList.remove('selected');
            const allSquares = document.querySelectorAll('.square');
            allSquares.forEach(sq => sq.classList.remove('legal-move'));
        }
        this.selectedSquare = null;
    }


    resetGame() {
        this.chess.reset();
        this.clearSelection();
        this.renderBoard();
        this.updateTurnDisplay();
        this.updateMoveLog();
    }

    undoMove() {
        if (this.chess.history().length > 0) {
            this.chess.undo();
            this.currentMoveIndex = this.chess.history().length - 1;
            this.clearSelection();
            this.renderBoard();
            this.updateTurnDisplay();
            this.updateMoveLog();
        }
    }

    prevMove() {
        // Undo one move
        this.undoMove();
    }

    nextMove() {
        // Can't redo without storing history
        // This would require a more complex implementation
        // For now, this is disabled
    }

    attachEventListeners() {
        const resetBtn = document.getElementById('reset-btn');
        const undoBtn = document.getElementById('undo-btn');
        const loadFenBtn = document.getElementById('load-fen-btn');
        const exportPgnBtn = document.getElementById('export-pgn-btn');
        const saveLbtn = document.getElementById('save-lib-btn');
        const libBtn = document.getElementById('lib-btn');

        const fenModal = document.getElementById('fen-modal');
        const libraryModal = document.getElementById('library-modal');
        const saveModal = document.getElementById('save-modal');

        const confirmFenBtn = document.getElementById('confirm-fen-btn');
        const confirmSaveBtn = document.getElementById('confirm-save-btn');
        const closeFenBtn = fenModal.querySelector('.close');
        const closeLibraryBtn = libraryModal.querySelector('.close');
        const closeSaveBtn = saveModal.querySelector('.close');

        if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());
        if (undoBtn) undoBtn.addEventListener('click', () => this.undoMove());

        const prevMoveBtn = document.getElementById('prev-move-btn');
        const nextMoveBtn = document.getElementById('next-move-btn');
        if (prevMoveBtn) prevMoveBtn.addEventListener('click', () => this.prevMove());
        if (nextMoveBtn) nextMoveBtn.addEventListener('click', () => this.nextMove());

        if (loadFenBtn) {
            loadFenBtn.addEventListener('click', () => {
                document.getElementById('fen-input').value = this.chess.fen();
                fenModal.classList.add('show');
            });
        }

        if (exportPgnBtn) {
            exportPgnBtn.addEventListener('click', () => {
                const pgn = this.generatePGN();
                const blob = new Blob([pgn], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'game.pgn';
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        if (saveLbtn) {
            saveLbtn.addEventListener('click', () => {
                saveModal.classList.add('show');
                document.getElementById('game-name').value = 'Game ' + new Date().toLocaleTimeString();
            });
        }

        if (libBtn) {
            libBtn.addEventListener('click', () => {
                this.updateLibraryUI();
                libraryModal.classList.add('show');
            });
        }

        if (confirmFenBtn) {
            confirmFenBtn.addEventListener('click', () => {
                const fen = document.getElementById('fen-input').value;
                try {
                    this.chess.load(fen);
                    this.clearSelection();
                    this.renderBoard();
                    this.updateTurnDisplay();
                    this.updateMoveLog();
                    fenModal.classList.remove('show');
                } catch (error) {
                    // Invalid FEN - silently fail
                }
            });
        }

        if (confirmSaveBtn) {
            confirmSaveBtn.addEventListener('click', () => {
                const name = document.getElementById('game-name').value || 'Untitled Game';
                this.library.saveGame(name, this.generatePGN());
                saveModal.classList.remove('show');
            });
        }

        if (closeFenBtn) closeFenBtn.addEventListener('click', () => fenModal.classList.remove('show'));
        if (closeLibraryBtn) closeLibraryBtn.addEventListener('click', () => libraryModal.classList.remove('show'));
        if (closeSaveBtn) closeSaveBtn.addEventListener('click', () => saveModal.classList.remove('show'));

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === fenModal) fenModal.classList.remove('show');
            if (e.target === libraryModal) libraryModal.classList.remove('show');
            if (e.target === saveModal) saveModal.classList.remove('show');
        });
    }

    updateTurnDisplay() {
        const turnDisplay = document.getElementById('turn');
        if (!turnDisplay) {
            console.warn('Turn display element not found');
            return;
        }
        
        if (!this.chess) {
            turnDisplay.textContent = 'Waiting for chess library...';
            return;
        }
        
        try {
            const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
            const symbol = this.chess.turn() === 'w' ? '⚪' : '⚫';
            turnDisplay.textContent = symbol + ' ' + turn.toUpperCase() + "'S TURN";
            
            // Check for game status
            const statusDisplay = document.getElementById('game-status');
            if (statusDisplay) {
                if (this.chess.in_checkmate()) {
                    statusDisplay.textContent = '♔ Checkmate! ' + (turn === 'White' ? 'Black' : 'White') + ' wins!';
                } else if (this.chess.in_check()) {
                    statusDisplay.textContent = '⚠️ Check!';
                } else if (this.chess.in_draw()) {
                    statusDisplay.textContent = 'Game Draw';
                } else {
                    statusDisplay.textContent = '';
                }
            }
        } catch (e) {
            console.error('Error in updateTurnDisplay:', e);
            turnDisplay.textContent = 'Error loading game state';
        }
    }

    updateMoveLog() {
        const history = this.chess.history({ verbose: true });
        const movesDiv = document.getElementById('moves');
        movesDiv.innerHTML = '';

        for (let i = 0; i < history.length; i++) {
            const moveNum = Math.floor(i / 2) + 1;
            const move = history[i];
            
            if (i % 2 === 0) {
                const entry = document.createElement('span');
                entry.className = 'move-entry';
                entry.textContent = moveNum + '. ' + move.san + ' ';
                movesDiv.appendChild(entry);
            } else {
                movesDiv.children[movesDiv.children.length - 1].textContent += move.san + ' ';
            }
        }

        // Update PGN notation
        const pgn = this.generatePGN();
        document.getElementById('pgn-notation').textContent = pgn;
    }

    generatePGN() {
        const dateStr = new Date().toISOString().split('T')[0];
        let pgn = '';
        
        pgn += '[Event "Casual Chess Game"]\n';
        pgn += '[Site "Offline"]\n';
        pgn += '[Date "' + dateStr + '"]\n';
        pgn += '[White "Player 1"]\n';
        pgn += '[Black "Player 2"]\n';
        
        if (this.chess.in_checkmate()) {
            pgn += '[Result "' + (this.chess.turn() === 'w' ? '0-1' : '1-0') + '"]\n\n';
        } else {
            pgn += '[Result "*"]\n\n';
        }
        
        const history = this.chess.history({ verbose: true });
        const moves = [];
        
        for (let i = 0; i < history.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = history[i] ? history[i].san : '(...)';
            const blackMove = history[i + 1] ? history[i + 1].san : '';
            
            if (blackMove) {
                moves.push(moveNum + '. ' + whiteMove + ' ' + blackMove);
            } else {
                moves.push(moveNum + '. ' + whiteMove);
            }
        }
        
        pgn += moves.join(' ');
        if (this.chess.in_checkmate()) {
            pgn += ' ' + (this.chess.turn() === 'w' ? '0-1' : '1-0');
        } else {
            pgn += ' *';
        }
        
        return pgn;
    }

    updateLibraryUI() {
        const libraryList = document.getElementById('library-list');
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
                </div>
            `;

            item.querySelector('.load').addEventListener('click', () => {
                const savedGame = this.library.loadGame(game.id);
                if (savedGame) {
                    try {
                        this.chess.reset();
                        // Parse and replay PGN to restore position
                        // For now, just load the starting position
                        this.clearSelection();
                        this.renderBoard();
                        this.updateTurnDisplay();
                        this.updateMoveLog();
                        document.getElementById('library-modal').classList.remove('show');
                    } catch (error) {
                        // Failed to load game - silently fail
                    }
                }
            });

            item.querySelector('.delete').addEventListener('click', () => {
                this.library.deleteGame(game.id);
                this.updateLibraryUI();
            });

            libraryList.appendChild(item);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
