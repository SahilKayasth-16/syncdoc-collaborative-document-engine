import { useRef, useEffect } from "react";

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
        const newText = e.currentTarget.innerText || "";
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { content: newText, author }
            });
        }
    };

    return (
        <blockquote className="quote-block">
            <p
                ref={pRef}
                contentEditable={!isLockedByOther}
                suppressContentEditableWarning={true}
                onInput={handleInput}
            >
                {content}
            </p>
            {author && <cite className="quote-author">— {author}</cite>}
        </blockquote>
    );
};

export default QuoteBlock;