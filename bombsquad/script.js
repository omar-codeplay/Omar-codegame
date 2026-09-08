class BombSquad {
    constructor() {
        this.grid = document.getElementById('grid');
        this.scoreEl = document.getElementById('score');
        this.bestScoreEl = document.getElementById('best-score');
        this.levelEl = document.getElementById('level');
        this.messageEl = document.getElementById('message');
        this.startBtn = document.getElementById('start-btn');
        this.resetBtn = document.getElementById('reset-btn');

        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bombSquadBestScore')) || 0;
        this.level = 1;
        this.gridSize = 3;
        this.numBombs = 1;
        this.bombLocations = [];
        this.revealedTiles = 0;
        this.gameActive = false;

        this.bestScoreEl.textContent = this.bestScore;

        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());

        this.initGrid();
    }

    initGrid() {
        this.grid.innerHTML = '';
        const totalTiles = this.gridSize * this.gridSize;

        for (let i = 0; i < totalTiles; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.index = i;
            tile.addEventListener('click', () => this.handleTileClick(i));
            this.grid.appendChild(tile);
        }
    }

    placeBombs() {
        this.bombLocations = [];
        const totalTiles = this.gridSize * this.gridSize;
        
        while (this.bombLocations.length < this.numBombs) {
            const randomIndex = Math.floor(Math.random() * totalTiles);
            if (!this.bombLocations.includes(randomIndex)) {
                this.bombLocations.push(randomIndex);
            }
        }
    }

    startGame() {
        this.score = 0;
        this.level = 1;
        this.gridSize = 3;
        this.numBombs = 1;
        this.updateStats();
        this.startLevel();
        this.startBtn.disabled = true;
        this.startBtn.style.opacity = '0.5';
    }

    startLevel() {
        this.gameActive = true;
        this.revealedTiles = 0;
        this.placeBombs();
        this.initGrid();
        this.setMessage(`Level ${this.level}: Find ${this.gridSize * this.gridSize - this.numBombs} safe tiles!`, '');
        this.enableTiles();
    }

    handleTileClick(index) {
        if (!this.gameActive) return;

        const tile = this.grid.children[index];
        if (tile.classList.contains('revealed') || tile.classList.contains('disabled')) return;

        tile.classList.add('revealed');

        if (this.bombLocations.includes(index)) {
            // Hit a bomb!
            tile.classList.add('bomb');
            tile.textContent = '💣';
            this.gameOver();
        } else {
            // Safe tile
            tile.classList.add('safe');
            tile.textContent = '✅';
            this.revealedTiles++;
            this.score += 10 * this.level;
            this.updateStats();

            const totalSafeTiles = this.gridSize * this.gridSize - this.numBombs;
            
            if (this.revealedTiles >= totalSafeTiles) {
                // Level complete!
                this.levelComplete();
            }
        }
    }

    levelComplete() {
        this.gameActive = false;
        this.level++;
        
        // Increase difficulty
        if (this.level % 2 === 0) {
            this.gridSize = Math.min(this.gridSize + 1, 6);
        }
        if (this.level % 3 === 0) {
            this.numBombs++;
        }

        this.setMessage(`🎉 Level ${this.level - 1} Complete! Starting Level ${this.level}...`, 'success');
        
        setTimeout(() => {
            this.startLevel();
        }, 1500);
    }

    gameOver() {
        this.gameActive = false;
        
        // Update best score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bombSquadBestScore', this.bestScore);
            this.bestScoreEl.textContent = this.bestScore;
        }

        // Reveal all bombs
        this.bombLocations.forEach(index => {
            const tile = this.grid.children[index];
            if (!tile.classList.contains('revealed')) {
                tile.classList.add('revealed', 'bomb');
                tile.textContent = '💣';
            }
        });

        // Disable all tiles
        this.disableTiles();

        this.setMessage(`💥 Game Over! You hit a bomb! Final Score: ${this.score}`, 'danger');
        
        this.startBtn.disabled = false;
        this.startBtn.style.opacity = '1';
    }

    resetGame() {
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bombSquadBestScore')) || 0;
        this.level = 1;
        this.gridSize = 3;
        this.numBombs = 1;
        this.gameActive = false;
        this.revealedTiles = 0;
        
        this.bestScoreEl.textContent = this.bestScore;
        this.updateStats();
        this.initGrid();
        this.setMessage('Click Start Game to begin!', '');
        
        this.startBtn.disabled = false;
        this.startBtn.style.opacity = '1';
        this.disableTiles();
    }

    setMessage(text, type) {
        this.messageEl.textContent = text;
        this.messageEl.className = 'message-area';
        if (type) {
            this.messageEl.classList.add(type);
        }
    }

    updateStats() {
        this.scoreEl.textContent = this.score;
        this.levelEl.textContent = this.level;
    }

    enableTiles() {
        Array.from(this.grid.children).forEach(tile => {
            tile.classList.remove('disabled');
        });
    }

    disableTiles() {
        Array.from(this.grid.children).forEach(tile => {
            tile.classList.add('disabled');
        });
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BombSquad();
});
