const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2;

let board = [];
let currentPlayer = PLAYER1;

const gameBoard = document.getElementById('game-board');
const statusDiv = document.getElementById('status');
const resetButton = document.getElementById('reset-button');

resetButton.addEventListener('click', resetGame);

function initBoard() {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = EMPTY;
        }
    }
    renderBoard();
}

function renderBoard() {
    gameBoard.innerHTML = '';
    for (let row = 0; row < ROWS; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        for (let col = 0; col < COLS; col++) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.dataset.row = row;
            cellDiv.dataset.col = col;
            if (board[row][col] === PLAYER1) {
                cellDiv.dataset.player = PLAYER1;
            } else if (board[row][col] === PLAYER2) {
                cellDiv.dataset.player = PLAYER2;
            }
            cellDiv.addEventListener('click', handleCellClick);
            rowDiv.appendChild(cellDiv);
        }
        gameBoard.appendChild(rowDiv);
    }
    updateStatus();
}

function handleCellClick(event) {
    const col = event.target.dataset.col;
    if (dropDisc(col)) {
        if (checkWin()) {
            statusDiv.textContent = `Player ${currentPlayer} wins!`;
            disableBoard();
        } else {
            switchPlayer();
            updateStatus();
        }
    }
}

function dropDisc(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row][col] === EMPTY) {
            board[row][col] = currentPlayer;
            renderBoard();
            return true;
        }
    }
    return false;
}

function checkWin() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (checkLine(row, col, 1, 0) || // Horizontal
                checkLine(row, col, 0, 1) || // Vertical
                checkLine(row, col, 1, 1) || // Diagonal down-right
                checkLine(row, col, 1, -1)) { // Diagonal down-left
                return true;
            }
        }
    }
    return false;
}

function checkLine(row, col, rowDir, colDir) {
    let count = 0;
    for (let i = 0; i < 4; i++) {
        let r = row + i * rowDir;
        let c = col + i * colDir;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === currentPlayer) {
            count++;
        } else {
            break;
        }
    }
    return count === 4;
}

function switchPlayer() {
    currentPlayer = (currentPlayer === PLAYER1) ? PLAYER2 : PLAYER1;
}

function updateStatus() {
    statusDiv.textContent = `Player ${currentPlayer}'s turn`;
}

function disableBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.removeEventListener('click', handleCellClick));
}

function resetGame() {
    currentPlayer = PLAYER1;
    initBoard();
}

initBoard();