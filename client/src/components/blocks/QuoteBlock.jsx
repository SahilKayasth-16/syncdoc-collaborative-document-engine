const QuoteBlock = ({ node }) => {
    return (
        <blockquote>{node.data?.content || ""}</blockquote>
    );
};

export default QuoteBlock;