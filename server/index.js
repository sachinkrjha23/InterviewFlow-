import express from "express"
import dotenv from "dotenv"
import connectDB from "./config/connectDb.js"
import cookieParser from "cookie-parser";
dotenv.config();
import cors from "cors"
import authRouter from "./routes/authRouter.js";
import userRouter from "./routes/userRouter.js";

const app = express();
app.use(cors(
    {
       origin: "http://localhost:5173",
       credentials: true
    }
));

app.use(express.json());
app.use(cookieParser());


app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)


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