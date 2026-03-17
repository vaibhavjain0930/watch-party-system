export type Role = 'Host' | 'Moderator' | 'Participant' | 'Viewer';

export class Participant {
    id: string;        // Socket ID
    username: string;
    roomId: string;
    role: Role;

    constructor(id: string, username: string, roomId: string, role: Role) {
        this.id = id;
        this.username = username;
        this.roomId = roomId;
        this.role = role;
    }

    // Convert object to plain data to send over the network
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            role: this.role
        };
    }
}
