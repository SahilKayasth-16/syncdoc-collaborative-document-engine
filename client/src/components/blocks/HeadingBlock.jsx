import { useRef, useEffect } from "react";

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
        const newText = e.currentTarget.innerText || "";
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { level, content: newText }
            });
        }
    };

    return (
        <HeadingTag
            ref={headingRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={handleInput}
            className="heading-block"
        />
    );
};

export default HeadingBlock;