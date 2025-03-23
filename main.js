import './style.css';

let playerName = '';
let apiKey = '';
let currentPlayer = 'X';
let gameBoard = Array(9).fill('');
let gameActive = false;
let playerScore = 0;
let aiScore = 0;
let waitingForChat = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const loginForm = document.getElementById('login-form');
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const playerInfo = document.getElementById('player-info');
const statusDisplay = document.getElementById('status');
const restartButton = document.getElementById('restart-button');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageButton = document.getElementById('send-message');

// Winning combinations
const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6] // Diagonals
];

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  playerName = document.getElementById('player-name').value;
  apiKey = document.getElementById('api-key').value;
  
  try {
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    document.querySelector('.player-name').textContent = playerName;
    startGame();
  } catch (error) {
    alert('Error initializing game. Please check your API key.');
    console.error('Error:', error);
  }
});

// Start new game
function startGame() {
  gameBoard = Array(9).fill('');
  currentPlayer = 'X';
  gameActive = true;
  waitingForChat = false;
  cells.forEach(cell => {
    cell.textContent = '';
    cell.classList.remove('x', 'o');
  });
  updateStatus();
  restartButton.classList.add('hidden');
  enableChat(false);
}

// Update game status display
function updateStatus() {
  playerInfo.textContent = `${playerName} (X) vs A.I. (O)`;
  statusDisplay.textContent = currentPlayer === 'X' ? 
    (waitingForChat ? 'Please respond to the A.I. message first!' : 'Your turn') : 
    'A.I. thinking...';
}

// Check for winner
function checkWinner() {
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
      return gameBoard[a];
    }
  }
  return gameBoard.includes('') ? null : 'Draw';
}

// Handle cell click
async function handleCellClick(index) {
  if (!gameActive || gameBoard[index] !== '' || currentPlayer !== 'X' || waitingForChat) return;

  makeMove(index);
  
  const result = checkWinner();
  if (result) {
    endGame(result);
    return;
  }

  currentPlayer = 'O';
  updateStatus();
  await makeAIMove();
}

// Make a move
function makeMove(index) {
  gameBoard[index] = currentPlayer;
  const cell = cells[index];
  cell.textContent = currentPlayer;
  cell.classList.add(currentPlayer.toLowerCase());
}

// Generate board state string for AI
function getBoardState() {
  let state = '';
  for (let i = 0; i < 9; i += 3) {
    state += gameBoard.slice(i, i + 3).map(cell => cell || ' ').join('|') + '\n';
    if (i < 6) state += '-+-+-\n';
  }
  return state;
}

// Get available moves
function getAvailableMoves() {
  return gameBoard.reduce((moves, cell, index) => {
    if (cell === '') moves.push(index);
    return moves;
  }, []);
}

// Add chat message
function addChatMessage(message, isAI = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isAI ? 'ai' : 'player'}`;
  messageDiv.textContent = isAI ? 'A.I.: ' + message : playerName + ': ' + message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enable/disable chat
function enableChat(enabled) {
  chatInput.disabled = !enabled;
  sendMessageButton.disabled = !enabled;
  if (enabled) {
    chatInput.focus();
  }
}

// Handle chat response
function handleChatResponse() {
  const message = chatInput.value;
  addChatMessage(message || '...');
  chatInput.value = '';
  waitingForChat = false;
  enableChat(false);
  updateStatus();
}

// Make AI move using REST API
async function makeAIMove(invalidMove = null) {
  try {
    const availableMoves = getAvailableMoves();
    const invalidMoveMessage = invalidMove !== null ? 
      `Your previous move (${invalidMove}) was invalid or that position is already taken. Available positions are: ${availableMoves.join(', ')}. ` : 
      '';

    // First, get a joke from the AI
    const jokePrompt = `
You are playing Tic-tac-toe against ${playerName}. Make a playful, friendly joke or teasing comment about the game or your opponent's last move.
Keep it light and fun, no more than one or two sentences. Don't be mean or offensive.
Current board state:
${getBoardState()}
`;

    const jokeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: jokePrompt
          }]
        }]
      })
    });

    if (!jokeResponse.ok) {
      throw new Error(`API request failed: ${jokeResponse.status}`);
    }

    const jokeData = await jokeResponse.json();
    if (!jokeData.candidates || !jokeData.candidates[0] || !jokeData.candidates[0].content || !jokeData.candidates[0].content.parts || !jokeData.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from API');
    }

    const joke = jokeData.candidates[0].content.parts[0].text;
    addChatMessage(joke, true);
    waitingForChat = true;
    enableChat(true);
    updateStatus();

    // Wait for player's response
    return new Promise((resolve) => {
      const chatHandler = () => {
        sendMessageButton.removeEventListener('click', chatHandler);
        chatInput.removeEventListener('keypress', enterHandler);
        resolve();
      };

      const enterHandler = (e) => {
        if (e.key === 'Enter') {
          chatHandler();
        }
      };

      sendMessageButton.addEventListener('click', chatHandler);
      chatInput.addEventListener('keypress', enterHandler);
    }).then(async () => {
      // Now make the AI move
      const movePrompt = `
You are playing Tic-tac-toe. You are O, the opponent is X.
${invalidMoveMessage}
Current board state:
${getBoardState()}
Provide ONLY the index number (0-8) for your next move, where indices are numbered left to right, top to bottom.
Choose the best strategic move to either win or prevent the opponent from winning.
You must choose from these available positions: ${availableMoves.join(', ')}.
`;

      const moveResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: movePrompt
            }]
          }]
        })
      });

      if (!moveResponse.ok) {
        throw new Error(`API request failed: ${moveResponse.status}`);
      }

      const moveData = await moveResponse.json();
      if (!moveData.candidates || !moveData.candidates[0] || !moveData.candidates[0].content || !moveData.candidates[0].content.parts || !moveData.candidates[0].content.parts[0]) {
        throw new Error('Invalid response format from API');
      }

      const moveText = moveData.candidates[0].content.parts[0].text;
      const move = parseInt(moveText.trim());

      if (isNaN(move) || move < 0 || move > 8 || gameBoard[move] !== '') {
        if (invalidMove === null) {
          return await makeAIMove(move);
        } else {
          throw new Error('AI made invalid moves repeatedly');
        }
      }

      makeMove(move);
      
      const gameResult = checkWinner();
      if (gameResult) {
        endGame(gameResult);
        return;
      }

      currentPlayer = 'X';
      updateStatus();
    });
  } catch (error) {
    console.error('AI Error:', error);
    statusDisplay.textContent = 'AI error occurred. Please try again.';
    gameActive = false;
    restartButton.classList.remove('hidden');
  }
}

// End game
function endGame(result) {
  gameActive = false;
  if (result === 'Draw') {
    statusDisplay.textContent = "It's a draw!";
  } else {
    if (result === 'X') {
      playerScore++;
      document.querySelector('.player-score').textContent = playerScore;
    } else {
      aiScore++;
      document.querySelector('.ai-score').textContent = aiScore;
    }
    statusDisplay.textContent = result === 'X' ? 'You won!' : 'AI won!';
  }
  restartButton.classList.remove('hidden');
}

// Event listeners
cells.forEach((cell, index) => {
  cell.addEventListener('click', () => handleCellClick(index));
});

restartButton.addEventListener('click', startGame);

sendMessageButton.addEventListener('click', handleChatResponse);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleChatResponse();
  }
});