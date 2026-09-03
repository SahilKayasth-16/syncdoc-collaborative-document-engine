import { useRef, useEffect } from "react";
import { sanitizePlainText } from "../../utils/sanitizer";

const HeadingBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const level = node?.data?.level || 1;
    const content = node?.data?.content || "";
    const headingRef = useRef(null);

    const HeadingTag = `h${Math.min(Math.max(level, 1), 6)}`;

    useEffect(() => {
        if (headingRef.current && document.activeElement !== headingRef.current) {
            headingRef.current.innerText = content;
        }
    }, [content]);

    const handleInput = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { level, content: sanitizedText }
            });
        }
    };

    const handleBlur = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        if (headingRef.current) {
            headingRef.current.innerText = sanitizedText || content;
        }
    };

    return (
        <HeadingTag
            ref={headingRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={handleInput}
            onBlur={handleBlur}
            className="heading-block"
        />
    );
};

export default HeadingBlock;