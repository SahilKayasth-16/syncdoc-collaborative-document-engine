import express from "express";
import { createDocumentController, getAllDocumentsController, getDocumentByIdController, 
         getDocumentTreeController, updateDocumentController, deleteDocumentController,
         exportDocumentPDFController } from "../controllers/document.controller.js";

const router = express.Router();

router.post("/", createDocumentController);

router.get("/", getAllDocumentsController);

router.get("/:id", getDocumentByIdController);

router.get("/:id/tree", getDocumentTreeController);

router.get("/:id/export/pdf", exportDocumentPDFController);

router.put("/:id", updateDocumentController);

router.delete("/:id", deleteDocumentController);

export default router;