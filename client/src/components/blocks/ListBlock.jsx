const ListBlock = ({ node }) => {
    const items = node?.data?.items || [];
    const isOrdered = node?.data?.style === "ordered";

    if (isOrdered) {
        return (
            <ol className="list-block list-ordered">
                {items.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ol>
        );
    }

    return (
        <ul className="list-block list-unordered">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    );
};

export default ListBlock;