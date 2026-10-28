import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/connectDb.js";

const { JWT_SECRET, NODE_ENV, CLIENT_URL } = process.env;
if (!JWT_SECRET) {
  console.error("JWT_SECRET must be set.");
  process.exit(1);
}
if (NODE_ENV === "production" && !CLIENT_URL) {
  console.error("CLIENT_URL must be set in production (CORS, cookies, origin check).");
  process.exit(1);
}

const PORT = process.env.PORT || 1500;

try {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Server running on PORT: ${PORT}`);
  });

  // On a deploy or restart the host sends SIGTERM: stop taking new requests,
  // let the running ones finish, then close the database.
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received, shutting down...`);
    // give up after 25s so a stuck request can't block the restart
    setTimeout(() => process.exit(1), 25000).unref();
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}