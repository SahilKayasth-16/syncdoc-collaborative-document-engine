import { useRef, useEffect } from "react";

const ParagraphBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const content = node?.data?.content || "";
    const pRef = useRef(null);

    useEffect(() => {
        if (pRef.current && document.activeElement !== pRef.current) {
            pRef.current.innerText = content;
        }
    }, [content]);

    const handleInput = (e) => {
        const newText = e.currentTarget.innerText || "";
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { content: newText }
            });
        }
    };

    return (
        <p
            ref={pRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={handleInput}
            className="paragraph-block"
        />
    );
};

export default ParagraphBlock;