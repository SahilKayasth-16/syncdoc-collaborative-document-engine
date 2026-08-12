import BlockRenderer from "./BlockRenderer";

const Block = ({ node }) => {
    return (
        <div className="editor-block">
            <BlockRenderer node={node} />
        </div>
    );
};

export default Block;