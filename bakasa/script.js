// Food and Animal categories
const categories = {
    food: [
        'البيتزا', 'طعميه',
        'الشاورما', 'المعكرونة', 'البيض', 'السمك',
        'الدجاج', 'الأرز', 'الخبز', 'الزبادي', 'الجبن',
        'الحليب', 'الزيتون',
        'البطاطس', 'الباذنجان', 'الفراولة', 'العسل',
        'البرتقال', 'الموز', 'البطيخ', 'الجمبري',
    ],
    animals: [
        'الأسد', 'النمر', 'الفيل', 'الزرافة', 'الحمار',
        'الحصان', 'الكلب', 'القط', 'الثعلب', 'الذئب',
        'الدب', 'الضبع', 'الضفدع', 'الثعبان', 'النسر',
        'البجعة', 'الطاووس', 'الببغاء', 'الجمل', 'الخروف',
        'الحوت', 'الدلفين', 'القرد', 'الأرنب', 'الغزال',
        'الصقر', 'البومة', 'النحلة', 'الفراشة', 'التمساح'
    ]
};

class BakasaGame {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.category = null;
        this.word = null;
        this.impostorCount = 1;
        this.impostors = [];
        this.votes = {};
        this.currentVoterIndex = 0;
        this.discussionRound = 1;
        this.revealOrder = [];
        this.guessOptions = [];

