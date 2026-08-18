import { WebSocketServer } from "ws";

import {
    addClientToRoom,
    removeClientFromRoom,
    sendInitialState,
    broadcastUpdate
} from "./collaboration.room.js";

import { applyDocumentUpdate } from "./yjs.document.js";

/**
 * Creating and configuring a WebSocket server
 * using existing HTTP Server.
 *
 * Expected route:
 * ws://localhost:5050/ws/documents/:documentId
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
            const url = new URL(
                request.url,
                `http://${request.headers.host}`
            );

            const pathParts = url.pathname
                .split("/")
                .filter(Boolean);

            /**
             * Expected:
             * /ws/documents/:documentId
             *
             * pathParts:
             * ["ws", "documents", "documentId"]
             */

            if (
                pathParts.length !== 3 ||
                pathParts[0] !== "ws" ||
                pathParts[1] !== "documents"
            ) {
                ws.close(1008, "Invalid Collaboration Route");
                return;
            }

            const documentId = pathParts[2];

            if (!documentId) {
                ws.close(1008, "Document ID is required.");
                return;
            }

            /**
             * Get or create the collaboration room.
             *
             * Multiple clients using the same documentId
             * receive the SAME room and SAME Y.Doc.
             */
            const room = addClientToRoom(documentId, ws);

            /**
             * Store document ID on WebSocket instance.
             *
             * This allows us to identify the room when
             * the client disconnects.
             */
            ws.documentId = documentId;

            /**
             * Send the current Yjs document state
             * to the newly connected client.
             *
             * This is important when joining an existing room.
             */
            sendInitialState(room, ws);

            /**
             * Send connection metadata separately.
             *
             * This is JSON metadata, not a Yjs update.
             */
            ws.send(
                JSON.stringify({
                    type: "connected",
                    documentId,
                    message: "Joined Collaboration Room",
                    clients: room.clients.size
                })
            );

            console.log(
                `[WebSocket] Client connected to document: ${documentId}`
            );

            /**
             * Handle incoming Yjs updates.
             *
             * Client
             *   ↓
             * WebSocket message
             *   ↓
             * Apply update to shared Y.Doc
             *   ↓
             * Broadcast to other clients
             */
            ws.on("message", (message, isBinary) => {
                try {
                    if (!isBinary) {
                        console.log(
                            `[WebSocket] Ignoring non-binary message from ${documentId}`
                        );
                        return;
                    }

                    /**
                     * Convert incoming WebSocket data
                     * into Uint8Array expected by Yjs.
                     */
                    const update = new Uint8Array(message);

                    /**
                     * Apply update to the room's shared Y.Doc.
                     */
                    applyDocumentUpdate(room.ydoc, update);

                    /**
                     * Broadcast the same update to all
                     * other clients in this room.
                     */
                    broadcastUpdate(
                        documentId,
                        update,
                        ws
                    );
                } catch (error) {
                    console.error(
                        `[WebSocket] Yjs update failed (${documentId}):`,
                        error.message
                    );
                }
            });

            /**
             * Handle client disconnection.
             */
            ws.on("close", () => {
                removeClientFromRoom(documentId, ws);

                console.log(
                    `[WebSocket] Client disconnected from the document: ${documentId}`
                );
            });

            /**
             * Handle WebSocket errors.
             */
            ws.on("error", (error) => {
                console.error(
                    `[WebSocket] Client error (${documentId}):`,
                    error.message
                );
            });
        } catch (error) {
            console.error(
                "[WebSocket] Connection handling failed:",
                error.message
            );

            ws.close(1011, "Internal Server Error");
        }
    });

    console.log("WebSocket Server Initialized");

    return wss;
};