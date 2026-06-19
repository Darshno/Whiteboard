import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:123@cluster0.gjbzayd.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schema
const boardSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  elements: { type: Array, default: [] }
});
const Board = mongoose.model('Board', boardSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// usersInRoom[roomId] = { socketId: { id: socketId, name: string, x: 0, y: 0 } }
const usersInRoom = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async ({ roomId, username }) => {
    socket.join(roomId);
    
    // Store user info
    if (!usersInRoom[roomId]) usersInRoom[roomId] = {};
    usersInRoom[roomId][socket.id] = { id: socket.id, name: username, x: 0, y: 0 };
    
    console.log(`User ${username} (${socket.id}) joined room ${roomId}`);

    // Broadcast updated users list
    io.to(roomId).emit('users-update', Object.values(usersInRoom[roomId]));

    // Fetch board from DB and send to the joining user
    try {
      let board = await Board.findOne({ roomId });
      if (!board) {
        board = new Board({ roomId, elements: [] });
        await board.save();
      }
      socket.emit('load-board', board.elements);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('cursor-move', ({ roomId, x, y }) => {
    if (usersInRoom[roomId] && usersInRoom[roomId][socket.id]) {
      usersInRoom[roomId][socket.id].x = x;
      usersInRoom[roomId][socket.id].y = y;
      socket.broadcast.to(roomId).emit('cursor-move', { id: socket.id, x, y });
    }
  });

  // Now we expect an entire elements array on update, or single action updates.
  // For Excalidraw-like logic, it's common to just sync individual elements or actions.
  // Let's do a simple action-based sync.
  socket.on('element-update', async ({ roomId, elements }) => {
    // We can just broadcast the full elements array or the diff.
    // For MVP, full elements array is fine.
    socket.broadcast.to(roomId).emit('board-update', elements);
    
    // Save to DB (debounced/throttled in real app, but directly for now)
    try {
      await Board.findOneAndUpdate({ roomId }, { elements }, { upsert: true });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => {
      if (usersInRoom[roomId] && usersInRoom[roomId][socket.id]) {
        delete usersInRoom[roomId][socket.id];
        socket.broadcast.to(roomId).emit('users-update', Object.values(usersInRoom[roomId]));
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
   app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
