import "dotenv/config"; 
import app from "./app.js";
import connectDB from "./config/connectDb.js";

const PORT = process.env.PORT || 1500;

try {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on PORT: ${PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}