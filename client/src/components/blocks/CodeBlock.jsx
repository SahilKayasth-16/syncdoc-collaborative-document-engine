import { useRef, useEffect } from "react";
import { sanitizePlainText } from "../../utils/sanitizer";

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
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { language, content: sanitizedText }
            });
        }
    };

    const handleBlur = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        if (codeRef.current) {
            codeRef.current.innerText = sanitizedText || content;
        }
    };

    return (
        <pre className="code-block">
            <code
                ref={codeRef}
                contentEditable={!isLockedByOther}
                suppressContentEditableWarning={true}
                onInput={handleInput}
                onBlur={handleBlur}
                data-language={language}
            />
        </pre>
    );
};

export default CodeBlock;