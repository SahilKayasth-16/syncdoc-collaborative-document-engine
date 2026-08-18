import {
    createYDocument,
    destroyYDocument,
    encodeDocumentState
} from "./yjs.document.js";

/**
 * Active Collaboration Rooms.
 *
 * Key   -> documentId
 * Value -> { documentId, ydoc, clients }
 */

const rooms = new Map();

/**
 * Create an existing room or a new one.
 *
 * The first client joining a document creates the room
 * and its shared Yjs document.
 *
 * @param {string} documentId
 * @returns {object}
 */
export const getOrCreateRoom = (documentId) => {
    let room = rooms.get(documentId);

    if (!room) {
        room = {
            documentId,
            ydoc: createYDocument(),
            clients: new Set()
        };

        rooms.set(documentId, room);

        console.log(`[Collaboration] Room Created: ${documentId}`);
    }

    return room;
};

/**
 * Add a WebSocket client to a collaboration room.
 *
 * If the room already contains a Y.Doc, the current
 * document state can be sent to the newly connected client.
 *
 * @param {string} documentId
 * @param {WebSocket} client
 * @returns {object}
 */
export const addClientToRoom = (documentId, client) => {
    const room = getOrCreateRoom(documentId);

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