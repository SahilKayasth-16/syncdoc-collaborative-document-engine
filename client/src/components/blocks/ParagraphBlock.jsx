const ParagraphBlock = ({ node }) => {
    const content = node?.data?.content || "";

    return (
        <p className="paragraph-block">
            {content}
        </p>
    );
};

export default ParagraphBlock;