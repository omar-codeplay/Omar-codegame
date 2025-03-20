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

levelSelect.addEventListener('change', (event) => {
    level = parseInt(event.target.value);
    if (level === 4) {
        maxTries = 20;
    } else if (level === 8) {
        maxTries = 30;
    }
    createBoard();
});

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
}

function handleCardClick(event) {
    const cardElement = event.currentTarget;
    const card = cardElement.dataset.card;
    const index = cardElement.dataset.index;

    if (flippedCards.length < 2 && !cardElement.classList.contains('flipped') && !matchedCards.includes(index)) {
        cardElement.classList.add('flipped');
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
        if (matchedCards.length === cards.length) {
            setTimeout(() => alert('You win!'), 500);
        }
    } else {
        document.querySelector(`[data-index="${firstCard.index}"]`).classList.add('unmatched');
        document.querySelector(`[data-index="${secondCard.index}"]`).classList.add('unmatched');
        setTimeout(() => {
            document.querySelector(`[data-index="${firstCard.index}"]`).classList.remove('flipped', 'unmatched');
            document.querySelector(`[data-index="${secondCard.index}"]`).classList.remove('flipped', 'unmatched');
            flippedCards = [];
        }, 1000);
        tries--;
        triesDisplay.textContent = `Tries: ${tries}`;
    }

    if (tries <= 0) {
        setTimeout(() => alert('You lose!'), 500);
        createBoard();
    }
}

resetButton.addEventListener('click', createBoard);

hintButton.addEventListener('click', function() {
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