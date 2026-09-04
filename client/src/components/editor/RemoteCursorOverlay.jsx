import React from "react";

/**
 * RemoteCursorOverlay
 *
 * Renders visual remote caret tags and selection ranges for collaborators
 * occupying a given block.
 *
 * Ephemeral & Visual-Only: Does NOT mutate AST, DOM content, or MongoDB persistence.
 */
const RemoteCursorOverlay = ({ remoteCursors = [] }) => {
    if (!remoteCursors || remoteCursors.length === 0) return null;

    return (
        <div
            className="remote-cursors-layer"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
                marginTop: "0.35rem",
                pointerEvents: "none",
                zIndex: 10
            }}
        >
            {remoteCursors.map((cursor) => {
                const key = `cursor-${cursor.userId}-${cursor.blockId}`;
                const color = cursor.color || "#3B82F6";
                const hasSelection =
                    cursor.startOffset !== undefined &&
                    cursor.endOffset !== undefined &&
                    cursor.startOffset !== cursor.endOffset;

                return (
                    <div
                        key={key}
                        className="remote-cursor-pill"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: color,
                            color: "#FFFFFF",
                            fontSize: "0.725rem",
                            fontWeight: "600",
                            letterSpacing: "0.01em",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                            pointerEvents: "auto"
                        }}
                    >
                        <span
                            style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: "#FFFFFF",
                                display: "inline-block"
                            }}
                        />
                        <span>{cursor.name || `User ${cursor.userId}`}</span>
                        <span style={{ opacity: 0.85, fontSize: "0.675rem", fontWeight: "400" }}>
                            offset {cursor.offset}
                            {hasSelection ? ` (sel ${cursor.startOffset}-${cursor.endOffset})` : ""}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default RemoteCursorOverlay;

