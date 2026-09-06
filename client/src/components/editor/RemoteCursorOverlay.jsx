import React, { useState, useEffect } from "react";

function getNodeAndOffsetAtCharacterOffset(parent, targetOffset) {
    if (!parent) return null;
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null, false);
    let currentOffset = 0;
    let node = walker.nextNode();
    let lastNode = null;

    while (node) {
        lastNode = node;
        const len = node.nodeValue.length;
        if (currentOffset + len >= targetOffset) {
            return { node, offset: Math.max(0, targetOffset - currentOffset) };
        }
        currentOffset += len;
        node = walker.nextNode();
    }

    if (lastNode) {
        return { node: lastNode, offset: lastNode.nodeValue.length };
    }

    return null;
}

function getCaretRect(container, offset) {
    if (!container) return null;
    const target = getNodeAndOffsetAtCharacterOffset(container, offset);
    const containerRect = container.getBoundingClientRect();

    if (!target) {
        return { top: 0, left: 0, height: 20 };
    }

    try {
        const range = document.createRange();
        range.setStart(target.node, target.offset);
        range.setEnd(target.node, target.offset);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
            return { top: 0, left: 0, height: 20 };
        }

        return {
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            height: rect.height || 20
        };
    } catch {
        return { top: 0, left: 0, height: 20 };
    }
}

function getSelectionRects(container, startOffset, endOffset) {
    if (!container || startOffset === undefined || endOffset === undefined || startOffset === endOffset) {
        return [];
    }
    const startTarget = getNodeAndOffsetAtCharacterOffset(container, Math.min(startOffset, endOffset));
    const endTarget = getNodeAndOffsetAtCharacterOffset(container, Math.max(startOffset, endOffset));

    if (!startTarget || !endTarget) return [];

    const containerRect = container.getBoundingClientRect();

    try {
        const range = document.createRange();
        range.setStart(startTarget.node, startTarget.offset);
        range.setEnd(endTarget.node, endTarget.offset);
        const clientRects = range.getClientRects();

        const rects = [];
        for (let i = 0; i < clientRects.length; i++) {
            const r = clientRects[i];
            rects.push({
                top: r.top - containerRect.top,
                left: r.left - containerRect.left,
                width: r.width,
                height: r.height
            });
        }
        return rects;
    } catch {
        return [];
    }
}

function hexToRgba(hex, alpha = 0.25) {
    if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return `rgba(59, 130, 246, ${alpha})`;
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const RemoteCursorOverlay = ({ blockRef, remoteCursors = [] }) => {
    const [computedPositions, setComputedPositions] = useState([]);

    useEffect(() => {
        if (!blockRef || !blockRef.current || remoteCursors.length === 0) {
            setComputedPositions([]);
            return;
        }

        const updatePositions = () => {
            if (!blockRef.current) return;
            const container = blockRef.current;

            const positions = remoteCursors.map((cursor) => {
                const caretRect = getCaretRect(container, cursor.offset ?? 0);
                const selRects = getSelectionRects(container, cursor.startOffset, cursor.endOffset);

                return {
                    cursor,
                    caretRect,
                    selRects
                };
            });

            setComputedPositions(positions);
        };

        updatePositions();

        // Also update on window resize
        window.addEventListener("resize", updatePositions);
        return () => window.removeEventListener("resize", updatePositions);
    }, [blockRef, remoteCursors]);

    if (remoteCursors.length === 0 || computedPositions.length === 0) {
        return null;
    }

    return (
        <div className="remote-cursor-overlay-container" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}>
            {computedPositions.map(({ cursor, caretRect, selRects }) => {
                const userColor = cursor.color || "#3B82F6";
                const selectionBg = hexToRgba(userColor, 0.25);

                return (
                    <React.Fragment key={cursor.userId}>
                        {/* Remote Selection Rectangles */}
                        {selRects.map((rect, idx) => (
                            <div
                                key={`sel-${cursor.userId}-${idx}`}
                                className="remote-selection-highlight"
                                style={{
                                    position: "absolute",
                                    top: `${rect.top}px`,
                                    left: `${rect.left}px`,
                                    width: `${rect.width}px`,
                                    height: `${rect.height}px`,
                                    backgroundColor: selectionBg,
                                    pointerEvents: "none"
                                }}
                            />
                        ))}

                        {/* Remote Caret Line & Label */}
                        {caretRect && (
                            <div
                                className="remote-caret-wrapper"
                                style={{
                                    position: "absolute",
                                    top: `${caretRect.top}px`,
                                    left: `${caretRect.left}px`,
                                    pointerEvents: "none"
                                }}
                            >
                                <div
                                    className="remote-caret-line"
                                    style={{
                                        width: "2px",
                                        height: `${caretRect.height}px`,
                                        backgroundColor: userColor
                                    }}
                                />
                                <div
                                    className="remote-cursor-pill"
                                    style={{
                                        position: "absolute",
                                        top: "-18px",
                                        left: "0px",
                                        backgroundColor: userColor,
                                        color: "#FFFFFF",
                                        fontSize: "10px",
                                        fontWeight: "600",
                                        padding: "1px 4px",
                                        borderRadius: "3px",
                                        whiteSpace: "nowrap",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                                    }}
                                >
                                    {cursor.name || cursor.userId}
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default RemoteCursorOverlay;

