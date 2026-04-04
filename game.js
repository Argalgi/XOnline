// Game state
const gameState = {
    socket: null,
    playerName: null,
    roomId: null,
    players: [],
    currentPlayer: null,
    board: Array(9).fill(null),
    scores: { x: 0, o: 0 },
    gameActive: false,
    currentTurn: null,
    mySymbol: null
};

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const roomWaitingScreen = document.getElementById('roomWaitingScreen');
const gameScreen = document.getElementById('gameScreen');

const playerNameInput = document.getElementById('playerName');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinForm = document.getElementById('joinForm');
const roomCodeInput = document.getElementById('roomCode');
const joinConfirm = document.getElementById('joinConfirm');
const joinCancel = document.getElementById('joinCancel');

const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');
const boardCells = document.querySelectorAll('.cell');
const newGameBtn = document.getElementById('newGameBtn');
const resetScoresBtn = document.getElementById('resetScoresBtn');
const gameStatus = document.getElementById('gameStatus');
const turnIndicator = document.getElementById('turnIndicator');
const connectionIndicator = document.getElementById('connectionIndicator');
const errorDialog = document.getElementById('errorDialog');
const errorMessage = document.getElementById('errorMessage');
const errorOkBtn = document.getElementById('errorOkBtn');

// Initialize Socket.io connection
function initializeSocket() {
    gameState.socket = io();

    gameState.socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
    });

    gameState.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
        showError('התקשורת אבדה. אנא רענן את הדף');
    });

    gameState.socket.on('gameCreated', (data) => {
        gameState.roomId = data.roomId;
        shareLink.value = data.link;
        document.getElementById('roomCode').textContent = gameState.roomId;
        showScreen('roomWaiting');
    });

    gameState.socket.on('gameStarted', (data) => {
        gameState.players = data.players;
        gameState.currentTurn = data.currentTurn;
        gameState.scores = data.scores;
        gameState.board = data.board;
        gameState.gameActive = true;
        
        // Determine my symbol
        const myPlayer = data.players.find(p => p.id === gameState.socket.id);
        gameState.mySymbol = myPlayer.symbol;

        updatePlayerInfo();
        updateBoard();
        updateTurnIndicator();
        showScreen('game');
    });

    gameState.socket.on('movesMade', (data) => {
        gameState.board = data.board;
        gameState.currentTurn = data.currentTurn;
        gameState.gameActive = true;
        
        updateBoard();
        updateTurnIndicator();
        hideGameStatus();
    });

    gameState.socket.on('gameFinished', (data) => {
        gameState.board = data.board;
        gameState.scores = data.scores;
        gameState.gameActive = false;

        updateBoard();
        updatePlayerInfo();
        showGameStatus(`🎉 ${data.winner} ניצח!`, 'winner');
    });

    gameState.socket.on('gameDraw', (data) => {
        gameState.board = data.board;
        gameState.scores = data.scores;
        gameState.gameActive = false;

        updateBoard();
        updatePlayerInfo();
        showGameStatus('🤝 זה היה תיקו!', 'draw');
    });

    gameState.socket.on('gameReset', (data) => {
        gameState.board = data.board;
        gameState.currentTurn = data.currentTurn;
        gameState.gameActive = true;

        updateBoard();
        updateTurnIndicator();
        hideGameStatus();
    });

    gameState.socket.on('scoresReset', (data) => {
        gameState.scores = data.scores;
        gameState.board = data.board;
        gameState.currentTurn = data.currentTurn;
        gameState.gameActive = true;

        updatePlayerInfo();
        updateBoard();
        updateTurnIndicator();
        hideGameStatus();
    });

    gameState.socket.on('playerDisconnected', (data) => {
        gameState.gameActive = false;
        showError(data.message);
    });

    gameState.socket.on('error', (data) => {
        showError(data.message);
    });
}

// Event Listeners
createBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        showError('אנא הכנס את שמך');
        return;
    }
    gameState.playerName = name;
    gameState.socket.emit('createGame', name);
});

joinBtn.addEventListener('click', () => {
    joinForm.classList.toggle('hidden');
});

joinCancel.addEventListener('click', () => {
    joinForm.classList.add('hidden');
});

