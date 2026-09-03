import { useRef, useEffect } from "react";
import { sanitizePlainText } from "../../utils/sanitizer";

const ListBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const style = node?.data?.style || "unordered";
    const items = node?.data?.items || [];
    const isOrdered = style === "ordered";
    const ListTag = isOrdered ? "ol" : "ul";

    const handleItemInput = (index, rawText) => {
        const sanitizedText = sanitizePlainText(rawText);
        const newItems = [...items];
        newItems[index] = sanitizedText;
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: { style, items: newItems }
            });
        }
    };

    return (
        <ListTag className={`list-block ${isOrdered ? "list-ordered" : "list-unordered"}`}>
            {items.map((item, index) => {
                const textValue = typeof item === "string" ? item : item?.content || item?.text || "";
                return (
                    <ListItem
                        key={index}
                        index={index}
                        item={textValue}
                        isLockedByOther={isLockedByOther}
                        onInput={handleItemInput}
                    />
                );
            })}
        </ListTag>
    );
};

const ListItem = ({ index, item, isLockedByOther, onInput }) => {
    const liRef = useRef(null);

    useEffect(() => {
        if (liRef.current && document.activeElement !== liRef.current) {
            liRef.current.innerText = item;
        }
    }, [item]);

    const handleBlur = (e) => {
        const rawText = e.currentTarget.innerText || "";
        const sanitizedText = sanitizePlainText(rawText);
        if (liRef.current) {
            liRef.current.innerText = sanitizedText || item;
        }
    };

    return (
        <li
            ref={liRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={(e) => onInput(index, e.currentTarget.innerText || "")}
            onBlur={handleBlur}
        />
    );
};

export default ListBlock;