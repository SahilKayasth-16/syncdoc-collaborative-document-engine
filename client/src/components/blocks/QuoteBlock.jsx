import { useRef, useEffect } from "react";
import { sanitizePlainText } from "../../utils/sanitizer";

const QuoteBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const content = node?.data?.content || "";
    const author = node?.data?.author;
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
                data: { content: sanitizedText, author }
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
        <blockquote className="quote-block">
            <p
                ref={pRef}
                contentEditable={!isLockedByOther}
                suppressContentEditableWarning={true}
                onInput={handleInput}
                onBlur={handleBlur}
            />
            {author && <cite className="quote-author">— {author}</cite>}
        </blockquote>
    );
};

export default QuoteBlock;