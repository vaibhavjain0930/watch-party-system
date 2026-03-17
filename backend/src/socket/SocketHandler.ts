import { Server, Socket } from 'socket.io';
import { roomManager } from '../managers/RoomManager';
import { Role } from '../models/Participant';
import { Room } from '../models/Room';

export class SocketHandler {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    handleConnection(socket: Socket) {
        console.log(`User connected: ${socket.id}`);

        // Join Room
        socket.on('join_room', ({ roomId, username }: { roomId: string, username: string }) => {
            const { room, participant, isNew } = roomManager.createOrJoinRoom(roomId, socket.id, username);
            socket.join(roomId);

            const payload = {
                username: participant.username,
                userId: participant.id,
                role: participant.role,
                participants: room.getAllParticipants()
            };

            // Avoid spamming the whole room for duplicate join_room emits.
            // If it's a duplicate join from the same socket, only tell that socket so it can set currentUser.
            if (isNew) {
                this.io.to(roomId).emit('user_joined', payload);
            } else {
                socket.emit('user_joined', payload);
            }

            // Send current video state to the newly joined user ONLY
            socket.emit('sync_state', room.videoState);
            
            console.log(`User ${participant.username} joined room ${roomId} as ${participant.role}`);
        });

        // Leave Room
        socket.on('leave_room', ({ roomId }: { roomId: string }) => {
            const room = roomManager.getRoom(roomId);
            const participant = room?.getParticipant(socket.id);

            socket.leave(roomId);

            const result = roomManager.removeParticipantFromRoom(roomId, socket.id);
            if (result && participant) {
                this.io.to(roomId).emit('user_left', {
                    username: participant.username,
                    userId: participant.id,
                    participants: result.room.getAllParticipants()
                });
            }
        });

        // -------------------------------------------------------------
        // Video State Sync Events (Require Host/Moderator)
        // -------------------------------------------------------------
        
        socket.on('play', ({ time }: { time?: number } = {}) => {
            this.handleSyncEvent(socket, 'play', (room) => {
                const safeTime = typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : room.videoState.currentTime;
                room.updateVideoState({ playState: 'playing', currentTime: safeTime });
                this.io.to(room.roomId).emit('sync_state', room.videoState);
            });
        });

        socket.on('pause', ({ time }: { time?: number } = {}) => {
            this.handleSyncEvent(socket, 'pause', (room) => {
                const safeTime = typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : room.videoState.currentTime;
                room.updateVideoState({ playState: 'paused', currentTime: safeTime });
                this.io.to(room.roomId).emit('sync_state', room.videoState);
            });
        });

        socket.on('seek', ({ time }: { time: number }) => {
             this.handleSyncEvent(socket, 'seek', (room) => {
                 const safeTime = typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : room.videoState.currentTime;
                 room.updateVideoState({ currentTime: safeTime });
                 this.io.to(room.roomId).emit('sync_state', room.videoState);
             });
        });

        socket.on('change_video', ({ videoId }: { videoId: string }) => {
             this.handleSyncEvent(socket, 'change_video', (room) => {
                 room.updateVideoState({ videoId, currentTime: 0, playState: 'playing' });
                 this.io.to(room.roomId).emit('sync_state', room.videoState);
             });
        });

        // -------------------------------------------------------------
        // Role & User Management Events (Require ONLY Host)
        // -------------------------------------------------------------

        socket.on('assign_role', ({ userId, role }: { userId: string, role: Role }) => {
            this.handleAdminEvent(socket, 'assign_role', (room) => {
                // Prevent creating multiple Hosts or demoting the Host via assign_role.
                if (role === 'Host') {
                    socket.emit('error_message', { message: 'Use transfer_host to change Host.' });
                    return;
                }
                const requester = room.getParticipant(socket.id);
                if (!requester || requester.role !== 'Host') {
                    socket.emit('error_message', { message: 'Only the Host can assign roles.' });
                    return;
                }
                if (userId === socket.id) {
                    socket.emit('error_message', { message: 'Host cannot change their own role.' });
                    return;
                }
                // Viewer is a read-only alias of Participant (allowed here)
                const targetParticipant = room.getParticipant(userId);
                if (targetParticipant) {
                    targetParticipant.role = role;
                    this.io.to(room.roomId).emit('role_assigned', {
                        userId,
                        username: targetParticipant.username,
                        role,
                        participants: room.getAllParticipants()
                    });
                }
            });
        });

