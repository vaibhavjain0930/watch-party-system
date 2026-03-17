import { Room } from '../models/Room';

class RoomManager {
    private rooms: Map<string, Room> = new Map();

    createOrJoinRoom(roomId: string, socketId: string, username: string) {
        let room = this.rooms.get(roomId);
        if (!room) {
            room = new Room(roomId);
            this.rooms.set(roomId, room);
        }
        
        const { participant, isNew } = room.addParticipant(socketId, username);
        return { room, participant, isNew };
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    removeParticipantFromRoom(roomId: string, socketId: string): { roomId: string; room: Room } | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (!room.getParticipant(socketId)) return null;

        room.removeParticipant(socketId);

        // Cleanup empty rooms
        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
        }

        return { roomId, room };
    }

    removeParticipantFromAllRooms(socketId: string): { roomId: string, room: Room } | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.getParticipant(socketId)) {
                room.removeParticipant(socketId);
                
                // Cleanup empty rooms
                if (room.participants.size === 0) {
                    this.rooms.delete(roomId);
                }
                
                return { roomId, room };
            }
        }
        return null;
    }
}

// Export a singleton instance
export const roomManager = new RoomManager();
