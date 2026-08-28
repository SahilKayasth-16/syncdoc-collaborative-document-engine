import HeadingBlock from "../blocks/HeadingBlock";
import ParagraphBlock from "../blocks/ParagraphBlock";
import CodeBlock from "../blocks/CodeBlock";
import ListBlock from "../blocks/ListBlock";
import QuoteBlock from "../blocks/QuoteBlock";

const BlockRenderer = ({ node, isLockedByOther = false, updateASTNode }) => {
    if (!node) {
        return null;
    }

    switch (node.type) {
        case "section":
            return (
                <div className="section-block">
                    {node.children?.map((child) => (
                        <BlockRenderer
                            key={child.id || child._id}
                            node={child}
                            isLockedByOther={isLockedByOther}
                            updateASTNode={updateASTNode}
                        />
                    ))}
                </div>
            );

        case "heading":
            return (
                <HeadingBlock
                    node={node}
                    isLockedByOther={isLockedByOther}
                    updateASTNode={updateASTNode}
                />
            );

        case "paragraph":
            return (
                <ParagraphBlock
                    node={node}
                    isLockedByOther={isLockedByOther}
                    updateASTNode={updateASTNode}
                />
            );

        case "code_block":
            return (
                <CodeBlock
                    node={node}
                    isLockedByOther={isLockedByOther}
                    updateASTNode={updateASTNode}
                />
            );

        case "list":
            return (
                <ListBlock
                    node={node}
                    isLockedByOther={isLockedByOther}
                    updateASTNode={updateASTNode}
                />
            );

        case "quote":
            return (
                <QuoteBlock
                    node={node}
                    isLockedByOther={isLockedByOther}
                    updateASTNode={updateASTNode}
                />
            );

        case "text":
            return <span>{node.data?.content || ""}</span>;

        default:
            return (
                <div className="unknown-block">
                    Unsupported block type: {node.type}
                </div>
            );
    }
};

export default BlockRenderer;