const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('start-button');
const scoreDisplay = document.getElementById('score');
const paddleWidth = 10;
const paddleHeight = 100;
const ballSize = 10;
let player1Score = 0;
let player2Score = 0;
let gameInterval;
let ball, paddle1, paddle2;

function startGame() {
    clearInterval(gameInterval); // Clear any existing game interval
    player1Score = 0;
    player2Score = 0;
    scoreDisplay.textContent = `Player 1: ${player1Score} | Player 2: ${player2Score}`;
    ball = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: 5,
        vy: 5,
        size: ballSize
    };
    paddle1 = {
        x: 0,
        y: canvas.height / 2 - paddleHeight / 2,
        width: paddleWidth,
        height: paddleHeight,
        vy: 0
    };
    paddle2 = {
        x: canvas.width - paddleWidth,
        y: canvas.height / 2 - paddleHeight / 2,
        width: paddleWidth,
        height: paddleHeight,
        vy: 0
    };
    gameInterval = setInterval(updateGame, 1000 / 60); // 60 FPS
}

function updateGame() {
    moveBall();
    movePaddles();
    checkCollisions();
    drawGame();
}

function moveBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y <= 0 || ball.y + ball.size >= canvas.height) {
        ball.vy *= -1;
    }

    if (ball.x <= 0) {
        player2Score++;
        if (player2Score >= 7) {
            endGame('Player 2');
        } else {
            resetBall();
        }
    } else if (ball.x + ball.size >= canvas.width) {
        player1Score++;
        if (player1Score >= 7) {
            endGame('Player 1');
        } else {
            resetBall();
        }
    }
}

function movePaddles() {
    paddle1.y += paddle1.vy;
    paddle2.y += paddle2.vy;

    if (paddle1.y < 0) paddle1.y = 0;
    if (paddle1.y + paddle1.height > canvas.height) paddle1.y = canvas.height - paddle1.height;
    if (paddle2.y < 0) paddle2.y = 0;
    if (paddle2.y + paddle2.height > canvas.height) paddle2.y = canvas.height - paddle2.height;
}

function checkCollisions() {
    if (ball.x <= paddle1.x + paddle1.width && ball.y + ball.size >= paddle1.y && ball.y <= paddle1.y + paddle1.height) {
        ball.vx *= -1;
    }

    if (ball.x + ball.size >= paddle2.x && ball.y + ball.size >= paddle2.y && ball.y <= paddle2.y + paddle2.height) {
        ball.vx *= -1;
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx *= -1;
    scoreDisplay.textContent = `Player 1: ${player1Score} | Player 2: ${player2Score}`;
}

function endGame(winner) {
    clearInterval(gameInterval);
    alert(`${winner} wins!`);
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);

    ctx.fillStyle = 'red';
    ctx.fillRect(ball.x, ball.y, ball.size, ball.size);
}

function changeDirection(event) {
    event.preventDefault();
    const key = event.keyCode;
    if (key === 87) {
        paddle1.vy = -5;
    } else if (key === 83) {
        paddle1.vy = 5;
    } else if (key === 38) {
        paddle2.vy = -5;
    } else if (key === 40) {
        paddle2.vy = 5;
    }
}

function stopPaddle(event) {
    event.preventDefault();
    const key = event.keyCode;
    if (key === 87 || key === 83) {
        paddle1.vy = 0;
    } else if (key === 38 || key === 40) {
        paddle2.vy = 0;
    }
}

function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = x - canvasRect.left;
    const canvasY = y - canvasRect.top;

    if (canvasX < canvasRect.width / 2) {
        if (canvasY < paddle1.y + paddle1.height / 2) {
            paddle1.vy = -5;
        } else {
            paddle1.vy = 5;
        }
    } else {
        if (canvasY < paddle2.y + paddle2.height / 2) {
            paddle2.vy = -5;
        } else {
            paddle2.vy = 5;
        }
    }
}

function handleTouchEnd(event) {
    paddle1.vy = 0;
    paddle2.vy = 0;
}

function resizeCanvas() {
    if (window.innerWidth < window.innerHeight) {
        canvas.width = window.innerWidth * 0.9;
        canvas.height = window.innerWidth * 0.45;
    } else {
        canvas.width = window.innerWidth * 0.9;
        canvas.height = window.innerHeight * 0.9;
    }
    drawGame();
}

document.addEventListener('keydown', changeDirection, { passive: false });
document.addEventListener('keyup', stopPaddle, { passive: false });
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
startButton.addEventListener('click', startGame);
window.addEventListener('resize', resizeCanvas);

resizeCanvas();