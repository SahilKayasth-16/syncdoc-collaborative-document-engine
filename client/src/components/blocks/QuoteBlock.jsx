const QuoteBlock = ({ node }) => {
    const content = node?.data?.content || "";
    const author = node?.data?.author;

    return (
        <blockquote className="quote-block">
            <p>{content}</p>
            {author && <cite className="quote-author">— {author}</cite>}
        </blockquote>
    );
};

export default QuoteBlock;