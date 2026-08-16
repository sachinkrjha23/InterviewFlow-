import express from "express"
import dotenv from "dotenv"

dotenv.config()

const app = express();

const PORT = process.env.PORT || 1500;

app.get("/", (req, res)=>{
    return res.json({message: "Server is running"})
})

app.listen(PORT, ()=>{
    console.log(`Server running on PORT: ${PORT}`);
})