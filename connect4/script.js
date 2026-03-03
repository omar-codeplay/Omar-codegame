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

// audio context for generating simple tones
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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

let lastMove = null; // remember the last dropped disc location

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

            // add drop animation class if this is the last move
            if (lastMove && lastMove.row == row && lastMove.col == col) {
                cellDiv.classList.add('drop');
            }

            cellDiv.addEventListener('click', handleCellClick);
            // highlight column on hover
            cellDiv.addEventListener('mouseover', () => highlightColumn(col));
            cellDiv.addEventListener('mouseout', () => clearColumn(col));
            rowDiv.appendChild(cellDiv);
        }
        gameBoard.appendChild(rowDiv);
    }
    // clear lastMove so animation only plays once
    lastMove = null;
    updateStatus();
}

function handleCellClick(event) {
    const col = event.target.dataset.col;
    if (dropDisc(col)) {
        if (checkWin()) {
            statusDiv.textContent = `Player ${currentPlayer} wins!`;
            disableBoard();
            playWin();
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
            lastMove = { row, col };
            renderBoard();
            playDrop();
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

// -----------------------------------------------------------------------------
// sound helpers using Web Audio API
// -----------------------------------------------------------------------------
function playTone(frequency, duration = 0.1, type = 'sine') {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playDrop() {
    playTone(440, 0.05, 'square');
}

function playWin() {
    // simple celebratory arpeggio
    playTone(523.25, 0.15, 'triangle');
    setTimeout(() => playTone(659.25, 0.15, 'triangle'), 150);
    setTimeout(() => playTone(783.99, 0.15, 'triangle'), 300);
}

function playReset() {
    playTone(261.63, 0.1, 'sawtooth');
}


function updateStatus() {
    statusDiv.textContent = `Player ${currentPlayer}'s turn`;
}

function disableBoard() {
    // remove click listeners on individual cells
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.removeEventListener('click', handleCellClick));
    // prevent further hovering or clicking
    gameBoard.style.pointerEvents = 'none';
}

function resetGame() {
    currentPlayer = PLAYER1;
    initBoard();
    playReset();
}

// highlight helpers
function highlightColumn(col) {
    const cells = document.querySelectorAll(`.cell[data-col="${col}"]`);
    cells.forEach(c => c.classList.add('hover'));
}

function clearColumn(col) {
    const cells = document.querySelectorAll(`.cell[data-col="${col}"]`);
    cells.forEach(c => c.classList.remove('hover'));
}

initBoard();