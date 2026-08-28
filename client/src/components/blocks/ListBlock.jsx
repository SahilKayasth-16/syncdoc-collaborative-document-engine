import { useRef, useEffect } from "react";

const ListBlock = ({ node, isLockedByOther, updateASTNode }) => {
    const items = node?.data?.items || [];
    const isOrdered = node?.data?.style === "ordered";
    const ListTag = isOrdered ? "ol" : "ul";

    const handleItemInput = (index, newText) => {
        const newItems = [...items];
        newItems[index] = newText;
        const blockId = (node?.id || node?._id)?.toString();
        if (blockId && updateASTNode) {
            updateASTNode(blockId, {
                data: {
                    style: node?.data?.style || "unordered",
                    items: newItems
                }
            });
        }
    };

    return (
        <ListTag className={`list-block ${isOrdered ? "list-ordered" : "list-unordered"}`}>
            {items.map((item, index) => (
                <ListItem
                    key={index}
                    index={index}
                    item={item}
                    isLockedByOther={isLockedByOther}
                    onInput={handleItemInput}
                />
            ))}
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

    return (
        <li
            ref={liRef}
            contentEditable={!isLockedByOther}
            suppressContentEditableWarning={true}
            onInput={(e) => onInput(index, e.currentTarget.innerText || "")}
        >
            {item}
        </li>
    );
};

export default ListBlock;