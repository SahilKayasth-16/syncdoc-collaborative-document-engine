const HeadingBlock = ({ node }) => {
    const level = node.data?.level || 1;
    const content = node.data?.content || "";

     const HeadingTag = `h${Math.min(Math.max(level, 1), 6)}`;

    return <HeadingTag>{content}</HeadingTag>;
};

export default HeadingBlock;