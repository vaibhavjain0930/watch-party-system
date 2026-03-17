# Real-Time Watch Party System

A full-stack application that allows multiple users to watch YouTube videos together in real-time. Features synchronized playback, seeking, and role-based access control.

## 🚀 Setup & Run Instructions

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 1. Start the Backend server (Node.js + Socket.io)
Open a terminal, navigate to the `backend` directory, install dependencies, and run the dev server:

```bash
cd backend
npm install
npm run dev
```
The backend WebSocket server will start on `http://localhost:5000`.

### 2. Start the Frontend client (React + Vite)
Open a new terminal, navigate to the `frontend` directory, install dependencies, and run Vite:

```bash
cd frontend
npm install
npm run dev
```
The frontend application will typically be available at `http://localhost:5173`.

---

## 🏛️ Architecture Overview

The system utilizes an **Event-Driven WebSockets Architecture** via Socket.IO for real-time bidirectional communication.

### Backend (Object-Oriented Design)
The backend is structured using distinct TypeScript classes to encapsulate logic:
1. **`RoomManager`**: A singleton that handles the lifecycle of active rooms.
2. **`Room`**: Encapsulates the state for a specific room instance, holding the `VideoState` (current URL, play state, time) and a map of `Participant` objects. Validates permissions for actions internally.
3. **`Participant`**: Represents a connected user and their system role (`Host`, `Moderator`, `Participant`).
4. **`SocketHandler`**: Parses inbound socket events (`join_room`, `play`, `assign_role`, etc.), passes them through the Room permission validators, and emits the resulting state changes down to connected clients.

### Frontend
- **React Context (`SocketContext`)**: Creates a global provider to maintain the single WebSocket connection. It manages global state like the User List, current `VideoState`, and exposes interaction methods like `playVideo()` or `kickParticipant()`.
- **`react-player` Integration**: We wrap the YouTube IFrame player. The UI only permits Host/Moderators to interact with custom controls. When the Host clicks play/pause/seek, it emits an event to the backend. The backend updates the truth, broadcasts `sync_state`, and the React Player naturally reacts to the new props, keeping all clients in exact synchronization.

---

## 🎭 Role-Based Access Control

- **Host** (Assigned to room creator): Full control over playback, video URL, kicking participants, and assigning roles (promoting someone to Moderator).
- **Moderator**: Can control playback and seek/change videos. Cannot kick or promote users.
- **Participant** (Default joiner): Read-only view. Cannot click play/pause. Experiences the synchronized video passively.

---

### How to Test (Manual Flow)
1. Open `http://localhost:5173` locally. Create a new room as "Alice". You will be the **Host**.
2. Open an **Incognito Window** or a different browser to the same URL or the Room Link. Join as "Bob". You will be a **Participant**.
3. Attempt to pause the video as Bob. Notice the controls are disabled visually.
4. As Alice, play the video and seek to a new time. Watch Bob's screen snap into sync instantly.
5. As Alice, use the user sidebar menu to promote Bob to a Moderator. Bob can now pause the video for Alice.
