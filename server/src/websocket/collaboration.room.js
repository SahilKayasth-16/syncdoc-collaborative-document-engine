import {
    createYDocument,
    destroyYDocument,
    encodeDocumentState,
    loadASTIntoYDocument
} from "./yjs.document.js";

import { getDocumentTree } from "../services/document.service.js";

/**
 * Active Collaboration Rooms.
 *
 * Key   -> documentId
 * Value -> { documentId, ydoc, clients }
 */
const rooms = new Map();

/**
 * Rooms currently being initialized.
 *
 * This prevents multiple clients joining the same new
 * document at the exact same time from creating
 * multiple Y.Docs.
 *
 * Key   -> documentId
 * Value -> Promise<room>
 */
const initializingRooms = new Map();

/**
 * Create an existing room or initialize a new one.
 *
 * The first client joining a document:
 *
 * 1. Loads the document AST from MongoDB.
 * 2. Creates a Y.Doc.
 * 3. Loads the AST into the Y.Doc.
 * 4. Stores the populated room.
 *
 * Subsequent clients reuse the same room and Y.Doc.
 *
 * @param {string} documentId
 * @returns {Promise<object>}
 */
export const getOrCreateRoom = async (documentId) => {
    /**
     * Room already exists.
     * Reuse the existing populated Y.Doc.
     */
    const existingRoom = rooms.get(documentId);

    if (existingRoom) {
        return existingRoom;
    }

    /**
     * Another client may already be initializing
     * this same document.
     *
     * Wait for that initialization instead of
     * creating another Y.Doc.
     */
    const existingInitialization = initializingRooms.get(documentId);

    if (existingInitialization) {
        return await existingInitialization;
    }

    /**
     * Initialize the room exactly once.
     */
    const initialization = (async () => {
        try {
            console.log(
                `[Collaboration] Loading AST for room: ${documentId}`
            );

            /**
             * Load the complete AST from MongoDB.
             */
            const documentTree = await getDocumentTree(documentId);

            if (!documentTree) {
                throw new Error(
                    `Document not found: ${documentId}`
                );
            }

            /**
             * Create the shared Yjs document.
             */
            const ydoc = createYDocument();

            /**
             * Populate the Y.Doc from the MongoDB AST.
             */
            loadASTIntoYDocument(documentTree, ydoc);

            /**
             * Create the collaboration room with
             * the already-populated Y.Doc.
             */
            /**
             * Create the collaboration room with
             * the already-populated Y.Doc, presence map, and locks map.
             */
            const room = {
                documentId,
                ydoc,
                clients: new Set(),
                presence: new Map(), // Map<userId, userInfo>
                locks: new Map(),     // Map<blockId, lock>
                cleanupInterval: null
            };

            /**
             * Setup periodic stale-lock cleanup (runs every 5 seconds).
             */
            room.cleanupInterval = setInterval(() => {
                cleanupStaleLocks(documentId);
            }, 5000);

            rooms.set(documentId, room);

            console.log(
                `[Collaboration] Room Created and AST Loaded: ${documentId}`
            );

            return room;
        } catch (error) {
            console.error(
                `[Collaboration] Room initialization failed (${documentId}):`,
                error.message
            );

            throw error;
        } finally {
            /**
             * Initialization is complete.
             * Remove the temporary promise so future
             * clients use the actual room.
             */
            initializingRooms.delete(documentId);
        }
    })();

    initializingRooms.set(documentId, initialization);

    return await initialization;
};

/**
 * Add a WebSocket client to a collaboration room.
 *
 * @param {string} documentId
 * @param {WebSocket} client
 * @returns {Promise<object>}
 */
export const addClientToRoom = async (documentId, client) => {
    const room = await getOrCreateRoom(documentId);

    if (client.readyState === 1) {
        room.clients.add(client);

        console.log(
            `[Collaboration] Client Joined ${documentId}. Clients: ${room.clients.size}`
        );
    } else {
        console.log(
            `[Collaboration] Client disconnected while room was initializing: ${documentId}`
        );

        if (room.clients.size === 0) {
            removeRoom(documentId);
        }
    }

    return room;
};

/**
 * Remove a WebSocket client from a collaboration room.
 *
 * If no clients remain, the room and its Yjs document
 * are cleaned up.
 *
 * @param {string} documentId
 * @param {WebSocket} client
 */
export const removeClientFromRoom = (documentId, client) => {
    const room = rooms.get(documentId);

    if (!room) {
        return;
    }

    room.clients.delete(client);

    console.log(
        `[Collaboration] Client Left ${documentId}. Clients: ${room.clients.size}`
    );

    if (client.userId) {
        removeUserPresence(documentId, client);
    }

    if (room.clients.size === 0) {
        removeRoom(documentId);
    }
};

/**
 * Broadcast a Yjs update to all clients in the room
 * except the client that generated the update.
 *
 * @param {string} documentId
 * @param {Uint8Array} update
 * @param {WebSocket|null} sender
 */