        this.setupEventListeners();
    }

    // Fisher–Yates shuffle for array in place
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    setupEventListeners() {
        // Names screen
        document.getElementById('add-player-btn').addEventListener('click', () => this.addPlayer());
        document.getElementById('player-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPlayer();
        });
        document.getElementById('names-done-btn').addEventListener('click', () => this.goToSetup());

        // Setup screen
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.category = e.target.dataset.category;
            });
        });

        document.getElementById('impostors-minus').addEventListener('click', () => this.changeImpostors(-1));
        document.getElementById('impostors-plus').addEventListener('click', () => this.changeImpostors(1));
        document.getElementById('game-start-btn').addEventListener('click', () => this.startGame());

        // Card reveal screen
        document.getElementById('card-reveal-btn').addEventListener('click', () => this.revealCard());
        document.getElementById('card-next-btn').addEventListener('click', () => this.nextCardPlayer());
        // allow flipping by tapping the card itself
        const cardDisplay = document.getElementById('card-display');
        if (cardDisplay) {
            cardDisplay.addEventListener('click', () => {
                const btn = document.getElementById('card-reveal-btn');
                if (btn && !btn.classList.contains('hidden')) {
                    this.revealCard();
                }
            });
        }

        // Discussion screen
        document.getElementById('ready-to-vote-btn').addEventListener('click', () => this.goToVoting());

        // Voting screen
        document.getElementById('voting-end-btn').addEventListener('click', () => this.endVoting());
        document.getElementById('voting-next-btn').addEventListener('click', () => this.nextVoter());

        // Results screen
        document.getElementById('play-again-btn').addEventListener('click', () => this.restart());
    }

    addPlayer() {
        const input = document.getElementById('player-name-input');
        const name = input.value.trim();

        if (!name) {
            alert('الرجاء إدخال اسم اللاعب');
            return;
        }

        if (this.players.some(p => p.name === name)) {
            alert('هذا الاسم موجود بالفعل');
            return;
        }

        this.players.push({ name, role: null, voted: false });
        input.value = '';
        this.renderPlayersList();

        // Enable next button if at least 2 players
        document.getElementById('names-done-btn').disabled = this.players.length < 2;
    }

    renderPlayersList() {
        const list = document.getElementById('players-list');
        list.innerHTML = this.players.map((p, i) => `
            <div class="player-tag">
                <span>${p.name}</span>
                <button class="btn-remove" onclick="game.removePlayer(${i})">×</button>
            </div>
        `).join('');
    }

    removePlayer(index) {
        this.players.splice(index, 1);
        this.renderPlayersList();
        document.getElementById('names-done-btn').disabled = this.players.length < 2;
    }

    goToSetup() {
        if (this.players.length < 2) {
            alert('يجب أن يكون هناك لاعبان على الأقل');
            return;
        }
        this.showScreen('setup-screen');
    }

    changeImpostors(delta) {
        const input = document.getElementById('impostors-count');
        const newValue = Math.max(1, Math.min(this.players.length - 1, parseInt(input.value) + delta));
        input.value = newValue;
        this.impostorCount = newValue;
    }

    startGame() {
        if (!this.category) {
            alert('اختر فئة أولاً');
            return;
        }

        // Select random word
        const wordList = categories[this.category];
        this.word = wordList[Math.floor(Math.random() * wordList.length)];

        // Select random impostors
        this.impostors = [];
        const indices = new Set();
        while (indices.size < this.impostorCount) {
            indices.add(Math.floor(Math.random() * this.players.length));
        }
        this.impostors = Array.from(indices);
        this.impostors.forEach(i => {
            this.players[i].role = 'impostor';
        });

        // Assign citizen role to others
        this.players.forEach((p, i) => {
            if (!indices.has(i)) {
                p.role = 'citizen';
            }
        });

        // Determine random reveal order so spy isn't always last
        this.revealOrder = this.players.map((_, i) => i);
        this.shuffleArray(this.revealOrder);
        // Start card reveal sequence
        this.currentPlayerIndex = 0;
        this.showCardRevealScreen();
    }

    showCardRevealScreen() {
        // guard against bad revealOrder
        let idx = this.currentPlayerIndex;
        if (this.revealOrder && this.revealOrder.length > this.currentPlayerIndex) {
            idx = this.revealOrder[this.currentPlayerIndex];
        } else {
            console.warn('revealOrder missing or out of range, falling back');
        }
        const player = this.players[idx] || { name: '??' };
        document.getElementById('card-label').textContent = 'اقلب بطاقتك';
        document.getElementById('player-turn-text').textContent = `${player.name}`;
        document.getElementById('card-reveal-btn').classList.remove('hidden');
        document.getElementById('card-next-btn').classList.add('hidden');
        document.getElementById('card-inner').style.transform = 'rotateY(0deg)';
        this.showScreen('card-reveal-screen');
    }

    revealCard() {
        let idx = this.currentPlayerIndex;
        if (this.revealOrder && this.revealOrder.length > this.currentPlayerIndex) {
            idx = this.revealOrder[this.currentPlayerIndex];
        } else {
            console.warn('revealOrder missing or out of range during reveal');
        }
        const player = this.players[idx] || { role: 'citizen' };
        const roleDisplay = document.getElementById('role-display');
        const wordDisplay = document.getElementById('word-display');

        if (player.role === 'impostor') {
            roleDisplay.innerHTML = '<h3>أنت جاسوس! 🕵️</h3>';
            wordDisplay.innerHTML = '<p>تخمينك:</p><p style="font-size: 1.5em;">???</p>';
        } else {
            roleDisplay.innerHTML = '<h3>أنت مواطن! 👨</h3>';
            wordDisplay.innerHTML = `<p>الكلمة:</p><p style="font-size: 1.5em;">${this.word}</p>`;
        }

        document.getElementById('card-inner').style.transform = 'rotateY(180deg)';
        document.getElementById('card-reveal-btn').classList.add('hidden');
        document.getElementById('card-next-btn').classList.remove('hidden');
    }

    nextCardPlayer() {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex < this.revealOrder.length) {
            this.showCardRevealScreen();
        } else {
            this.startDiscussion();
        }
    }

    startDiscussion() {
        document.getElementById('round-text').textContent = `جولة النقاش ${this.discussionRound}`;
        this.showScreen('discussion-screen');
    }

    goToVoting() {
        this.currentVoterIndex = 0;
        this.votes = {};
        this.showVotingScreen();
    }

    showVotingScreen() {
        if (this.currentVoterIndex >= this.players.length) {
            this.endVoting();
            return;
        }

        const voter = this.players[this.currentVoterIndex];
        document.getElementById('current-voter-text').textContent = `${voter.name} - من تختار؟`;

        const votingOptions = document.getElementById('voting-options');
        votingOptions.innerHTML = this.players
            .filter((_, i) => i !== this.currentVoterIndex)
            .map((p, idx) => `
                <button class="vote-option" onclick="game.castVote(${this.players.indexOf(p)})">
                    ${p.name}
                </button>
            `)
            .join('');

        document.getElementById('voting-next-btn').classList.add('hidden');
        document.getElementById('voting-end-btn').classList.add('hidden');
        this.showScreen('voting-screen');
    }

    castVote(votedIndex) {
        this.votes[this.currentVoterIndex] = votedIndex;
        // Disable all vote buttons to prevent multiple votes from the same voter
        document.querySelectorAll('.vote-option').forEach(btn => btn.disabled = true);
        this.currentVoterIndex++;

        if (this.currentVoterIndex >= this.players.length) {
            document.getElementById('voting-end-btn').classList.remove('hidden');
        } else {
            document.getElementById('voting-next-btn').classList.remove('hidden');
        }
    }

    nextVoter() {
        this.showVotingScreen();
    }

    endVoting() {
        // Count votes
        const voteCounts = {};
        this.players.forEach((_, i) => { voteCounts[i] = 0; });
        Object.values(this.votes).forEach(votedIndex => { voteCounts[votedIndex]++; });

        // Find who got the most votes
        let maxVotes = 0;
        let eliminated = -1;
        Object.entries(voteCounts).forEach(([index, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                eliminated = parseInt(index);
            }
        });

        // Check if eliminated is impostor
        const eliminatedIsImpostor = this.impostors.includes(eliminated);

        if (eliminatedIsImpostor) {
            // Impostor caught, citizens win
            this.showResults(eliminated, true);
        } else {
            // Impostor not caught, proceed to guess phase
            // (There should be at least one impostor alive)
            this.showGuessScreen(eliminated);
        }
    }

    showGuessScreen(eliminatedIndex) {
        // eliminatedIndex is the citizen who was wrongly voted out (not used here except for info, but we can ignore)
        // Generate 4 options: secret word + 3 random from same category
        const wordList = categories[this.category];
        // Remove secret word from possible random picks
        const otherWords = wordList.filter(w => w !== this.word);
        // Shuffle otherWords and pick 3
        this.shuffleArray(otherWords);
        const options = [this.word, ...otherWords.slice(0, 3)];
        // Shuffle options so secret word isn't always first
        this.shuffleArray(options);

        // Store options for later
        this.guessOptions = options;

        const guessOptionsDiv = document.getElementById('guess-options');
        guessOptionsDiv.innerHTML = options.map(word => `
            <button class="guess-option" onclick="game.handleGuess('${word}')">${word}</button>
        `).join('');

        document.getElementById('guess-title').textContent = 'الجاسوس خمن الكلمة';
        this.showScreen('guess-screen');
    }

    handleGuess(selectedWord) {
        const correct = (selectedWord === this.word);
        this.showGuessOutcome(correct);
    }

    showGuessOutcome(impostorGuessedCorrectly) {
        const resultTitle = impostorGuessedCorrectly ? '🕵️ الجاسوس انتصر - Imposter Won!' : '🎉 يا هلا - Citizens Won!';
        let details = '';
        if (impostorGuessedCorrectly) {
            details = `الجاسوس خمن الكلمة بشكل صحيح! الكلمة كانت: ${this.word}`;
        } else {
            details = `الجاسوس أخطأ التخمين! الكلمة كانت: ${this.word}`;
        }
        document.getElementById('game-result-title').textContent = resultTitle;
        document.getElementById('results-details').innerHTML = `
            <p>${details}</p>
            <p>الجواسيس: ${this.impostors.map(i => this.players[i].name).join(', ')}</p>
        `;
        this.showScreen('results-screen');
    }

    showResults(eliminatedIndex, isCorrect) {
        const eliminated = this.players[eliminatedIndex];
        let resultTitle = '';
        let details = '';

        if (isCorrect) {
            resultTitle = '🎉 يا هلا - Citizens Won!';
            details = `تم اكتشاف الجاسوس: ${eliminated.name}`;
        } else {
            resultTitle = '🕵️ الجاسوس انتصر - Imposter Won!';
            details = `${eliminated.name} لم يكن الجاسوس`;
        }

        document.getElementById('game-result-title').textContent = resultTitle;
        document.getElementById('results-details').innerHTML = `
            <p>${details}</p>
            <p>الكلمة السرية كانت: ${this.word}</p>
            <p>الجواسيس: ${this.impostors.map(i => this.players[i].name).join(', ')}</p>
        `;
        this.showScreen('results-screen');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    restart() {
        // Keep players array, reset everything else
        this.currentPlayerIndex = 0;
        this.category = null;
        this.word = null;
        this.impostorCount = 1;
        this.impostors = [];
        this.votes = {};
        this.currentVoterIndex = 0;
        this.discussionRound = 1;
        this.revealOrder = [];
        this.guessOptions = [];

        // Update UI
        document.getElementById('player-name-input').value = '';
        document.getElementById('impostors-count').value = 1;
        this.renderPlayersList();  // re-render the existing players
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('names-done-btn').disabled = this.players.length < 2;

        this.showScreen('names-screen');
    }
}

// Initialize game when page loads
let game;
window.addEventListener('load', () => {
    game = new BakasaGame();
});