const ListBlock = ({ nodes }) => {
    const items = node.data?.items || [];

    return(
        <ul>
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    );
};

export default ListBlock;