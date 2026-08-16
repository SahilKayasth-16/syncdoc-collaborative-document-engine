import { createYDocument, destroyYDocument } from "./yjs.document.js";

/**
 * Active Collaboration Rooms.
 * 
 * Key -> documentId
 * Value -> { documentId, ydoc, clients }
 */

const rooms = new Map();

/**
 * Create an existing room or new one.
 * 
 * The 1st client joining a document creates a room 
 * and its Yjs document.
 * 
 * @param {string} documentId
 * @retruns {object}
 */

export const getOrCreateRoom = (documentId) => {
    let room = rooms.get(documentId);

    if (!room) {
        room = {
            documentId, 
            ydoc: createYDocument(),
            clients: new Set()
        }

        rooms.set(documentId, room);

        console.log(`[Collaboration] Room Created: ${documentId}`);
    }

    return room;
};

/**
 * Add a websocket client to a collaborative room.
 * 
 * @param {string} documentId
 * @param {WebSocket} client
 * @returns {object} 
 */

export const addClientToRoom = (documentId, client) => {
    const room = getOrCreateRoom(documentId);

    room.clients.add(client);

    console.log(`[Collaboration] Client Joined ${documentId}. Clients: ${room.clients.size}`);

    return room;
};

/**
 * Remove a websocekt client from a collaboration room.
 * 
 * If no clients remain, the room and its Yjs document are cleaned up.
 * 
 * @param {string} documentId
 * @param {webSocket} client 
 */

export const removeClientFromRoom = (documentId, client) => {
    const room = rooms.get(documentId);

    if (!room) return;

    room.clients.delete(client);

    console.log(`[Collaboration] Client Left ${documentId}. Clients: ${room.clients.size}`);

    if (room.clients.size === 0) {
        removeRoom(documentId);
    }
};

/**
 * Remove a collaboration room and destroy its Yjs document.
 * 
 * @param {string} documentId
 */

export const removeRoom = (documentId) => {
    const room  = rooms.get(documentId);

    if (!room) return

    destroyYDocument(room.ydoc);

    rooms.delete(documentId);

    console.log(`[Collaboration] Room Removed: ${documentId}`);
};

/**
 * Get an existing collaboration rooms.
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