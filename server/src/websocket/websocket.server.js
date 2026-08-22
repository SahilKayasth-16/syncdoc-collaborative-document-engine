import { WebSocketServer } from "ws";

import {
    addClientToRoom,
    removeClientFromRoom,
    sendInitialState,
    broadcastUpdate,
    addUserPresence,
    acquireBlockLock,
    releaseBlockLock,
    refreshBlockLock
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

    wss.on("connection", async (ws, request) => {
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

            let room = null;
            const pendingMessages = [];

            const handleIncomingMessage = (message, isBinary) => {
                if (!room) {
                    pendingMessages.push({ message, isBinary });
                    return;
                }

                try {
                    if (!isBinary) {
                        let data;
                        try {
                            data = JSON.parse(message.toString());
                        } catch {
                            console.warn(
                                `[WebSocket] Received invalid text message from document: ${documentId}`
                            );
                            return;
                        }

                        if (!data || typeof data !== "object" || !data.type) {
                            console.warn(
                                `[WebSocket] Received malformed message missing type from document: ${documentId}`
                            );
                            return;
                        }

                        switch (data.type) {
                            case "presence:identify":
                            case "identify": {
                                if (!data.user || !data.user.userId) {
                                    return;
                                }
                                addUserPresence(documentId, data.user, ws);
                                break;
                            }

                            case "lock:acquire": {
                                if (!data.blockId) {
                                    return;
                                }
                                if (!ws.userId) {
                                    ws.send(JSON.stringify({
                                        type: "lock:rejected",
                                        blockId: data.blockId,
                                        reason: "UNIDENTIFIED_USER"
                                    }));
                                    return;
                                }
                                const result = acquireBlockLock(documentId, data.blockId, {
                                    userId: ws.userId,
                                    name: ws.userName
                                });
                                if (result.success) {
                                    ws.send(JSON.stringify({
                                        type: "lock:acquired",
                                        blockId: data.blockId,
                                        userId: ws.userId,
                                        timestamp: result.lock.timestamp
                                    }));
                                } else {
                                    ws.send(JSON.stringify({
                                        type: "lock:rejected",
                                        blockId: data.blockId,
                                        reason: result.reason,
                                        lockedBy: result.lockedBy
                                    }));
                                }
                                break;
                            }

                            case "lock:release": {
                                if (!data.blockId) {
                                    return;
                                }
                                if (!ws.userId) {
                                    return;
                                }
                                const result = releaseBlockLock(documentId, data.blockId, {
                                    userId: ws.userId
                                });
                                if (result.success) {
                                    ws.send(JSON.stringify({
                                        type: "lock:released",
                                        blockId: data.blockId,
                                        userId: ws.userId
                                    }));
                                } else {
                                    ws.send(JSON.stringify({
                                        type: "lock:rejected",
                                        blockId: data.blockId,
                                        reason: result.reason,
                                        lockedBy: result.lockedBy
                                    }));
                                }
                                break;
                            }

                            case "lock:refresh": {
                                if (!data.blockId || !ws.userId) {
                                    return;
                                }
                                const result = refreshBlockLock(documentId, data.blockId, {
                                    userId: ws.userId
                                });
                                if (result.success) {
                                    ws.send(JSON.stringify({
                                        type: "lock:refreshed",
                                        blockId: data.blockId,
                                        userId: ws.userId,
                                        timestamp: result.lock.timestamp
                                    }));
                                } else {
                                    ws.send(JSON.stringify({
                                        type: "lock:rejected",
                                        blockId: data.blockId,
                                        reason: result.reason
                                    }));
                                }
                                break;
                            }

                            default:
                                console.log(`[WebSocket] Unknown text message type: ${data.type}`);
                                break;
                        }
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
                    applyDocumentUpdate(
                        room.ydoc,
                        update
                    );

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
            };

            ws.on("message", handleIncomingMessage);

            /**
             * Get or create the collaboration room.
             *
             * The first client causes the room to:
             *
             * 1. Load the AST from MongoDB.
             * 2. Create a Y.Doc.
             * 3. Populate the Y.Doc from the AST.
             *
             * Subsequent clients reuse the same room
             * and the same populated Y.Doc.
             */
            room = await addClientToRoom(
                documentId,
                ws
            );

            if (ws.readyState !== 1) {
                return;
            }

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
             * The state now contains the AST-loaded
             * title and blocks.
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
             * Process any messages that arrived while room was initializing.
             */
            while (pendingMessages.length > 0) {
                const pending = pendingMessages.shift();
                handleIncomingMessage(pending.message, pending.isBinary);
            }

            /**
             * Handle client disconnection.
             */
            ws.on("close", () => {
                removeClientFromRoom(
                    documentId,
                    ws
                );

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