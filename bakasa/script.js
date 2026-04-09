// بكاسه - The Spy Game (Egyptian Edition)
// Spy guesses the word from 4 options · Leaderboard by points only

(function(){
    // ---------- Egyptian Categories ----------
    const categories = {
        food: [
            'الكشري', 'الفول المدامس', 'الطعمية', 'الشاورما', 'الكفتة',
            'الدجاج المشوي', 'اللحم المشوي', 'السمك المشوي', 'الأرز', 'العيش البلدي',
            'الجبنة', 'الحليب', 'الزبادي', 'البيض', 'زيت الزيتون', 'التمر',
            'المانجو', 'البرتقال', 'الموز', 'التفاح', 'البطيخ', 'الفراولة', 'العنب', 'الجوافة',
            'الطماطم', 'الخيار', 'الباذنجان', 'البصل', 'الثوم', 'البطاطس', 'العدس',
            'الجمبري', 'السمك', 'الكبدة', 'لحم بقري', 'لحم ضاني', 'السكر', 'العسل',
            'النعناع', 'القرفة', 'الفلفل', 'الملح', 'المكرونة', 'الديك الرومي',
            'السلطة', 'الشوربة', 'الكنافة', 'البقلاوة', 'جوز الهند', 'السمسم',
            'اللوز', 'الفستق', 'الفول السوداني', 'الزبيب', 'الجبنة البيضاء',
            'الجبنة الرومي', 'الخل', 'الصلصة', 'الدقيق'
        ],
        animals: [
            'الأسد', 'الحمار', 'الحصان', 'الجمل', 'الخروف', 'الماعز', 'القطة', 'الكلب',
            'الفأر', 'البقرة', 'الثور', 'البغل', 'الأرنب', 'الثعلب', 'الضبع', 'الذئب',
            'الفهد', 'الغزال', 'القنفذ', 'الثعبان', 'الأفعى', 'التمساح', 'السحلية',
            'الورل', 'الضفدع', 'السلحفاة', 'الصقر', 'النسر', 'الحمام', 'البط', 'الإوزة',
            'العصفور', 'السنونو', 'الطاووس', 'الديك', 'الدجاج', 'الحبش', 'البوم', 'الببغاء',
            'القرش', 'الدلفين', 'الحوت', 'الأخطبوط', 'الحبار', 'كبوريه', 'جمبري',
            'العقرب', 'الجراد', 'النحلة', 'الفراشة', 'الخنفساء', 'النمل', 'الصرصار', 'العنكبوت'
        ],
        players: [
            'ميسي', 'كريستيانو رونالدو', 'بيليه', 'مارادونا', 'زيدان', 'رونالدينيو',
            'رونالدو البرازيلي', 'كرويف', 'بيكنباور', 'بلاتيني', 'مبابي', 'هالاند',
            'دي بروين', 'محمد صلاح', 'نيمار', 'هاري كين', 'بنزيما', 'ليفاندوفسكي',
            'فينيسيوس', 'بيلينجهام', 'إنييستا', 'تشافي', 'سيرجيو راموس', 'مودريتش',
            'كروس', 'سواريز', 'إبراهيموفيتش', 'بوفون', 'كاسياس', 'فان دايك', 'ريبيري',
            'كانتي', 'دي ماريا', 'أجويرو', 'كاكا', 'بيكهام', 'جيرارد', 'مالديني', 'بيرلو'
        ]
    };

    // ---------- Helper Functions ----------
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    function getRandomInt(min, max) {
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            return min + (arr[0] % (max - min + 1));
        }
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    function getRandomItem(arr) {
        return arr[getRandomInt(0, arr.length - 1)];
    }

    // ---------- Main Game Class ----------
    class BakasaGame {
        constructor() {
            this.players = [];
            this.impostorIndices = [];
            this.secretWord = '';
            this.category = null;
            this.impostorCount = 1;

            this.revealOrder = [];
            this.currentRevealIdx = 0;
            this.votes = {};
            this.currentVoterIdx = 0;
            this.eliminatedIdx = null;

            this.currentImpostorGuessIdx = 0;
            this.guessOptions = [];

            this.points = {};

            this.bindEvents();
        }

        addPoint(playerName) {
            if (!this.points[playerName]) this.points[playerName] = 0;
            this.points[playerName]++;
        }

        getLeaderboardHTML() {
            const board = this.players.map(p => ({
                name: p.name,
                points: this.points[p.name] || 0
            }));
            board.sort((a,b) => b.points - a.points);
            let html = '<table class="leaderboard-table" style="width:100%; border-collapse:collapse;">';
            html += '<thead><tr><th>#</th><th>اللاعب</th><th>⭐ النقاط</th></tr></thead><tbody>';
            board.forEach((item, idx) => {
                html += `<tr>
                    <td style="padding:8px; text-align:center;">${idx+1}</td>
                    <td style="padding:8px; text-align:center;">${item.name}</td>
                    <td style="padding:8px; text-align:center; font-weight:bold; color:#b45f1b;">${item.points}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            return html;
        }

        showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(screenId).classList.add('active');
        }

        bindEvents() {
            document.getElementById('add-player-btn').addEventListener('click', () => this.addPlayer());
            document.getElementById('player-name-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addPlayer();
            });
            document.getElementById('names-done-btn').addEventListener('click', () => this.goToSetup());

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

            document.getElementById('card-reveal-btn').addEventListener('click', () => this.revealCard());
            document.getElementById('card-next-btn').addEventListener('click', () => this.nextCardPlayer());
            document.getElementById('card-display').addEventListener('click', () => {
                const btn = document.getElementById('card-reveal-btn');
                if (btn && !btn.classList.contains('hidden')) this.revealCard();
            });

            document.getElementById('ready-to-vote-btn').addEventListener('click', () => this.goToVoting());
            document.getElementById('voting-next-btn').addEventListener('click', () => this.nextVoter());
            document.getElementById('voting-end-btn').addEventListener('click', () => this.endVoting());

            document.getElementById('guess-options').addEventListener('click', (e) => {
                if (e.target.classList.contains('guess-option')) {
                    this.handleGuess(e.target.getAttribute('data-word'));
                }
            });

            document.getElementById('new-round-btn').addEventListener('click', () => this.newRound());
            document.getElementById('play-again-btn').addEventListener('click', () => this.restart());
        }

        addPlayer() {
            const input = document.getElementById('player-name-input');
            const name = input.value.trim();
            if (!name) return;
            if (this.players.some(p => p.name === name)) return;
            this.players.push({ name, role: null });
            input.value = '';
            this.renderPlayersList();
            document.getElementById('names-done-btn').disabled = this.players.length < 2;
        }

        removePlayer(index) {
            this.players.splice(index, 1);
            this.renderPlayersList();
            document.getElementById('names-done-btn').disabled = this.players.length < 2;
        }

        renderPlayersList() {
            const container = document.getElementById('players-list');
            container.innerHTML = this.players.map((p, i) => `
                <div class="player-tag">
                    <span>${p.name}</span>
                    <button class="btn-remove" onclick="game.removePlayer(${i})">×</button>
                </div>
            `).join('');
        }

        goToSetup() {
            if (this.players.length < 2) return;
            this.showScreen('setup-screen');
        }

        changeImpostors(delta) {
            let val = parseInt(document.getElementById('impostors-count').value) + delta;
            if (val < 1) val = 1;
            if (val > this.players.length) val = this.players.length;
            document.getElementById('impostors-count').value = val;
            this.impostorCount = val;
        }

        startGame() {
            if (!this.category) return;
            this.secretWord = getRandomItem(categories[this.category]);

            this.impostorIndices = [];
            const set = new Set();
            while (set.size < this.impostorCount) {
                set.add(getRandomInt(0, this.players.length - 1));
            }
            this.impostorIndices = Array.from(set);
            this.players.forEach((p, i) => {
                p.role = this.impostorIndices.includes(i) ? 'impostor' : 'citizen';
            });

            this.revealOrder = this.players.map((_, i) => i);
            shuffleArray(this.revealOrder);
            this.currentRevealIdx = 0;

            this.votes = {};
            this.currentVoterIdx = 0;
            this.currentImpostorGuessIdx = 0;
            this.eliminatedIdx = null;

            this.showCardRevealScreen();
        }

        showCardRevealScreen() {
            const idx = this.revealOrder[this.currentRevealIdx];
            const player = this.players[idx];
            document.getElementById('player-turn-text').innerText = player.name;
            document.getElementById('card-reveal-btn').classList.remove('hidden');
            document.getElementById('card-next-btn').classList.add('hidden');
            document.getElementById('card-inner').style.transform = 'rotateY(0deg)';
            this.showScreen('card-reveal-screen');
        }

        revealCard() {
            const idx = this.revealOrder[this.currentRevealIdx];
            const player = this.players[idx];
            const roleDiv = document.getElementById('role-display');
            const wordDiv = document.getElementById('word-display');
            if (player.role === 'impostor') {
                roleDiv.innerHTML = '<h3>🕵️ أنت جاسوس!</h3>';
                wordDiv.innerHTML = '<p style="font-size:1.3rem;">???</p>';
            } else {
                roleDiv.innerHTML = '<h3>👨 مواطن</h3>';
                wordDiv.innerHTML = '<p style="font-size:1.8rem; font-weight:bold;">' + this.secretWord + '</p>';
            }
            document.getElementById('card-inner').style.transform = 'rotateY(180deg)';
            document.getElementById('card-reveal-btn').classList.add('hidden');
            document.getElementById('card-next-btn').classList.remove('hidden');
        }

        nextCardPlayer() {
            this.currentRevealIdx++;
            if (this.currentRevealIdx < this.revealOrder.length) {
                this.showCardRevealScreen();
            } else {
                this.startDiscussion();
            }
        }

        startDiscussion() {
            document.getElementById('round-text').innerHTML = '🗣️ جولة النقاش - تحدثوا واكتشفوا الجاسوس';
            this.showScreen('discussion-screen');
        }

        goToVoting() {
            this.currentVoterIdx = 0;
            this.votes = {};
            this.showVotingScreen();
        }

        showVotingScreen() {
            if (this.currentVoterIdx >= this.players.length) {
                this.endVoting();
                return;
            }
            const voter = this.players[this.currentVoterIdx];
            document.getElementById('current-voter-text').innerHTML = voter.name + ' : من تريد إقصاءه؟';
            const container = document.getElementById('voting-options');
            container.innerHTML = this.players.map((p, i) => {
                if (i !== this.currentVoterIdx) {
                    return '<button class="vote-option" onclick="game.castVote(' + i + ')">' + p.name + '</button>';
                }
                return '';
            }).join('');
            document.getElementById('voting-next-btn').classList.add('hidden');
            document.getElementById('voting-end-btn').classList.add('hidden');
            this.showScreen('voting-screen');
        }

        castVote(votedIdx) {
            this.votes[this.currentVoterIdx] = votedIdx;
            document.querySelectorAll('.vote-option').forEach(btn => btn.disabled = true);
            this.currentVoterIdx++;
            if (this.currentVoterIdx >= this.players.length) {
                document.getElementById('voting-end-btn').classList.remove('hidden');
            } else {
                document.getElementById('voting-next-btn').classList.remove('hidden');
            }
        }

        nextVoter() {
            this.showVotingScreen();
        }

        endVoting() {
            if (Object.keys(this.votes).length < this.players.length) return;
            const voteCount = new Array(this.players.length).fill(0);
            Object.values(this.votes).forEach(v => voteCount[v]++);
            let max = -1, eliminated = -1, ties = [];
            for (let i = 0; i < voteCount.length; i++) {
                if (voteCount[i] > max) {
                    max = voteCount[i];
                    eliminated = i;
                    ties = [i];
                } else if (voteCount[i] === max) {
                    ties.push(i);
                }
            }
            if (ties.length > 1) {
                eliminated = ties[Math.floor(Math.random() * ties.length)];
            }
            this.eliminatedIdx = eliminated;

            // Start spy guessing phase
            this.currentImpostorGuessIdx = 0;
            this.showImpostorGuessScreen();
        }

        showImpostorGuessScreen() {
            const remainingImpostors = this.impostorIndices.filter(idx => idx !== this.eliminatedIdx);
            if (this.currentImpostorGuessIdx >= remainingImpostors.length) {
                this.showFinalResults();
                return;
            }
            const impostorIdx = remainingImpostors[this.currentImpostorGuessIdx];
            const impostorName = this.players[impostorIdx].name;

            const wordList = categories[this.category];
            const otherWords = wordList.filter(w => w !== this.secretWord);
            shuffleArray(otherWords);
            const options = [this.secretWord, ...otherWords.slice(0, 3)];
            shuffleArray(options);
            this.guessOptions = options;

            document.getElementById('guess-title').innerHTML = impostorName + ' - خمّن الكلمة';
            const container = document.getElementById('guess-options');
            container.innerHTML = options.map(word => '<button class="guess-option" data-word="' + word + '">' + word + '</button>').join('');
            container.style.display = 'flex';
            container.style.flexWrap = 'wrap';
            container.style.gap = '10px';
            container.style.justifyContent = 'center';

            this.showScreen('guess-screen');
        }

        handleGuess(selectedWord) {
            const remainingImpostors = this.impostorIndices.filter(idx => idx !== this.eliminatedIdx);
            const currentImpostorIdx = remainingImpostors[this.currentImpostorGuessIdx];
            const impostorName = this.players[currentImpostorIdx].name;

            if (selectedWord === this.secretWord) {
                this.addPoint(impostorName);
            }
            this.currentImpostorGuessIdx++;
            this.showImpostorGuessScreen();
        }

        showFinalResults() {
            // Removed the eliminated line as requested
            let html = '<p>🔑 الكلمة السرية: <strong style="font-size:1.4rem;">' + this.secretWord + '</strong></p>';
            html += '<p>🕵️ الجواسيس: ' + this.impostorIndices.map(i => this.players[i].name).join(', ') + '</p>';
            html += '<hr><h3>🏆 جدول النقاط</h3>';
            html += this.getLeaderboardHTML();
            document.getElementById('game-result-title').innerHTML = '🎭 نهاية الجولة';
            document.getElementById('results-details').innerHTML = html;
            this.showScreen('results-screen');
        }

        newRound() {
            this.category = null;
            this.secretWord = '';
            this.impostorIndices = [];
            this.revealOrder = [];
            this.currentRevealIdx = 0;
            this.votes = {};
            this.currentVoterIdx = 0;
            this.currentImpostorGuessIdx = 0;
            this.eliminatedIdx = null;
            this.players.forEach(p => p.role = null);
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('impostors-count').value = 1;
            this.impostorCount = 1;
            this.showScreen('setup-screen');
        }

        restart() {
            this.players = [];
            this.points = {};
            this.impostorIndices = [];
            this.secretWord = '';
            this.category = null;
            this.currentRevealIdx = 0;
            this.votes = {};
            this.currentVoterIdx = 0;
            this.currentImpostorGuessIdx = 0;
            this.eliminatedIdx = null;
            document.getElementById('player-name-input').value = '';
            this.renderPlayersList();
            document.getElementById('names-done-btn').disabled = true;
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('impostors-count').value = 1;
            this.impostorCount = 1;
            this.showScreen('names-screen');
        }
    }

    window.game = new BakasaGame();
})();