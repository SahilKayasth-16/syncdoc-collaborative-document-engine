import Block from "./Block";
import { useEditorContext } from "../../context/EditorContext";

const BlockList = ({
    nodes = [],
    blockLocks = [],
    remoteCursors = [],
    collaborationInstance = null,
    currentUser = null,
    onAcquireLock,
    onReleaseLock
}) => {
    const { activeBlockId, selection, updateASTNode } = useEditorContext();

    if (nodes.length === 0) {
        return (
            <div className="editor-empty-state" id="editor-empty-blocks">
                <p>This document is empty. No child blocks exist in the AST root.</p>
            </div>
        );
    }

    return (
        <div className="block-list" id="editor-block-list">
            {nodes.map((node) => {
                const blockId = (node.id || node._id)?.toString();
                const currentLock = blockLocks.find((l) => l.blockId === blockId);

                const blockRemoteCursors = remoteCursors.filter(
                    (c) => c.blockId === blockId && (!currentUser || c.userId !== currentUser.userId)
                );

                const isLockedByOther = Boolean(
                    currentLock && (!currentUser || currentLock.userId !== currentUser.userId)
                );
                const isLockedBySelf = Boolean(
                    currentLock && currentUser && currentLock.userId === currentUser.userId
                );

                const isActive = activeBlockId === blockId;

                let isSelected = false;
                if (selection?.start && selection?.end) {
                    const sBlock = selection.start.blockId;
                    const eBlock = selection.end.blockId;
                    if (sBlock === blockId || eBlock === blockId) {
                        if (sBlock === eBlock) {
                            isSelected = selection.start.offset !== selection.end.offset;
                        } else {
                            isSelected = true;
                        }
                    }
                }

                return (
                    <Block
                        key={blockId}
                        node={node}
                        blockId={blockId}
                        isActive={isActive}
                        isSelected={isSelected}
                        isLockedByOther={isLockedByOther}
                        isLockedBySelf={isLockedBySelf}
                        currentLock={currentLock}
                        remoteCursors={blockRemoteCursors}
                        collaborationInstance={collaborationInstance}
                        currentUser={currentUser}
                        onAcquireLock={onAcquireLock}
                        onReleaseLock={onReleaseLock}
                        updateASTNode={updateASTNode}
                    />
                );
            })}
        </div>
    );
};

export default BlockList;