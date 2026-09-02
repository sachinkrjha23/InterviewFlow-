import express from "express"
import dotenv from "dotenv"
import connectDB from "./config/connectDb.js"


dotenv.config()

const app = express();

const PORT = process.env.PORT || 1500;

app.get("/", (req, res)=>{
    return res.json({message: "Server is running"})
})

try {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running on PORT: ${PORT}`);
    });
} catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
}