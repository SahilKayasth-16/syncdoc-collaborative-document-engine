import * as Y from "yjs";

const WS_BASE_URL = "ws://localhost:5050";

export const createCollaborationConnection = (documentId, callbacks = {}) => {
    const ydoc = new Y.Doc();

    const ws = new WebSocket(`${WS_BASE_URL}/ws/documents/${documentId}`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
        callbacks.onOpen?.();
    };

    ws.onmessage = (event) => {
        const update  = new Uint8Array(event.data);

        Y.applyUpdate(ydoc, update);

        callbacks.onUpdate?.(ydoc);
    };

    ws.onerror = (event) => {
        callbacks.onError?.(error);
    };

    ws.onclose = () => {
        callbacks.onclose?.();
    };

    const updateHandler = (update, origin) => {
        if (origin === "remote") {
            return;
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(update);
        }
    };

    ydoc.on("update", updateHanlder);

    return {
        ydoc,
        ws,

        disconnect() {
            ydoc.off("update", updateHandler);
            ws.close();
            ydoc.destroy();
        }
    };
};