import User from "../models/users.js";
import genToken from "../config/token.js";
import { getAdminAuth } from "../config/firebaseAdmin.js";
import { publicUser } from "../utils/publicUser.js";
import { sendServerError } from "../utils/sendError.js";
import { DEMO_EMAIL, DEMO_CREDITS } from "../config/demo.js";

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  const configured = String(process.env.COOKIE_SAMESITE || "").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(configured)
    ? configured
    : isProd
      ? "none"
      : "strict";
  return {
    httpOnly: true,
    secure: isProd || sameSite === "none", // browsers reject SameSite=None without Secure
    sameSite,
  };
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
      return res
        .status(401)
        .json({ message: "Google account email not verified" });
    }

    const uid = decoded.uid;
    const name =
      String(decoded.name || email.split("@")[0])
        .trim()
        .slice(0, 60) || "User";
    const photo =
      typeof decoded.picture === "string" && decoded.picture.length <= 500
        ? decoded.picture
        : "";

    // 1) the usual case: this Google account is already linked to a profile
    let user = await User.findOne({ googleUid: uid });

    // 2) profiles created before linking existed: match by email once, then link
    if (!user) {
      user = await User.findOneAndUpdate(
        { email, googleUid: { $exists: false } },
        { $set: { googleUid: uid } },
        { returnDocument: "after" },
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
        message:
          "This email is linked to a different sign-in. Please contact support.",
      });
    }

    if (user.photo !== photo) {
      user.photo = photo;
      await user.save();
    }

    const token = await genToken(user._id);
    res.cookie("token", token, {
      ...getCookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return sendServerError(res, error, "Sign-in failed. Please try again.");
  }
};

// A shared account for reviewers. It only works when DEMO_MODE=true on the server.
export const demoLogin = async (req, res) => {
  try {
    if (process.env.DEMO_MODE !== "true") {
      return res.status(404).json({ message: "Route not found." });
    }

    const user = await User.findOneAndUpdate(
      { email: DEMO_EMAIL },
      { $setOnInsert: { name: "Demo User" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    // every demo login starts with a full balance
    if (user.credits < DEMO_CREDITS) {
      user.credits = DEMO_CREDITS;
      await user.save();
    }

    const token = await genToken(user._id);
    res.cookie("token", token, {
      ...getCookieOptions(),
      maxAge: 24 * 60 * 60 * 1000, // the demo session lasts a day
    });

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return sendServerError(res, error, "Couldn't start the demo. Please try again.");
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", getCookieOptions());
    return res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    return sendServerError(res, error, "Logout failed. Please try again.");
  }
};