        socket.on('transfer_host', ({ userId }: { userId: string }) => {
            this.handleAdminEvent(socket, 'transfer_host', (room) => {
                if (userId === socket.id) return;
                const target = room.getParticipant(userId);
                const current = room.getParticipant(socket.id);
                if (!target || !current) return;

                // Transfer host: old host becomes Participant by default
                current.role = 'Participant';
                target.role = 'Host';

                this.io.to(room.roomId).emit('role_assigned', {
                    userId: target.id,
                    username: target.username,
                    role: target.role,
                    participants: room.getAllParticipants()
                });
            });
        });

        socket.on('remove_participant', ({ userId }: { userId: string }) => {
            this.handleAdminEvent(socket, 'remove_participant', (room) => {
                const targetParticipant = room.removeParticipant(userId);
                if (targetParticipant) {
                    // Send specific event to kick them out
                    this.io.to(targetParticipant.id).emit('kicked');
                    
                    // Force the actual socket to leave the room
                    const targetSocket = this.io.sockets.sockets.get(userId);
                    if (targetSocket) {
                        targetSocket.leave(room.roomId);
                    }

                    // Update everyone else
                    this.io.to(room.roomId).emit('participant_removed', {
                        userId,
                        participants: room.getAllParticipants()
                    });
                }
            });
        });

        // -------------------------------------------------------------
        // Chat Events
        // -------------------------------------------------------------
        socket.on('chat_message', ({ message }: { message: string }) => {
            for (const room of [...socket.rooms]) {
                if (room === socket.id) continue;
                const roomObj = roomManager.getRoom(room);
                const participant = roomObj?.getParticipant(socket.id);
                if (roomObj && participant) {
                    this.io.to(room).emit('chat_message', {
                        userId: participant.id,
                        username: participant.username,
                        message,
                        timestamp: Date.now()
                    });
                    break;
                }
            }
        });

        // -------------------------------------------------------------
        // Disconnect
        // -------------------------------------------------------------
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            const result = roomManager.removeParticipantFromAllRooms(socket.id);
            if (result) {
                const { roomId, room } = result;
                // If there are still people, update them
                if (room.participants.size > 0) {
                     this.io.to(roomId).emit('user_left', {
                         userId: socket.id,
                         participants: room.getAllParticipants()
                     });
                }
            }
        });
    }

    // Helper to validate Host/Moderator permission
    private handleSyncEvent(socket: Socket, eventName: string, action: (room: Room) => void) {
        // Find which room this socket is in
        for (const room of [...socket.rooms]) {
            if (room === socket.id) continue; // Default individual room
            const roomObj = roomManager.getRoom(room);
            if (roomObj) {
                if (roomObj.hasControlPermission(socket.id)) {
                    action(roomObj);
                } else {
                    console.log(`Unauthorized ${eventName} attempt by ${socket.id} in room ${room}`);
                    socket.emit('error_message', { message: `You do not have permission to ${eventName}.` });
                }
                break;
            }
        }
    }

    // Helper to validate Host-Only permission
    private handleAdminEvent(socket: Socket, eventName: string, action: (room: Room) => void) {
        for (const room of [...socket.rooms]) {
             if (room === socket.id) continue;
             const roomObj = roomManager.getRoom(room);
             if (roomObj) {
                 if (roomObj.hasAdminPermission(socket.id)) {
                     action(roomObj);
                 } else {
                     console.log(`Unauthorized ${eventName} attempt by ${socket.id} in room ${room}`);
                     socket.emit('error_message', { message: `Only the Host can ${eventName.replace('_', ' ')}.` });
                 }
                 break;
             }
         }
    }
}
