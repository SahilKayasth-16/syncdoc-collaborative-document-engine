import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import EditorHeader from "./EditorHeader";
import BlockList from "./BlockList";
import EditorStatus from "./EditorStatus";
import { EditorProvider } from "../../context/EditorContext";

import { getDocumentTree } from "../../services/documentService";
import { createCollaborationConnection } from "../../services/collaborationService";

const Editor = ({ documentId }) => {
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [collaborationStatus, setCollaborationStatus] = useState(
        "connecting"
    );

    const [activeUsers, setActiveUsers] = useState([]);
    const [blockLocks, setBlockLocks] = useState([]);

    const [currentUser] = useState(() => {
        const id = Math.floor(100 + Math.random() * 900);
        return {
            userId: `user-${id}`,
            name: `User ${String.fromCharCode(65 + (id % 26))}`
        };
    });

    const [collaborationInstance, setCollaborationInstance] = useState(null);

    useEffect(() => {
        if (!documentId) {
            setError("Document ID is required.");
            setLoading(false);
            return;
        }

        let collaboration = null;
        let cancelled = false;

        const loadDocument = async () => {
            try {
                setLoading(true);
                setError("");

                /**
                 * STEP 1
                 * Load the initial document + AST through REST API.
                 */
                const data = await getDocumentTree(documentId);

                if (!cancelled) {
                    setDocument(data);
                }

                /**
                 * STEP 2
                 * Connect to the collaboration room through WebSocket.
                 *
                 * This creates a client-side Y.Doc.
                 */
                collaboration = createCollaborationConnection(
                    documentId,
                    {
                        onOpen: () => {
                            if (!cancelled) {
                                setCollaborationStatus("connected");
                            }

                            console.log(
                                `[Editor] Connected to collaboration room: ${documentId}`
                            );
                        },

                        onPresenceUpdate: (users) => {
                            if (!cancelled) {
                                setActiveUsers(users);
                            }
                        },

                        onLocksUpdate: (locks) => {
                            if (!cancelled) {
                                setBlockLocks(locks);
                            }
                        },

                        onUpdate: (ydoc) => {
                            if (cancelled) {
                                return;
                            }

                            try {
                                const documentMap = ydoc.getMap("document");
                                const blocksArray = documentMap.get("blocks") || ydoc.getArray("blocks");
                                if (!blocksArray) return;

                                const rawYBlocks = typeof blocksArray.toArray === "function"
                                    ? blocksArray.toArray()
                                    : Array.from(blocksArray);

                                const yNodesMap = new Map();
                                rawYBlocks.forEach((yBlock) => {
                                    let id, type, position, data;
                                    if (typeof yBlock?.get === "function") {
                                        id = yBlock.get("id");
                                        type = yBlock.get("type");
                                        position = yBlock.get("position");
                                        data = yBlock.get("data");
                                    } else {
                                        id = yBlock?.id || yBlock?._id;
                                        type = yBlock?.type;
                                        position = yBlock?.position;
                                        data = yBlock?.data;
                                    }

                                    if (data && typeof data.toJSON === "function") {
                                        data = data.toJSON();
                                    }

                                    if (id) {
                                        yNodesMap.set(id.toString(), {
                                            id: id.toString(),
                                            type: type || "paragraph",
                                            position: Number.isFinite(Number(position)) ? Number(position) : 0,
                                            data: data && typeof data === "object" ? data : {}
                                        });
                                    }
                                });

                                setDocument((prevDoc) => {
                                    if (!prevDoc || !prevDoc.root || !prevDoc.root.children) return prevDoc;

                                    let hasChanged = false;
                                    const updatedChildren = prevDoc.root.children.map((child) => {
                                        const childId = (child.id || child._id)?.toString();
                                        const yNode = yNodesMap.get(childId);

                                        if (yNode) {
                                            const dataChanged = JSON.stringify(child.data) !== JSON.stringify(yNode.data);
                                            const typeChanged = child.type !== yNode.type;
                                            const posChanged = child.position !== yNode.position;

                                            if (dataChanged || typeChanged || posChanged) {
                                                hasChanged = true;
                                                return {
                                                    ...child,
                                                    type: yNode.type,
                                                    position: yNode.position,
                                                    data: {
                                                        ...(child.data || {}),
                                                        ...(yNode.data || {})
                                                    }
                                                };
                                            }
                                        }
                                        return child;
                                    });

                                    if (!hasChanged) return prevDoc;

                                    return {
                                        ...prevDoc,
                                        root: {
                                            ...prevDoc.root,
                                            children: updatedChildren
                                        }
                                    };
                                });
                            } catch (err) {
                                console.error("[Editor] Error handling remote Yjs update:", err);
                            }
                        },

                        onError: (err) => {
                            console.error(
                                "[Editor] Collaboration error:",
                                err
                            );

                            if (!cancelled) {
                                setCollaborationStatus("error");
                            }
                        },

                        onClose: () => {
                            if (!cancelled) {
                                setCollaborationStatus("disconnected");
                            }

                            console.log(
                                `[Editor] Collaboration disconnected: ${documentId}`
                            );
                        }
                    },
                    currentUser
                );

                if (!cancelled) {
                    setCollaborationInstance(collaboration);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(
                        "Failed to load document:",
                        err
                    );

                    setError(
                        err.message ||
                        "Failed to load document."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadDocument();

        /**
         * Cleanup:
         *
         * When the user leaves the editor or documentId changes,
         * close the WebSocket and destroy the client Y.Doc.
         */
        return () => {
            cancelled = true;

            if (collaboration) {
                collaboration.disconnect();
                collaboration = null;
                setCollaborationInstance(null);
            }
        };
    }, [documentId, currentUser]);

    const handleAcquireLock = (blockId) => {
        if (collaborationInstance) {
            collaborationInstance.acquireBlockLock(blockId);
        }
    };

    const handleReleaseLock = (blockId) => {
        if (collaborationInstance) {
            collaborationInstance.releaseBlockLock(blockId);
        }
    };

    /**
     * Targeted update of a specific AST node in state.
     * Keeps unchanged sibling nodes' references intact to prevent unnecessary re-renders.
     */
    const updateASTNode = useCallback((blockId, patch) => {
        if (!blockId || !patch) return;
        const normalizedId = blockId.toString();

        setDocument((prevDoc) => {
            if (!prevDoc || !prevDoc.root || !prevDoc.root.children) return prevDoc;

            let hasChanged = false;
            const updatedChildren = prevDoc.root.children.map((child) => {
                const childId = (child.id || child._id)?.toString();
                if (childId === normalizedId) {
                    hasChanged = true;
                    return {
                        ...child,
                        ...patch,
                        data: {
                            ...(child.data || {}),
                            ...(patch.data || {})
                        }
                    };
                }
                return child;
            });

            if (!hasChanged) return prevDoc;

            return {
                ...prevDoc,
                root: {
                    ...prevDoc.root,
                    children: updatedChildren
                }
            };
        });

        if (collaborationInstance && collaborationInstance.updateBlockData) {
            collaborationInstance.updateBlockData(normalizedId, patch);
        }
    }, [collaborationInstance]);

    if (loading) {
        return (
            <div
                className="editor-container"
                id="editor-container"
            >
                <div
                    className="editor-loading"
                    id="editor-loading-state"
                >
                    <div className="spinner"></div>
                    <p>Loading document AST...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="editor-container"
                id="editor-container"
            >
                <div
                    className="editor-error"
                    id="editor-error-state"
                >
                    <div className="error-icon-wrapper">
                        <svg
                            width="36"
                            height="36"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                            ></circle>

                            <line
                                x1="12"
                                y1="8"
                                x2="12"
                                y2="12"
                            ></line>

                            <line
                                x1="12"
                                y1="16"
                                x2="12.01"
                                y2="16"
                            ></line>
                        </svg>
                    </div>

                    <h2>Unable to load document</h2>

                    <p>{error}</p>

                    <Link
                        to="/documents"
                        className="btn btn-primary"
                        style={{ marginTop: "1.25rem" }}
                    >
                        Return to Documents
                    </Link>
                </div>
            </div>
        );
    }

    if (!document) {
        return (
            <div
                className="editor-container"
                id="editor-container"
            >
                <div
                    className="editor-error"
                    id="editor-not-found-state"
                >
                    <h2>Document not found</h2>

                    <p>
                        The requested document could not be
                        retrieved from the server.
                    </p>

                    <Link
                        to="/documents"
                        className="btn btn-primary"
                        style={{ marginTop: "1.25rem" }}
                    >
                        Return to Documents
                    </Link>
                </div>
            </div>
        );
    }

    const nodes = document.root?.children || [];

    return (
        <EditorProvider updateASTNode={updateASTNode}>
            <div
                className="editor-container"
                id="editor-container"
            >
                <div className="editor">
                    <EditorHeader
                        title={document.title}
                        activeUsers={activeUsers}
                        currentUser={currentUser}
                    />

                    <main className="editor-canvas">
                        <BlockList
                            nodes={nodes}
                            blockLocks={blockLocks}
                            currentUser={currentUser}
                            onAcquireLock={handleAcquireLock}
                            onReleaseLock={handleReleaseLock}
                        />
                    </main>

                    <EditorStatus
                        collaborationStatus={collaborationStatus}
                    />
                </div>
            </div>
        </EditorProvider>
    );
};

export default Editor;