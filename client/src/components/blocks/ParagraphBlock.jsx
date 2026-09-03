import { useRef, useEffect } from "react";
import { sanitizePlainText } from "../../utils/sanitizer";

const ParagraphBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const content = node?.data?.content || "";
    const pRef = useRef(null);

    useEffect(() => {
        if (pRef.current && document.activeElement !== pRef.current) {
            pRef.current.innerText = content;
        }
    }, [content]);

    const handleInput = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { content: sanitizedText }
            });
        }
    };

    const handleBlur = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        if (pRef.current) {
            pRef.current.innerText = sanitizedText || content;
        }
    };

    return (
        <p
            ref={pRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={handleInput}
            onBlur={handleBlur}
            className="paragraph-block"
        />
    );
};

export default ParagraphBlock;