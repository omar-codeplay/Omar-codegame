const colors = ["green", "red", "yellow", "blue"];
let gamePattern = [];
let userPattern = [];
let level = 0;
let clickCount = 0;
let gameStarted = false;
let missedColor = null; // track color when user makes a mistake
let highScore = parseInt(localStorage.getItem('coloriq_highscore') || '0');

function updateHighScoreDisplay() {
  const el = document.getElementById('highScore');
  if (el) el.textContent = `Best: Level ${highScore}`;
}

// audio context for richer tones
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const frequencies = {
  green: 329.63, // E note
  red: 261.63,   // C note
  yellow: 392.0, // G note
  blue: 493.88   // B note
};

function playTone(freq, duration = 0.2, type = 'sine') {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  // quick attack/decay envelope
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration + 0.05);
}

function playSuccess() {
  // simple upward arpeggio
  const notes = [frequencies.green, frequencies.yellow, frequencies.blue];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.15, 'triangle'), i * 150);
  });
}

function playError() {
  playTone(150, 0.4, 'square');
}

function playClick(color) {
  playTone(frequencies[color], 0.1, 'sawtooth');
}

document.getElementById("start-btn").addEventListener("click", startGame);

function startGame() {
  if (!gameStarted) {
    gameStarted = true;
    level = 0;
    gamePattern = [];
    userPattern = [];
    clickCount = 0;
    document.getElementById("statusDisplay").textContent = `Level ${level}`;
    document.getElementById("click-count").textContent = clickCount;

    playTone(523.25, 0.2, 'triangle'); // start sound
    showMyTexts();
    updateHighScoreDisplay();
    nextSequence();
  }
}

function nextSequence() {
  userPattern = [];
  clickCount = 0;
  document.getElementById("click-count").textContent = clickCount;
  level++;
  document.getElementById("statusDisplay").textContent = `Level ${level}`;

  // Clear the sequence display at the start of each level
  document.getElementById("sequence-display").textContent = "-";

  // Generate a random color and push it to the gamePattern
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  gamePattern.push(randomColor);

  animateSequence();
}

function animateSequence() {
  let i = 0;
  const interval = setInterval(() => {
    flashButton(gamePattern[i]);
    i++;
    if (i === gamePattern.length) {
      clearInterval(interval);
      enableUserInput();
    }
  }, 600);
}

function flashButton(color) {
  const button = document.getElementById(color);
  button.classList.add("active");
  playClick(color);
  setTimeout(() => {
    button.classList.remove("active");
  }, 300);
}

function enableUserInput() {
  colors.forEach((color) => {
    document.getElementById(color).addEventListener("click", handleUserClick);
  });
}

function disableUserInput() {
  colors.forEach((color) => {
    document
      .getElementById(color)
      .removeEventListener("click", handleUserClick);
  });
}

function handleUserClick(event) {
  const clickedColor = event.target.id;
  userPattern.push(clickedColor);
  flashButton(clickedColor);
  clickCount++;
  document.getElementById("click-count").textContent = clickCount;

  // Update the current sequence display and set the text color to the box clicked
  const sequenceDisplay = document.getElementById("sequence-display");
  sequenceDisplay.innerHTML = ""; // Clear the previous content

  // Iterate through the userPattern and display each color with its own color
  userPattern.forEach((color) => {
    const span = document.createElement("span");
    span.style.color = color; // Set the color of the span to match the button color
    span.textContent = color.toUpperCase() + " "; // Convert the color name to uppercase
    sequenceDisplay.appendChild(span); // Append the span to the display
  });

  checkAnswer(userPattern.length - 1);
}

function checkAnswer(currentLevel) {
  if (userPattern[currentLevel] === gamePattern[currentLevel]) {
    if (userPattern.length === gamePattern.length) {
      disableUserInput();
      setTimeout(() => {
        // Show the congrats message when the level is passed
        showCongratsMessage();
        setTimeout(() => {
          hideCongratsMessage();
          setTimeout(() => {}, 1000); // Delay before starting the next level
          nextSequence();
        }, 2000); // Hide congrats message after 2 seconds
      }, 1000);
    }
  } else {
    if (level > highScore) {
      highScore = level;
      localStorage.setItem('coloriq_highscore', String(highScore));
      updateHighScoreDisplay();
    }
    document.getElementById("statusDisplay").textContent = `Game Over!`;
    missedColor = gamePattern[currentLevel];
    playError();
    // shake the container to emphasize mistake
    const container = document.getElementById('game-container');
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 400);
    setTimeout(() => {
      flashButton(missedColor);
    }, 1000);
    setTimeout(() => {
      hideMyTexts();
    }, 1000);

    showLoseMessage();
    setTimeout(() => {
      hideLoseMessage();
    }, 2000);

    // Disable further input
    gameStarted = false;

    // Reset the game state after a brief delay
    setTimeout(() => {
      level = 0;
      gamePattern = [];
      document.getElementById("sequence-display").textContent = "-";
      document.getElementById("click-count").textContent = 0;
    }, 1500);
  }
}

function showCongratsMessage() {
  const message = `Congrats! You passed level ${level}!`;
  const congratsMessageElement = document.getElementById("level-message");
  congratsMessageElement.textContent = message;
  congratsMessageElement.style.color = "green";
  congratsMessageElement.style.display = "block"; // Ensure it's displayed
  setTimeout(() => {
    congratsMessageElement.classList.add("show"); // Show the message with animation
  }, 50); // Small delay to trigger the animation
  playSuccess();
}

function hideCongratsMessage() {
  const congratsMessageElement = document.getElementById("level-message");
  congratsMessageElement.classList.remove("show"); // Remove animation class
  setTimeout(() => {
    congratsMessageElement.style.display = "none"; // Hide the message after animation
  }, 1000); // Delay hiding it after the fade-out effect
}

function showLoseMessage() {
  const message = `Game Over! Correct color was ${
    gamePattern[userPattern.length - 1]
  }.`;
  const loseMessageElement = document.getElementById("level-message");
  loseMessageElement.textContent = message;
  // set color to red
  loseMessageElement.style.color = "red";
  loseMessageElement.style.display = "block"; // Ensure it's displayed
  setTimeout(() => {
    loseMessageElement.classList.add("show"); // Show the message with animation
  }, 50); // Small delay to trigger the animation
  playError();
}

function hideLoseMessage() {
  const loseMessageElement = document.getElementById("level-message");
  loseMessageElement.classList.remove("show"); // Remove animation class
  setTimeout(() => {
    loseMessageElement.style.display = "none"; // Hide the message after animation
  }, 1000); // Delay hiding it after the fade-out effect
}

function showMyTexts() {
  const texts = document.getElementsByClassName("my-text");

  for (let i = 0; i < texts.length; i++) {
    texts[i].style.display = "block";
    texts[i].classList.add("show");
  }
}

function hideMyTexts() {
  const texts = document.getElementsByClassName("my-text");

  for (let i = 0; i < texts.length; i++) {
    texts[i].classList.remove("show");
    texts[i].style.display = "none";
  }
}
