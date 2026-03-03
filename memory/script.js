const gameBoard = document.getElementById('game-board');
const resetButton = document.getElementById('reset-button');
const triesDisplay = document.getElementById('tries');
const levelSelect = document.getElementById('level-select');
const hintButton = document.getElementById('hint-button');
let cards = [];
let flippedCards = [];
let matchedCards = [];
let tries = 0;
let level = 4;
let maxTries = 10;

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

resetButton.addEventListener('click', () => { createBoard(); playTone(261.63, 0.15, 'sawtooth'); });

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

function createBoard() {
    cards = generateCards(level);
    shuffle(cards);
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${level === 8 ? 6 : level}, 100px)`;
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
    triesDisplay.textContent = `Tries: ${tries}`;
    flippedCards = [];
    matchedCards = [];
    playTone(329.63, 0.2, 'triangle'); // start board sound
}

function handleCardClick(event) {
    const cardElement = event.currentTarget;
    const card = cardElement.dataset.card;
    const index = cardElement.dataset.index;

    if (flippedCards.length < 2 && !cardElement.classList.contains('flipped') && !matchedCards.includes(index)) {
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
            setTimeout(() => {
                playWin();
                alert('You win!');
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
        triesDisplay.textContent = `Tries: ${tries}`;
    }

    if (tries <= 0) {
        setTimeout(() => {
            playLose();
            gameBoard.classList.add('shake');
            setTimeout(() => gameBoard.classList.remove('shake'), 400);
            alert('You lose!');
        }, 500);
        createBoard();
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
            firstMatch[0].classList.remove('hint');
            firstMatch[1].classList.remove('hint');
        }, 2000);
    }
}

createBoard();