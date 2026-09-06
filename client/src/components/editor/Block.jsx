import React, { useRef, useCallback } from "react";
import BlockRenderer from "./BlockRenderer";
import RemoteCursorOverlay from "./RemoteCursorOverlay";
import { useEditorContext } from "../../context/EditorContext";

const Block = React.memo(
    ({
        node,
        blockId,
        isActive,
        isSelected,
        isLockedByOther,
        isLockedBySelf,
        currentLock,
        remoteCursors = [],
        currentUser,
        onAcquireLock,
        onReleaseLock,
        onSendCursor,
        updateASTNode
    }) => {
        // Diagnostic render logging to verify targeted re-rendering (Requirement 16)
        console.log("[Block] Render:", blockId);

        const blockRef = useRef(null);
        const { setActiveBlock, setCursor, setSelection } = useEditorContext();

        /**
         * Calculates character offset position reliably inside editable block content
         * and broadcasts local cursor position to remote collaborators via WebSocket.
         */
        const updateSelectionAndCursor = useCallback(() => {
            if (!blockId || !blockRef.current) return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            if (!blockRef.current.contains(sel.anchorNode)) return;

            const computeOffset = (targetNode, targetOffset) => {
                try {
                    const range = document.createRange();
                    range.setStart(blockRef.current, 0);
                    range.setEnd(targetNode, targetOffset);
                    return range.toString().length;
                } catch {
                    return 0;
                }
            };

            const startPos = computeOffset(sel.anchorNode, sel.anchorOffset);
            const endPos = computeOffset(sel.focusNode, sel.focusOffset);

            const minOffset = Math.min(startPos, endPos);
            const maxOffset = Math.max(startPos, endPos);

            setCursor(blockId, endPos);

            if (minOffset !== maxOffset) {
                setSelection(
                    { blockId, offset: minOffset },
                    { blockId, offset: maxOffset }
                );
            } else {
                setSelection(null, null);
            }

            onSendCursor?.({
                blockId,
                offset: endPos,
                startOffset: minOffset,
                endOffset: maxOffset
            });
        }, [blockId, setCursor, setSelection, onSendCursor]);

        const handleBlockClick = (e) => {
            if (blockId) {
                setActiveBlock(blockId);
                updateSelectionAndCursor();
            }
        };

        return (
            <div
                ref={blockRef}
                onClick={handleBlockClick}
                onKeyUp={updateSelectionAndCursor}
                onMouseUp={updateSelectionAndCursor}
                className={`editor-block ${isActive ? "active-block" : ""} ${isSelected ? "selected-block" : ""} ${isLockedByOther ? "block-locked-by-other" : ""} ${isLockedBySelf ? "block-locked-by-self" : ""}`}
                style={{ position: "relative" }}
                data-block-id={blockId}
            >
                {/* Remote Caret & Selection Overlay */}
                <RemoteCursorOverlay blockRef={blockRef} remoteCursors={remoteCursors} />

                {/* Block Lock Toolbar */}
                <div className="block-lock-toolbar">
                    {isLockedByOther && (
                        <div className="block-lock-banner lock-banner-other">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>Currently edited by <strong>{currentLock?.name || "another user"}</strong></span>
                        </div>
                    )}
                    {isLockedBySelf && (
                        <div className="block-lock-banner lock-banner-self">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>Locked by you</span>
                            <button
                                type="button"
                                className="btn-lock-action btn-release-lock"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReleaseLock?.(blockId);
                                }}
                            >
                                Release Lock
                            </button>
                        </div>
                    )}
                    {!currentLock && (
                        <div className="block-lock-banner lock-banner-available">
                            <button
                                type="button"
                                className="btn-lock-action btn-acquire-lock"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAcquireLock?.(blockId);
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                Lock Block
                            </button>
                        </div>
                    )}
                </div>

                {/* Block Content */}
                <div className={`block-content-wrapper ${isLockedByOther ? "disabled-block" : ""}`}>
                    <BlockRenderer
                        node={node}
                        isLockedByOther={isLockedByOther}
                        updateASTNode={updateASTNode}
                    />
                </div>
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.node === nextProps.node &&
            prevProps.isActive === nextProps.isActive &&
            prevProps.isSelected === nextProps.isSelected &&
            prevProps.isLockedByOther === nextProps.isLockedByOther &&
            prevProps.isLockedBySelf === nextProps.isLockedBySelf &&
            prevProps.currentLock === nextProps.currentLock &&
            prevProps.remoteCursors === nextProps.remoteCursors &&
            prevProps.currentUser === nextProps.currentUser
        );
    }
);

export default Block;