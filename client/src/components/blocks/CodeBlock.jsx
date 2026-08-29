import { useRef, useEffect } from "react";

const CodeBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const language = node?.data?.language || "text";
    const content = node?.data?.content || "";
    const codeRef = useRef(null);

    useEffect(() => {
        if (codeRef.current && document.activeElement !== codeRef.current) {
            codeRef.current.innerText = content;
        }
    }, [content]);

    const handleInput = (e) => {
        const newText = e.currentTarget.innerText || "";
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { language, content: newText }
            });
        }
    };

    return (
        <pre className="code-block">
            <code
                ref={codeRef}
                contentEditable={!isLockedByOther}
                suppressContentEditableWarning={true}
                onInput={handleInput}
                data-language={language}
            />
        </pre>
    );
};

export default CodeBlock;