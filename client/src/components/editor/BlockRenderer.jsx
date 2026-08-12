import HeadingBlock from "../blocks/HeadingBlock";
import ParagraphBlock from "../blocks/ParagraphBlock";
import CodeBlock from "../blocks/CodeBlock";
import ListBlock from "../blocks/ListBlock";
import QuoteBlock from "../blocks/QuoteBlock";

const BlockRenderer = ({ node }) => {
    if (!node) {
        return null;
    }

    switch (node.type) {
        case "section":
            return(
                <div className="section-block">
                    {node.children?.map((child) => (
                        <BlockRenderer key={child.id} node={child} />
                    ))}
                </div>
            );
        
        case "heading":
            return <HeadingBlock node={node} />;
        
        case "paragraph":
            return <ParagraphBlock node={node} />;
        
        case "code_block":
            return <ParagraphBlock node={node} />;
        
        case "list":
            return <ListBlock node={node} />;

        case "quote":
            return <QuoteBlock node={node} />;

        case "text":
            return(
                <span>{node.data?.content || ""}</span>
            );
        
        default: 
         return(
            <div className="unknown-block">
                Unsupported block type: {node.type}
            </div>
         );
    }
};

export default BlockRenderer;