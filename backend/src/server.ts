import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { SocketHandler } from './socket/SocketHandler';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // allow frontend access
        methods: ["GET", "POST"]
    }
});

const socketHandler = new SocketHandler(io);

io.on('connection', (socket) => {
    socketHandler.handleConnection(socket);
});

const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

server.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
