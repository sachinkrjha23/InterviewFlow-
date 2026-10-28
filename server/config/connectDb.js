import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info("DB connected!");
  } catch (error) {
    logger.error(`Database Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
