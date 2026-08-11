import express from "express";
import { createDocumentController, getAllDocumentsController, getDocumentByIdController, 
         getDocumentTreeController, updateDocumentController, deleteDocumentController } from "../controllers/document.controller.js";

const router = express.Router();

router.post("/", createDocumentController);

router.get("/", getAllDocumentsController);

router.get("/:id", getDocumentByIdController);

router.get("/:id/tree", getDocumentTreeController);

router.put("/:id", updateDocumentController);

router.delete("/:id", deleteDocumentController);

export default router;