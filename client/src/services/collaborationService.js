import * as Y from "yjs";

const WS_BASE_URL = "ws://localhost:5050";

export const createCollaborationConnection = (
    documentId,
    callbacks = {},
    user = null
) => {
    const ydoc = new Y.Doc();

    const ws = new WebSocket(
        `${WS_BASE_URL}/ws/documents/${documentId}`
    );

    ws.binaryType = "arraybuffer";

    /**
     * WebSocket connected.
     */
    ws.onopen = () => {
        callbacks.onOpen?.();

        if (user && user.userId) {
            ws.send(JSON.stringify({
                type: "presence:identify",
                user
            }));
        }
    };

    /**
     * Receive Yjs updates and collaboration protocol messages from the server.
     */
    ws.onmessage = async (event) => {
        try {
            if (typeof event.data === "string") {
                try {
                    const message = JSON.parse(event.data);

                    callbacks.onMessage?.(message);

                    if (message.type === "presence:update") {
                        callbacks.onPresenceUpdate?.(message.users || []);
                    } else if (message.type === "locks:update") {
                        callbacks.onLocksUpdate?.(message.locks || []);
                    } else if (message.type === "lock:acquired") {
                        callbacks.onLockAcquired?.(message);
                    } else if (message.type === "lock:rejected") {
                        callbacks.onLockRejected?.(message);
                    } else if (message.type === "lock:released") {
                        callbacks.onLockReleased?.(message);
                    }

                    return;
                } catch {
                    console.warn(
                        "[Collaboration] Received invalid text message."
                    );

                    return;
                }
            }

            const data =
                event.data instanceof ArrayBuffer
                    ? new Uint8Array(event.data)
                    : new Uint8Array(await event.data.arrayBuffer());

            Y.applyUpdate(ydoc, data, "remote");

            callbacks.onUpdate?.(ydoc);
        } catch (error) {
            console.error(
                "[Collaboration] Failed to apply Yjs update:",
                error
            );

            callbacks.onError?.(error);
        }
    };

    /**
     * WebSocket error.
     */
    ws.onerror = (event) => {
        console.error("[Collaboration] WebSocket error:", event);

        callbacks.onError?.(event);
    };

    /**
     * WebSocket disconnected.
     */
    ws.onclose = () => {
        callbacks.onClose?.();
    };

    /**
     * Send local Yjs updates to the server.
     *
     * Remote updates are not sent back because they
     * originated from the server.
     */
    const updateHandler = (update, origin) => {
        if (origin === "remote") {
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(update);
        }
    };

    ydoc.on("update", updateHandler);

    return {
        ydoc,
        ws,

        identify(userObj) {
            if (ws.readyState === WebSocket.OPEN && userObj && userObj.userId) {
                ws.send(JSON.stringify({
                    type: "presence:identify",
                    user: userObj
                }));
            }
        },

        acquireBlockLock(blockId) {
            if (ws.readyState === WebSocket.OPEN && blockId) {
                ws.send(JSON.stringify({
                    type: "lock:acquire",
                    blockId
                }));
            }
        },

        releaseBlockLock(blockId) {
            if (ws.readyState === WebSocket.OPEN && blockId) {
                ws.send(JSON.stringify({
                    type: "lock:release",
                    blockId
                }));
            }
        },

        refreshBlockLock(blockId) {
            if (ws.readyState === WebSocket.OPEN && blockId) {
                ws.send(JSON.stringify({
                    type: "lock:refresh",
                    blockId
                }));
            }
        },

        /**
         * Close WebSocket and destroy local Y.Doc.
         */
        disconnect() {
            ydoc.off("update", updateHandler);

            if (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
            ) {
                ws.close();
            }

            ydoc.destroy();
        }
    };
};