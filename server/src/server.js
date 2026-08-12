import app from './app.js';
import connectDB from './config/database.js';

const PORT = process.env.PORT || 5050;

// Initialize Database connection
connectDB();

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
