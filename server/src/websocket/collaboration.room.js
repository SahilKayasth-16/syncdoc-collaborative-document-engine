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
            const room = {
                documentId,
                ydoc,
                clients: new Set()
            };

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

    room.clients.add(client);

    console.log(
        `[Collaboration] Client Joined ${documentId}. Clients: ${room.clients.size}`
    );

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
 * Send the current Yjs document state to a newly
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