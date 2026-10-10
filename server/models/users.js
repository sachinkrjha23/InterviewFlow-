import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

    name:{
        type:String,
        required: true
    },
    email:{
        type:String,
        unique:true,
        required:true,
        lowercase:true,
        trim:true
    },
    credits:{
        type:Number,
        default: 150,
        min: 0
    },
    photo:{
        type:String,
        default: ""
    },
    avatar:{
        type:String,
        default: ""
    },
    avatarPublicId:{
        type:String,
        default: "",
        select: false
    },
    googleUid:{
        type:String,
        unique: true,
        sparse: true,
        select: false
    }

}, {timestamps:true})

const User = mongoose.model("User", userSchema);

export default User;