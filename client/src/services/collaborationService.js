import * as Y from "yjs";

const WS_BASE_URL = "ws://localhost:5050";

export const createCollaborationConnection = (
    documentId,
    callbacks = {}
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
    };

    /**
     * Receive Yjs updates from the server.
     */
    ws.onmessage = async (event) => {
        try {
            /**
             * Ignore non-Yjs messages such as the
             * Day 8 "connected" JSON message.
             */
            if (typeof event.data === "string") {
                try {
                    const message = JSON.parse(event.data);

                    callbacks.onMessage?.(message);

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