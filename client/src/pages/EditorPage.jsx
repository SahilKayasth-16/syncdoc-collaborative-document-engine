import { useParams } from "react-router-dom";
import Editor from "../components/editor/Editor";

const EditorPage = () => {
    const { id } = useParams();
    return <Editor documentId={id} />
};

export default EditorPage;