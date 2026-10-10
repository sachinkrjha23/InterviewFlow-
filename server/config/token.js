import jwt from "jsonwebtoken"

const genToken = async (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

export default genToken;