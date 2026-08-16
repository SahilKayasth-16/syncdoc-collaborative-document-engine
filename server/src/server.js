import http from "http";
import app from './app.js';
import connectDB from './config/database.js';
import { createWebSocketServer } from "./websocket/websocket.server.js";

const PORT = process.env.PORT || 5050;

// Initialize Database connection
connectDB();

//Create HTTP Server using Express app.
const server = http.createServer(app);

//Attaching WebSocket Server with same HTTP Server
createWebSocketServer(server);

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/documents/:documentId`);
});