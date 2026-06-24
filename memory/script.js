const gameBoard = document.getElementById('game-board');
const resetButton = document.getElementById('reset-button');
const triesDisplay = document.getElementById('tries');
const levelSelect = document.getElementById('level-select');
const hintButton = document.getElementById('hint-button');
const timerDisplay = document.getElementById('timerDisplay');
const messageOverlay = document.getElementById('messageOverlay');
const messageBox = document.getElementById('messageBox');
let cards = [];
let flippedCards = [];
let matchedCards = [];
let tries = 0;
let level = 4;
let maxTries = 10;

let timerInterval = null;
let elapsed = 0;
let gameActive = false;

// audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration = 0.15, type = 'sine') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.05);
}

function playFlip() {
    playTone(440, 0.08, 'square');
}

function playMatch() {
    playTone(523.25, 0.2, 'triangle');
    setTimeout(() => playTone(659.25, 0.2, 'triangle'), 150);
}

function playMismatch() {
    playTone(150, 0.3, 'square');
}

function playWin() {
    const seq = [523.25, 587.33, 659.25];
    seq.forEach((f,i)=> setTimeout(()=>playTone(f,0.1,'sine'), i*120));
}

function playLose() {
    playTone(200, 0.5, 'sawtooth');
}

levelSelect.addEventListener('change', (event) => {
    level = parseInt(event.target.value);
    playTone(392, 0.1, 'sine');
    if (level === 4) {
        maxTries = 20;
    } else if (level === 8) {
        maxTries = 30;
    }
    createBoard();
});

resetButton.addEventListener('click', () => { messageOverlay.style.display = 'none'; createBoard(); playTone(261.63, 0.15, 'sawtooth'); });

function generateCards(level) {
    const cardValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const selectedValues = cardValues.slice(0, (level === 8 ? 15 : (level * level) / 2));
    return [...selectedValues, ...selectedValues];
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
}

function startTimer() {
    stopTimer();
    elapsed = 0;
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
        elapsed++;
        timerDisplay.textContent = formatTime(elapsed);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function showMessage(icon, title, msg) {
    messageOverlay.style.display = 'flex';
    messageBox.innerHTML = `
        <div style="font-size:48px;margin-bottom:12px">${icon}</div>
        <div style="font-size:22px;font-weight:700;margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">${msg}</div>
        <button onclick="this.closest('.message-overlay').style.display='none'" style="margin-top:20px;padding:12px 28px;border-radius:8px;border:1px solid rgba(129,182,76,0.4);background:rgba(129,182,76,0.12);color:#81b64c;font-size:14px;font-weight:700;cursor:pointer">Play Again</button>
    `;
}

function createBoard() {
    stopTimer();
    gameActive = true;
    cards = generateCards(level);
    shuffle(cards);
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${level === 8 ? 6 : level}, 1fr)`;
    cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.dataset.card = card;
        cardElement.dataset.index = index;

        const front = document.createElement('div');
        front.classList.add('front');
        front.textContent = card;

        const back = document.createElement('div');
        back.classList.add('back');

        cardElement.appendChild(front);
        cardElement.appendChild(back);

        cardElement.addEventListener('click', handleCardClick);
        gameBoard.appendChild(cardElement);
    });
    tries = maxTries;
    triesDisplay.textContent = tries;
    flippedCards = [];
    matchedCards = [];
    playTone(329.63, 0.2, 'triangle'); // start board sound
    showMessage('🧠', 'Ready!', `Match all pairs. You have ${maxTries} tries.`);
    messageOverlay.addEventListener('click', e => { if (e.target === messageOverlay) messageOverlay.style.display = 'none'; }, {once: true});
}

function handleCardClick(event) {
    const cardElement = event.currentTarget;
    const card = cardElement.dataset.card;
    const index = cardElement.dataset.index;

    if (!gameActive) return;
    if (flippedCards.length < 2 && !cardElement.classList.contains('flipped') && !matchedCards.includes(index)) {
        // Start timer on first click
        if (flippedCards.length === 0 && matchedCards.length === 0) {
            startTimer();
        }
        cardElement.classList.add('flipped');
        playFlip();
        flippedCards.push({ card, index });

        if (flippedCards.length === 2) {
            checkForMatch();
        }
    }
}

function checkForMatch() {
    const [firstCard, secondCard] = flippedCards;

    if (firstCard.card === secondCard.card) {
        matchedCards.push(firstCard.index, secondCard.index);
        document.querySelector(`[data-index="${firstCard.index}"]`).classList.add('matched');
        document.querySelector(`[data-index="${secondCard.index}"]`).classList.add('matched');
        flippedCards = [];
        playMatch();
        if (matchedCards.length === cards.length) {
            gameActive = false;
            stopTimer();
            setTimeout(() => {
                playWin();
                showMessage('🎉', 'You Win!', `All pairs matched in ${formatTime(elapsed)} with ${maxTries - tries} tries used.`);
            }, 500);
        }
    } else {
        document.querySelector(`[data-index="${firstCard.index}"]`).classList.add('unmatched');
        document.querySelector(`[data-index="${secondCard.index}"]`).classList.add('unmatched');
        playMismatch();
        // shake board briefly
        gameBoard.classList.add('shake');
        setTimeout(() => gameBoard.classList.remove('shake'), 400);
        setTimeout(() => {
            document.querySelector(`[data-index="${firstCard.index}"]`).classList.remove('flipped', 'unmatched');
            document.querySelector(`[data-index="${secondCard.index}"]`).classList.remove('flipped', 'unmatched');
            flippedCards = [];
        }, 1000);
        tries--;
        triesDisplay.textContent = tries;
    }

    if (tries <= 0) {
        gameActive = false;
        stopTimer();
        setTimeout(() => {
            playLose();
            gameBoard.classList.add('shake');
            setTimeout(() => gameBoard.classList.remove('shake'), 400);
            showMessage('💔', 'Game Over', 'You ran out of tries. Try again!');
        }, 500);
    }
}

// duplicate listener removed earlier

hintButton.addEventListener('click', function() {
    playTone(440, 0.1, 'triangle');
    // Show rewarded video ad
    showRewardedAd().then(() => {
        // Reveal two matching cards after the ad is watched
        revealMatchingCards();
    }).catch((error) => {
        console.error('Ad failed to load or was not watched completely:', error);
    });
});

function showRewardedAd() {
    return new Promise((resolve, reject) => {
        // Simulate showing a rewarded video ad
        setTimeout(() => {
            const adWatched = confirm('Watch a rewarded video ad to get a hint?');
            if (adWatched) {
                resolve();
            } else {
                reject('Ad not watched');
            }
        }, 1000);
    });
}

function revealMatchingCards() {
    // Logic to reveal two matching cards
    // Replace this with your actual game logic
    const cardElements = document.querySelectorAll('.card');
    let firstMatch = null;
    for (let i = 0; i < cardElements.length; i++) {
        for (let j = i + 1; j < cardElements.length; j++) {
            if (cardElements[i].dataset.card === cardElements[j].dataset.card &&
                !cardElements[i].classList.contains('matched') &&
                !cardElements[j].classList.contains('matched')) {
                firstMatch = [cardElements[i], cardElements[j]];
                break;
            }
        }
        if (firstMatch) break;
    }
    if (firstMatch) {
        firstMatch[0].classList.add('flipped', 'hint');
        firstMatch[1].classList.add('flipped', 'hint');
        setTimeout(() => {
            firstMatch[0].classList.remove('hint', 'flipped');
            firstMatch[1].classList.remove('hint', 'flipped');
        }, 2000);
    }
}

createBoard();