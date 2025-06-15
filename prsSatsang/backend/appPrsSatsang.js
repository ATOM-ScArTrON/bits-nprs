const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const socketIo = require('socket.io');
const io = socketIo(server);

const prsRoutes = require('./routes/prsRoutes');

app.use(express.json());
app.use('/api/prs', prsRoutes);

// WebSocket Example for real-time simulation
io.on('connection', (socket) => {
console.log('Client connected');

socket.on('subscribeToChanges', () => {
console.log('Client subscribed to satsang updates');
});

socket.on('disconnect', () => {
console.log('Client disconnected');
});
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(PRS Satsang service running on port ${PORT}));
