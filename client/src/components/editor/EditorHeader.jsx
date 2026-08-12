const EditorHeader = ({ title = "Untitled document "}) => {
    return(
        <header className="editor-header">
            <h1>{title}</h1>
        </header>
    );
};

export default EditorHeader;