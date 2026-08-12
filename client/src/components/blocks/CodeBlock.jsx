const CodeBlock = ({ node }) => {
    const language = node.data?.language || "text";
    const content = node.data?.content || "";

    return (
        <pre className="code-block">
            <code data-language={language}>
                {content}
            </code>
        </pre>
    );
};

export default CodeBlock;