export const broadcastUpdate = (documentId, update, sender = null) => {
    const room = rooms.get(documentId);

    if (!room) {
        return;
    }

    for (const client of room.clients) {
        if (client === sender) {
            continue;
        }

        if (client.readyState === 1) {
            client.send(update);
        }
    }
};

/**
 * Broadcast a JSON message to all clients in the room.
 *
 * @param {string} documentId
 * @param {object} messageObj
 * @param {WebSocket|null} senderToSkip
 */
export const broadcastJsonMessage = (documentId, messageObj, senderToSkip = null) => {
    const room = rooms.get(documentId);

    if (!room) {
        return;
    }

    const payload = JSON.stringify(messageObj);

    for (const client of room.clients) {
        if (client === senderToSkip) {
            continue;
        }

        if (client.readyState === 1) {
            client.send(payload);
        }
    }
};

/**
 * Send the current Yjs document state and presence/locks to a newly
 * connected client.
 *
 * @param {object} room
 * @param {WebSocket} client
 */
export const sendInitialState = (room, client) => {
    if (!room || !client) {
        return;
    }

    if (client.readyState !== 1) {
        return;
    }

    const state = encodeDocumentState(room.ydoc);

    client.send(state);

    if (room.presence.size > 0) {
        client.send(JSON.stringify({
            type: "presence:update",
            users: Array.from(room.presence.values())
        }));
    }

    if (room.locks.size > 0) {
        client.send(JSON.stringify({
            type: "locks:update",
            locks: Array.from(room.locks.values())
        }));
    }
};

/**
 * Remove a collaboration room and destroy its Yjs document.
 *
 * @param {string} documentId
 */
export const removeRoom = (documentId) => {
    const room = rooms.get(documentId);

    if (!room) {
        return;
    }

    if (room.cleanupInterval) {
        clearInterval(room.cleanupInterval);
        room.cleanupInterval = null;
    }

    destroyYDocument(room.ydoc);

    rooms.delete(documentId);

    console.log(`[Collaboration] Room Removed: ${documentId}`);
};

/**
 * Get an existing collaboration room.
 *
 * @param {string} documentId
 * @returns {object|null}
 */
export const getRoom = (documentId) => {
    return rooms.get(documentId) || null;
};

/**
 * Get the number of active collaboration rooms.
 *
 * @returns {number}
 */
export const getRoomCount = () => {
    return rooms.size;
};

/* ==================================================
 * DAY 11 PRESENCE & BLOCK LOCKING HELPERS
 * ================================================== */

/**
 * Add a user to room presence and broadcast presence update.
 *
 * @param {string} documentId
 * @param {{ userId: string, name: string }} user
 * @param {WebSocket} wsClient
 */
export const addUserPresence = (documentId, user, wsClient) => {
    const room = rooms.get(documentId);
    if (!room || !user || !user.userId) {
        return;
    }

    wsClient.userId = user.userId;
    wsClient.userName = user.name || `User ${user.userId}`;

    const userInfo = {
        userId: user.userId,
        name: wsClient.userName
    };

    room.presence.set(user.userId, userInfo);
    console.log(`[Presence] User joined: ${user.userId}`);

    broadcastJsonMessage(documentId, {
        type: "presence:update",
        users: Array.from(room.presence.values())
    });

    // Send current locks state to the user
    wsClient.send(JSON.stringify({
        type: "locks:update",
        locks: Array.from(room.locks.values())
    }));
};

/**
 * Remove a user from room presence when all their WS connections leave.
 *
 * @param {string} documentId
 * @param {WebSocket} wsClient
 */
export const removeUserPresence = (documentId, wsClient) => {
    const room = rooms.get(documentId);
    if (!room || !wsClient.userId) {
        return;
    }

    const userId = wsClient.userId;

    // Check if user still has another active WebSocket in the room
    let otherClientExists = false;
    for (const client of room.clients) {
        if (client !== wsClient && client.userId === userId) {
            otherClientExists = true;
            break;
        }
    }

    if (!otherClientExists) {
        room.presence.delete(userId);
        console.log(`[Presence] User left: ${userId}`);

        releaseLocksForUser(documentId, userId);

        broadcastJsonMessage(documentId, {
            type: "presence:update",
            users: Array.from(room.presence.values())
        });
    }
};

/**
 * Get presence list of users in room.
 *
 * @param {string} documentId
 * @returns {Array<object>}
 */
export const getPresenceList = (documentId) => {
    const room = rooms.get(documentId);
    if (!room) return [];
    return Array.from(room.presence.values());
};

/**
 * Acquire lock on a block for a user.
 *
 * @param {string} documentId
 * @param {string} blockId
 * @param {{ userId: string, name: string }} user
 * @returns {object} result
 */
