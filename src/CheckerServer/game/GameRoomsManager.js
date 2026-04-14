import CheckersRoom from "./CheckersRoom.js";

class GameRoomsManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(socketId, playerName) {
        const roomId = this.generateRoomId();
        const room = new CheckersRoom(roomId, socketId, playerName);
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }

    // Collision-safe ID generation
    generateRoomId() {
        let id;
        do {
            id = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.rooms.has(id));
        return id;
    }

    getRoomsList() {
        return Array.from(this.rooms.values())
            .filter(room => room.status === 'waiting' || room.status === 'playing' || room.status === 'paused')
            .map(room => ({
                roomId: room.id,
                players: room.players.length,
                status: room.status,
                createdBy: room.players[0]?.name || 'Unknown',
                spectatorCount: room.spectators.length,
            }));
    }
}

export default GameRoomsManager;