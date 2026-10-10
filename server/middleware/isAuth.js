import jwt from "jsonwebtoken"

const isAuth = async (req, res, next) => {
    try {
        const { token } = req.cookies

        if (!token) {
            return res.status(401).json({ message: "User does not have a token" })
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = verified.userId;
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

export default isAuth;