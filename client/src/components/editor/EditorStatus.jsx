import { useEditorContext } from "../../context/EditorContext";

const EditorStatus = ({ collaborationStatus = "connecting" }) => {
    const { activeBlockId, cursor, selection } = useEditorContext();

    const formatOffset = (val) => (val !== null && val !== undefined ? val : "-");

    const hasSelection =
        selection?.start?.offset !== null &&
        selection?.end?.offset !== null &&
        selection?.start?.offset !== selection?.end?.offset;

    return (
        <div className="editor-status" id="editor-status-bar">
            <div className="status-metrics">
                <span className="status-item" id="status-active-block">
                    <strong className="status-label">Active Block:</strong>{" "}
                    {activeBlockId ? (
                        <code className="status-value">{activeBlockId}</code>
                    ) : (
                        <span className="status-none">None</span>
                    )}
                </span>

                <span className="status-divider">|</span>

                <span className="status-item" id="status-cursor-position">
                    <strong className="status-label">Cursor Offset:</strong>{" "}
                    {cursor.blockId ? (
                        <span className="status-value">{formatOffset(cursor.offset)}</span>
                    ) : (
                        <span className="status-none">-</span>
                    )}
                </span>

                <span className="status-divider">|</span>

                <span className="status-item" id="status-selection-bounds">
                    <strong className="status-label">Selection:</strong>{" "}
                    {hasSelection ? (
                        <span className="status-value">
                            {selection.start.offset} → {selection.end.offset}
                        </span>
                    ) : (
                        <span className="status-none">None</span>
                    )}
                </span>
            </div>

            <div className="status-collab">
                <span className="status-divider">|</span>
                <span className={`collab-indicator collab-${collaborationStatus}`}>
                    <span className="dot"></span>
                    {collaborationStatus === "connected" ? "Live Collab" : collaborationStatus}
                </span>
            </div>
        </div>
    );
};

export default EditorStatus;