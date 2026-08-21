import BlockRenderer from "./BlockRenderer";

const Block = ({
    node,
    blockLocks = [],
    currentUser = null,
    onAcquireLock,
    onReleaseLock
}) => {
    const blockId = (node?.id || node?._id)?.toString();
    const currentLock = blockLocks.find((l) => l.blockId === blockId);

    const isLockedByOther =
        currentLock && (!currentUser || currentLock.userId !== currentUser.userId);
    const isLockedBySelf =
        currentLock && currentUser && currentLock.userId === currentUser.userId;

    return (
        <div className={`editor-block ${isLockedByOther ? "block-locked-by-other" : ""} ${isLockedBySelf ? "block-locked-by-self" : ""}`}>
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
                            onClick={() => onReleaseLock?.(blockId)}
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
                            onClick={() => onAcquireLock?.(blockId)}
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