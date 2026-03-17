import { Participant, Role } from './Participant';

export interface VideoState {
    videoId: string;
    playState: 'playing' | 'paused';
    currentTime: number;
    lastUpdateTime: number; // Server timestamp representing when the state was last updated
}

export class Room {
    roomId: string;
    participants: Map<string, Participant>; // socketId -> Participant
    videoState: VideoState;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.participants = new Map();
        
        // Default video state (can be anything, maybe a placeholder video)
        this.videoState = {
            videoId: 'dQw4w9WgXcQ', // default Rick Roll or any default ID
            playState: 'paused',
            currentTime: 0,
            lastUpdateTime: Date.now()
        };
    }

    addParticipant(socketId: string, username: string): { participant: Participant; isNew: boolean } {
        // If participant already exists, preserve their role (fixes React Strict Mode double-joins)
        if (this.participants.has(socketId)) {
            return { participant: this.participants.get(socketId)!, isNew: false };
        }

        // First person to join becomes Host
        const role: Role = this.participants.size === 0 ? 'Host' : 'Participant';
        const participant = new Participant(socketId, username, this.roomId, role);
        this.participants.set(socketId, participant);
        return { participant, isNew: true };
    }

    removeParticipant(socketId: string): Participant | undefined {
        const participant = this.participants.get(socketId);
        if (participant) {
            this.participants.delete(socketId);
            
            // If the host leaves and there are still people, promote the oldest participant to Host
            if (participant.role === 'Host' && this.participants.size > 0) {
                const nextUser = this.participants.values().next().value;
                if (nextUser) {
                    nextUser.role = 'Host';
                }
            }
        }
        return participant;
    }

    getParticipant(socketId: string): Participant | undefined {
        return this.participants.get(socketId);
    }

    getAllParticipants() {
        return Array.from(this.participants.values()).map(p => p.toJSON());
    }

    updateVideoState(partialState: Partial<VideoState>) {
        this.videoState = {
            ...this.videoState,
            ...partialState,
            lastUpdateTime: Date.now()
        };
    }

    // RBAC Security Measure
    hasControlPermission(socketId: string): boolean {
        const p = this.participants.get(socketId);
        if (!p) return false;
        return p.role === 'Host' || p.role === 'Moderator';
    }

    // RBAC Security Measure
    hasAdminPermission(socketId: string): boolean {
        const p = this.participants.get(socketId);
        if (!p) return false;
        return p.role === 'Host';
    }
}
