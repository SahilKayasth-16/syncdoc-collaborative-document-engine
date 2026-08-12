import Block from "./Block";

const BlockList = ({ nodes = [] }) => {
    return (
        <div className="block-list">
            {nodes.map((node) => (
                <Block key={node.id} node={node} />
            ))}
        </div>
    );
};

export default BlockList;