class FortressDuel {
    constructor() {
        this.board = [];
        this.currentPlayer = 'red'; // red starts
        this.redPos = { row: 0, col: 0 };
        this.bluePos = { row: 6, col: 6 };
        this.gameOver = false;

        this.initBoard();
        this.renderBoard();
        this.attachEvents();
    }

    initBoard() {
        // 7x7 board, all cells empty
        for (let r = 0; r < 7; r++) {
            this.board[r] = Array(7).fill('empty');
        }
        // Place kings
        this.board[0][0] = 'redKing';
        this.board[6][6] = 'blueKing';
    }

    renderBoard() {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                const cellType = this.board[r][c];
                if (cellType === 'wall') {
                    cell.classList.add('wall');
                } else if (cellType === 'redKing') {
                    cell.classList.add('red-king');
                } else if (cellType === 'blueKing') {
                    cell.classList.add('blue-king');
                }

                boardEl.appendChild(cell);
            }
        }
        this.updateTurnIndicator();
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        if (this.currentPlayer === 'red') {
            indicator.textContent = '🔴 دور الأحمر';
            indicator.style.color = '#e74c3c';
        } else {
            indicator.textContent = '🔵 دور الأزرق';
            indicator.style.color = '#3498db';
        }
    }

    attachEvents() {
        document.getElementById('board').addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (!cell || this.gameOver) return;

            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);

            // Check if it's a legal move
            if (this.isLegalMove(row, col)) {
                this.makeMove(row, col);
            }
        });

        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
    }

    isLegalMove(row, col) {
        // Must be within bounds, cell empty, and adjacent to current player's king
        if (row < 0 || row >= 7 || col < 0 || col >= 7) return false;
        if (this.board[row][col] !== 'empty') return false;

        const kingPos = this.currentPlayer === 'red' ? this.redPos : this.bluePos;
        const dr = Math.abs(row - kingPos.row);
        const dc = Math.abs(col - kingPos.col);

        // Adjacent includes diagonals (max 1 step in both axes)
        return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
    }

    makeMove(row, col) {
        // Get current king position
        const oldPos = this.currentPlayer === 'red' ? this.redPos : this.bluePos;

        // Move king to new cell
        this.board[row][col] = this.currentPlayer === 'red' ? 'redKing' : 'blueKing';

        // Place wall at old position
        this.board[oldPos.row][oldPos.col] = 'wall';

        // Update king position
        if (this.currentPlayer === 'red') {
            this.redPos = { row, col };
        } else {
            this.bluePos = { row, col };
        }

        // Check if opponent has any moves
        const opponent = this.currentPlayer === 'red' ? 'blue' : 'red';
        if (!this.hasAnyMove(opponent)) {
            this.gameOver = true;
            this.showWinner(this.currentPlayer);
        }

        // Switch player
        this.currentPlayer = opponent;

        this.renderBoard();

        // If game just ended, the board is already rendered with win message
    }

    hasAnyMove(player) {
        const kingPos = player === 'red' ? this.redPos : this.bluePos;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = kingPos.row + dr;
                const nc = kingPos.col + dc;
                if (nr >= 0 && nr < 7 && nc >= 0 && nc < 7 && this.board[nr][nc] === 'empty') {
                    return true;
                }
            }
        }
        return false;
    }

    showWinner(player) {
        const winnerName = player === 'red' ? 'الأحمر' : 'الأزرق';
        setTimeout(() => {
            alert(`🎉 الفائز هو ${winnerName} !`);
        }, 50);
    }

    resetGame() {
        this.board = [];
        this.currentPlayer = 'red';
        this.redPos = { row: 0, col: 0 };
        this.bluePos = { row: 6, col: 6 };
        this.gameOver = false;

        this.initBoard();
        this.renderBoard();
    }
}

// Start game
window.addEventListener('load', () => {
    new FortressDuel();
});