joinConfirm.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const roomId = roomCodeInput.value.trim();

    if (!name) {
        showError('אנא הכנס את שמך');
        return;
    }

    if (!roomId) {
        showError('אנא הכנס קוד משחק');
        return;
    }

    gameState.playerName = name;
    gameState.socket.emit('joinGame', {
        roomId: roomId,
        playerName: name
    });
    joinForm.classList.add('hidden');
});

copyBtn.addEventListener('click', () => {
    shareLink.select();
    document.execCommand('copy');
    copyBtn.textContent = '✅ הועתק!';
    setTimeout(() => {
        copyBtn.textContent = '📋 העתק';
    }, 2000);
});

boardCells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (!gameState.gameActive) {
            showError('המשחק לא פעיל');
            return;
        }

        if (gameState.currentTurn !== gameState.socket.id) {
            showError('זה לא התור שלך');
            return;
        }

        const index = parseInt(cell.dataset.index);
        
        if (gameState.board[index] !== null) {
            showError('תא זה תפוס');
            return;
        }

        gameState.socket.emit('makeMove', { index: index });
    });
});

newGameBtn.addEventListener('click', () => {
    gameState.socket.emit('resetGame');
});

resetScoresBtn.addEventListener('click', () => {
    if (confirm('האם אתה בטוח שברצונך לאפס את הניקוד?')) {
        gameState.socket.emit('resetScores');
    }
});

errorOkBtn.addEventListener('click', () => {
    errorDialog.classList.remove('show');
});

// Update functions
function updatePlayerInfo() {
    const player1 = gameState.players[0];
    const player2 = gameState.players[1];

    if (player1) {
        document.querySelector('#player1 .player-name').textContent = player1.name;
        document.querySelector('#player1 .player-symbol').textContent = player1.symbol;
        document.querySelector('#player1 .player-score').textContent = gameState.scores[player1.symbol.toLowerCase()];
    }

    if (player2) {
        document.querySelector('#player2 .player-name').textContent = player2.name;
        document.querySelector('#player2 .player-symbol').textContent = player2.symbol;
        document.querySelector('#player2 .player-score').textContent = gameState.scores[player2.symbol.toLowerCase()];
    }
}

function updateBoard() {
    boardCells.forEach((cell, index) => {
        const value = gameState.board[index];
        cell.textContent = value || '';
        cell.classList.remove('x', 'o', 'disabled');
        
        if (value === 'X') {
            cell.classList.add('x');
        } else if (value === 'O') {
            cell.classList.add('o');
        }

        if (!gameState.gameActive || gameState.currentTurn !== gameState.socket.id) {
            cell.classList.add('disabled');
        }
    });
}

function updateTurnIndicator() {
    const currentPlayerName = gameState.players.find(p => p.id === gameState.currentTurn)?.name || 'שחקן';
    const isMyTurn = gameState.currentTurn === gameState.socket.id;
    
    if (isMyTurn) {
        turnIndicator.textContent = `📍 התור שלך`;
        turnIndicator.style.color = '#4CAF50';
    } else {
        turnIndicator.textContent = `⏳ התור של ${currentPlayerName}`;
        turnIndicator.style.color = '#666';
    }
}

function showGameStatus(message, type) {
    gameStatus.textContent = message;
    gameStatus.className = `game-status show ${type}`;
}

function hideGameStatus() {
    gameStatus.classList.remove('show');
}

function showScreen(screenName) {
    welcomeScreen.classList.remove('active');
    roomWaitingScreen.classList.remove('active');
    gameScreen.classList.remove('active');

    if (screenName === 'welcome') {
        welcomeScreen.classList.add('active');
    } else if (screenName === 'roomWaiting') {
        roomWaitingScreen.classList.add('active');
    } else if (screenName === 'game') {
        gameScreen.classList.add('active');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorDialog.classList.add('show');
}

function updateConnectionStatus(connected) {
    if (connected) {
        connectionIndicator.classList.remove('disconnected');
        connectionIndicator.parentElement.textContent = '● מחובר';
    } else {
        connectionIndicator.classList.add('disconnected');
        connectionIndicator.parentElement.textContent = '● מנותק';
    }
}

// Check for room code in URL
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');

    if (roomId) {
        roomCodeInput.value = roomId;
        joinForm.classList.remove('hidden');
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    initializeSocket();
    checkUrlParams();
    showScreen('welcome');
});
