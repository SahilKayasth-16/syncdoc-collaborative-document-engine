import { createContext, useContext, useState, useCallback } from "react";

/**
 * Minimal Local Editor State Context
 * 
 * Tracks local block focus, cursor position, and text selection bounds.
 * STRICT ARCHITECTURE RULE: Completely decoupled from Yjs / CRDT collaboration state.
 */
const EditorContext = createContext(null);

export const EditorProvider = ({ children, updateASTNode }) => {
    const [activeBlockId, setActiveBlockId] = useState(null);

    const [cursor, setCursorState] = useState({
        blockId: null,
        offset: 0
    });

    const [selection, setSelectionState] = useState({
        start: null,
        end: null
    });

    /**
     * Set the currently active block ID.
     */
    const setActiveBlock = useCallback((blockId) => {
        const normalizedId = blockId ? String(blockId) : null;
        setActiveBlockId(normalizedId);
    }, []);

    /**
     * Update local cursor position inside a block.
     */
    const setCursor = useCallback((blockId, offset = 0) => {
        const normalizedId = blockId ? String(blockId) : null;
        const normalizedOffset = Math.max(0, Number(offset) || 0);

        setCursorState({
            blockId: normalizedId,
            offset: normalizedOffset
        });
    }, []);

    /**
     * Update selection boundaries for active block selection.
     */
    const setSelection = useCallback((startObj, endObj) => {
        if (!startObj || !endObj) {
            setSelectionState({ start: null, end: null });
            return;
        }

        setSelectionState({
            start: {
                blockId: startObj.blockId ? String(startObj.blockId) : null,
                offset: Math.max(0, Number(startObj.offset) || 0)
            },
            end: {
                blockId: endObj.blockId ? String(endObj.blockId) : null,
                offset: Math.max(0, Number(endObj.offset) || 0)
            }
        });
    }, []);

    /**
     * Reset/clear selection boundaries.
     */
    const clearSelection = useCallback(() => {
        setSelectionState({ start: null, end: null });
    }, []);

    const value = {
        activeBlockId,
        cursor,
        selection,
        setActiveBlock,
        setCursor,
        setSelection,
        clearSelection,
        updateASTNode
    };

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};

/**
 * Hook to access local editor state and actions.
 */
export const useEditorContext = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error("useEditorContext must be used within an EditorProvider");
    }
    return context;
};

export default EditorContext;
