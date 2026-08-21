import Block from "./Block";

const BlockList = ({
    nodes = [],
    blockLocks = [],
    currentUser = null,
    onAcquireLock,
    onReleaseLock
}) => {
    if (nodes.length === 0) {
        return (
            <div className="editor-empty-state" id="editor-empty-blocks">
                <p>This document is empty. No child blocks exist in the AST root.</p>
            </div>
        );
    }

    return (
        <div className="block-list" id="editor-block-list">
            {nodes.map((node) => (
                <Block
                    key={node.id || node._id}
                    node={node}
                    blockLocks={blockLocks}
                    currentUser={currentUser}
                    onAcquireLock={onAcquireLock}
                    onReleaseLock={onReleaseLock}
                />
            ))}
        </div>
    );
};

export default BlockList;