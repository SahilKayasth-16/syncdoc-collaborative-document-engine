import { useRef } from "react";
import BlockRenderer from "./BlockRenderer";
import { useEditorContext } from "../../context/EditorContext";

const Block = ({
    node,
    blockLocks = [],
    currentUser = null,
    onAcquireLock,
    onReleaseLock
}) => {
    const blockRef = useRef(null);
    const { activeBlockId, setActiveBlock, setCursor, setSelection } = useEditorContext();

    const blockId = (node?.id || node?._id)?.toString();
    const currentLock = blockLocks.find((l) => l.blockId === blockId);

    const isLockedByOther =
        currentLock && (!currentUser || currentLock.userId !== currentUser.userId);
    const isLockedBySelf =
        currentLock && currentUser && currentLock.userId === currentUser.userId;

    const isActive = activeBlockId === blockId;

    const updateSelectionAndCursor = () => {
        if (!blockId || !blockRef.current) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        // Verify selection is within this block container
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
        setSelection(
            { blockId, offset: minOffset },
            { blockId, offset: maxOffset }
        );
    };

    const handleBlockClick = () => {
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
            className={`editor-block ${isActive ? "active-block" : ""} ${isLockedByOther ? "block-locked-by-other" : ""} ${isLockedBySelf ? "block-locked-by-self" : ""}`}
            data-block-id={blockId}
        >
            <div className="block-lock-toolbar">
                {isLockedByOther && (
                    <div className="block-lock-banner lock-banner-other">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span>Currently edited by <strong>{currentLock.name}</strong></span>
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
            <div className={`block-content-wrapper ${isLockedByOther ? "disabled-block" : ""}`}>
                <BlockRenderer node={node} />
            </div>
        </div>
    );
};

export default Block;