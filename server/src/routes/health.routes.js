import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({
      status: "OK",
      service: "SyncDoc API",
      mongodb: "connected"
    });
  } else {
    return res.status(503).json({
      status: "Error",
      service: "SyncDoc API",
      mongodb: "disconnected"
    });
  }
});

export default router;