export const acquireBlockLock = (documentId, blockId, user) => {
    const room = rooms.get(documentId);
    if (!room) {
        return { success: false, reason: "ROOM_NOT_FOUND" };
    }

    const existingLock = room.locks.get(blockId);

    if (existingLock) {
        if (existingLock.userId === user.userId) {
            existingLock.timestamp = Date.now();
            console.log(`[Lock] Refreshed: ${blockId} by ${user.userId}`);
            broadcastJsonMessage(documentId, {
                type: "locks:update",
                locks: Array.from(room.locks.values())
            });
            return { success: true, lock: existingLock };
        } else {
            console.log(`[Lock] Rejected: ${blockId} already locked by ${existingLock.userId}`);
            return {
                success: false,
                reason: "BLOCK_LOCKED",
                lockedBy: {
                    userId: existingLock.userId,
                    name: existingLock.name
                }
            };
        }
    }

    const newLock = {
        blockId,
        userId: user.userId,
        name: user.name || `User ${user.userId}`,
        timestamp: Date.now()
    };

    room.locks.set(blockId, newLock);
    console.log(`[Lock] Acquired: ${blockId} by ${user.userId}`);

    broadcastJsonMessage(documentId, {
        type: "locks:update",
        locks: Array.from(room.locks.values())
    });

    return { success: true, lock: newLock };
};

/**
 * Release a block lock owned by a user.
 *
 * @param {string} documentId
 * @param {string} blockId
 * @param {{ userId: string }} user
 * @returns {object} result
 */
export const releaseBlockLock = (documentId, blockId, user) => {
    const room = rooms.get(documentId);
    if (!room) {
        return { success: false, reason: "ROOM_NOT_FOUND" };
    }

    const existingLock = room.locks.get(blockId);

    if (!existingLock) {
        return { success: true };
    }

    if (existingLock.userId !== user.userId) {
        console.log(`[Lock] Rejected release: ${blockId} owned by ${existingLock.userId}, requested by ${user.userId}`);
        return {
            success: false,
            reason: "NOT_LOCK_OWNER",
            lockedBy: {
                userId: existingLock.userId,
                name: existingLock.name
            }
        };
    }

    room.locks.delete(blockId);
    console.log(`[Lock] Released: ${blockId} by ${user.userId}`);

    broadcastJsonMessage(documentId, {
        type: "locks:update",
        locks: Array.from(room.locks.values())
    });

    return { success: true, blockId };
};

/**
 * Refresh a block lock owned by a user.
 *
 * @param {string} documentId
 * @param {string} blockId
 * @param {{ userId: string }} user
 * @returns {object} result
 */
export const refreshBlockLock = (documentId, blockId, user) => {
    const room = rooms.get(documentId);
    if (!room) {
        return { success: false, reason: "ROOM_NOT_FOUND" };
    }

    const existingLock = room.locks.get(blockId);

    if (!existingLock || existingLock.userId !== user.userId) {
        return { success: false, reason: "NOT_LOCK_OWNER" };
    }

    existingLock.timestamp = Date.now();

    broadcastJsonMessage(documentId, {
        type: "locks:update",
        locks: Array.from(room.locks.values())
    });

    return { success: true, lock: existingLock };
};

/**
 * Release all locks owned by a specific user in a room.
 *
 * @param {string} documentId
 * @param {string} userId
 */
export const releaseLocksForUser = (documentId, userId) => {
    const room = rooms.get(documentId);
    if (!room) {
        return;
    }

    let releasedCount = 0;
    for (const [blockId, lock] of room.locks.entries()) {
        if (lock.userId === userId) {
            room.locks.delete(blockId);
            console.log(`[Lock] Cleanup: released ${blockId} from disconnected user ${userId}`);
            releasedCount++;
        }
    }

    if (releasedCount > 0) {
        broadcastJsonMessage(documentId, {
            type: "locks:update",
            locks: Array.from(room.locks.values())
        });
    }
};

/**
 * Get active locks list in room.
 *
 * @param {string} documentId
 * @returns {Array<object>}
 */
export const getLocksList = (documentId) => {
    const room = rooms.get(documentId);
    if (!room) return [];
    return Array.from(room.locks.values());
};

/**
 * Periodically cleanup locks older than timeoutMs (default: 30000 ms).
 *
 * @param {string} documentId
 * @param {number} timeoutMs
 */
export const cleanupStaleLocks = (documentId, timeoutMs = 30000) => {
    const room = rooms.get(documentId);
    if (!room || room.locks.size === 0) {
        return;
    }

    const now = Date.now();
    let expiredCount = 0;

    for (const [blockId, lock] of room.locks.entries()) {
        if (now - lock.timestamp > timeoutMs) {
            room.locks.delete(blockId);
            console.log(`[Lock] Expired: ${blockId}`);
            expiredCount++;
        }
    }

    if (expiredCount > 0) {
        broadcastJsonMessage(documentId, {
            type: "locks:update",
            locks: Array.from(room.locks.values())
        });
    }
};