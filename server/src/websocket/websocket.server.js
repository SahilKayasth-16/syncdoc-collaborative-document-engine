import { WebSocketServer } from "ws";
import { addClientToRoom, removeClientFromRoom } from "./collaboration.room.js";

/**
 * Creating and configuring a WebSocket server
 * using existing HTTP Server.
 * 
 * Expected route: ws://localhost:5050/ws/documents/:documentId
 * 
 * @param {import("http").Server} server
 * @returns {WebSocketServer}
 */

export const createWebSocketServer = (server) => {
    const wss = new WebSocketServer({
        server,
    });

    wss.on("connection", (ws, request) => {
        try {
            const url  = new URL(request.url, `http://${request.headers.host}`);

            const pathParts = url.pathname.split("/").filter(Boolean);

            /**
             * Epxected: /ws/documents/:documentsId
             * 
             * pathParts = ["ws", "documents", "documentId"]
             */

            if (pathParts.length !== 3 || pathParts[0] !== "ws" || pathParts[1] !== "documents" ) {
                ws.close(1008, "Invalid Collaboration Route");
                return;
            }

            const documentId = pathParts[2];

            if (!documentId) {
                ws.close(1008, "Document ID id required.");
            }

            const room = addClientToRoom(documentId, ws);

            /**
             * Store document ID on WebScoekt instance.
             * 
             * This allows us identify the room during disconnect.
             */

            ws.documentId = documentId;

            ws.send(JSON.stringify({
                type: "connected",
                documentId,
                message: "Joined Collaboration Room",
                clients: room.clients.size
            }));

            console.log(`[WebSocket] Client connected to document: ${documentId}`);

            ws.on("close", () => {
                removeClientFromRoom(documentId, ws);

                console.log(`[WebSocket] Client disconnected from the document: ${documentId}`);
            });

            ws.on("error", (error) => {
                console.error(`[WebSocket] Client error(${documentId}):`, error.message);
            });

        } catch(error) {
            console.error("[WebSocket] Connection handling failed:", error.message);

            ws.close(1011, "Internal Server Error");
        }
    });

    console.log("WebSocket Server Initialized");

    return wss;
};