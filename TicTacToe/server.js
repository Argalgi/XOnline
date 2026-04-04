import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Game rooms storage
const rooms = {};
const playerSessions = {};

// Generate unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Player creates a new game
  socket.on('createGame', (playerName) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      id: roomId,
      players: [
        { id: socket.id, name: playerName, symbol: null }
      ],
      board: Array(9).fill(null),
      currentTurn: null,
      gameState: 'waiting', // waiting, active, finished
      scores: { x: 0, o: 0 },
      lastWinner: null
    };
    
    playerSessions[socket.id] = {
      roomId: roomId,
      playerIndex: 0
    };

    socket.join(roomId);
    console.log('Game created:', roomId);
    
    socket.emit('gameCreated', {
      roomId: roomId,
      link: `${process.env.BASE_URL || 'http://localhost:3000'}?room=${roomId}`
    });
  });

  // Player joins a game
  socket.on('joinGame', (data) => {
    const { roomId, playerName } = data;
    
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const room = rooms[roomId];
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    // Assign symbols randomly
    const symbols = ['X', 'O'];
    symbols.sort(() => Math.random() - 0.5);
    
    room.players[0].symbol = symbols[0];
    const newPlayer = { id: socket.id, name: playerName, symbol: symbols[1] };
    room.players.push(newPlayer);
    
    playerSessions[socket.id] = {
      roomId: roomId,
      playerIndex: 1
    };

    // Start the game
    room.gameState = 'active';
    room.currentTurn = room.players[0].id; // First player starts

    socket.join(roomId);
    
    // Send game state to both players
    io.to(roomId).emit('gameStarted', {
      players: room.players.map(p => ({ 
        id: p.id, 
        name: p.name, 
        symbol: p.symbol 
      })),
      currentTurn: room.currentTurn,
      board: room.board,
      scores: room.scores
    });

    console.log('Player joined:', roomId, playerName);
  });

  // Handle game move
  socket.on('makeMove', (data) => {
    const { index } = data;
    const session = playerSessions[socket.id];
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    const room = rooms[session.roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.currentTurn !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (room.board[index] !== null) {
      socket.emit('error', { message: 'Cell already occupied' });
      return;
    }

    // Make the move
    const player = room.players.find(p => p.id === socket.id);
    room.board[index] = player.symbol;

    // Check for winner
    const winner = checkWinner(room.board);
    
    if (winner) {
      room.gameState = 'finished';
      room.lastWinner = winner;
      room.scores[winner.toLowerCase()]++;
      
      io.to(session.roomId).emit('gameFinished', {
        board: room.board,
        winner: winner,
        scores: room.scores
      });
    } else if (room.board.every(cell => cell !== null)) {
      // Draw
      room.gameState = 'finished';
      
      io.to(session.roomId).emit('gameDraw', {
        board: room.board,
        scores: room.scores
      });
    } else {
      // Switch turn
      const otherPlayerIndex = room.players[0].id === socket.id ? 1 : 0;
      room.currentTurn = room.players[otherPlayerIndex].id;
      
      io.to(session.roomId).emit('movesMade', {
        board: room.board,
        currentTurn: room.currentTurn
      });
    }
  });

  // Reset game
  socket.on('resetGame', () => {
    const session = playerSessions[socket.id];
    
    if (!session) return;

    const room = rooms[session.roomId];
    
    if (!room) return;

    room.board = Array(9).fill(null);
    room.gameState = 'active';
    room.currentTurn = room.players[0].id;
    room.lastWinner = null;

    io.to(session.roomId).emit('gameReset', {
      board: room.board,
      currentTurn: room.currentTurn,
      scores: room.scores
    });
  });

  // Reset scores
  socket.on('resetScores', () => {
    const session = playerSessions[socket.id];
    
    if (!session) return;

    const room = rooms[session.roomId];
    
    if (!room) return;

    room.scores = { x: 0, o: 0 };
    room.board = Array(9).fill(null);
    room.gameState = 'active';
    room.currentTurn = room.players[0].id;

    io.to(session.roomId).emit('scoresReset', {
      scores: room.scores,
      board: room.board,
      currentTurn: room.currentTurn
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const session = playerSessions[socket.id];
    
    if (session) {
      const room = rooms[session.roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          delete rooms[session.roomId];
        } else {
          io.to(session.roomId).emit('playerDisconnected', {
            message: 'מתחייב עזב את המשחק'
          });
        }
      }
    }
    
    delete playerSessions[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
