import User from "../models/users.js";
import genToken from "../config/token.js";
import { getAdminAuth } from "../config/firebaseAdmin.js";
import { publicUser } from "../utils/publicUser.js";

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "strict",
};

export const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: "idToken required" });

        let decoded;
        try {
            decoded = await getAdminAuth().verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ message: "Invalid Google sign-in token" });
        }

        const email = decoded.email?.toLowerCase();
        if (!email || !decoded.email_verified) {
            return res.status(401).json({ message: "Google account email not verified" });
        }

        const uid = decoded.uid;
        const name = decoded.name || email.split("@")[0];
        const photo = typeof decoded.picture === "string" ? decoded.picture : "";

        // 1) the usual case: this Google account is already linked to a profile
        let user = await User.findOne({ googleUid: uid });

        // 2) profiles created before linking existed: match by email once, then link
        if (!user) {
            user = await User.findOneAndUpdate(
                { email, googleUid: { $exists: false } },
                { $set: { googleUid: uid } },
                { returnDocument: "after" }
            );
        }

        // 3) brand-new user
        if (!user) {
            try {
                user = await User.create({ name, email, googleUid: uid, photo });
            } catch (error) {
                if (error.code !== 11000) throw error;
                user = await User.findOne({ googleUid: uid });
            }
        }

        if (!user) {
            return res.status(409).json({
                message: "This email is linked to a different sign-in. Please contact support.",
            });
        }

        if (user.photo !== photo) {
            user.photo = photo;
            await user.save();
        }

        const token = await genToken(user._id);
        res.cookie("token", token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

        return res.status(200).json(publicUser(user));
    } catch (error) {
        return res.status(500).json({ message: `Google Auth Error ${error}` });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie("token", cookieOptions);
        return res.status(200).json({ message: "Logout Successfully" });
    } catch (error) {
        return res.status(500).json({ message: `Logout Error ${error}` });
    }
};