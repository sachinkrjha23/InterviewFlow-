import mongoose from "mongoose";

const connectDB = async()=>{

    try{
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("DB connected!");
    }
    catch(error){
        console.log(`Database Error: ${error.message}`);
        process.exit(1);
    }

}

export default connectDB;