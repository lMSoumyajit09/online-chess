const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

let rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 4).toUpperCase();
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("createRoom", ({ playerName }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { players: [{ id: socket.id, name: playerName, color: "white" }], fen: "start", turn: "white", disconnectTimer: null };
        socket.join(roomCode);
        socket.emit("roomCreated", { roomCode, color: "white", players: rooms[roomCode].players });
    });

    socket.on("joinRoom", ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];
        if (!room) { socket.emit("errorMsg", "Room not found"); return; }
        if (room.players.length >= 2) { socket.emit("errorMsg", "Room full"); return; }

        room.players.push({ id: socket.id, name: playerName, color: "black" });
        socket.join(roomCode);

        if (room.disconnectTimer) { clearTimeout(room.disconnectTimer); room.disconnectTimer = null; }

        io.to(socket.id).emit("joinedRoom", { roomCode, color: "black", players: room.players });
        io.to(roomCode).emit("startGame");
        io.to(roomCode).emit("updatePlayers", { players: room.players });
    });

    socket.on("move", ({ roomCode, fen }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.color !== room.turn) return;
        room.fen = fen;
        room.turn = room.turn === "white" ? "black" : "white";
        socket.to(roomCode).emit("move", { fen });
    });

    socket.on("sendComment", ({ roomCode, comment, player }) => {
        io.to(roomCode).emit("receiveComment", { player, comment });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        for (let roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.disconnectTimer = setTimeout(() => {
                    const otherPlayer = room.players.find(p => p.id !== socket.id);
                    if (otherPlayer) io.to(otherPlayer.id).emit("opponentLeftWin", "Opponent disconnected. You win!");
                    delete rooms[roomCode];
                }, 60000);
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                if (otherPlayer) io.to(otherPlayer.id).emit("opponentLeft", "Opponent disconnected. Waiting 1 min...");
                room.players[playerIndex].disconnected = true;
            }
        }
    });
});

const PORT = process.env.PORT || 3000; // Use Railway port if available
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});