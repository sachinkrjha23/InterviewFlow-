import User from "../models/users.js";
import { uploadAvatar, deleteAvatar } from "../config/cloudinary.js";
import { getAdminAuth } from "../config/firebaseAdmin.js";
import { publicUser } from "../utils/publicUser.js";

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Failed to fetch this user ${error}` });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: "Name must be 2-60 characters." });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { name } },
      { returnDocument: "after", runValidators: true },
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Failed to update profile: ${error.message}` });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image required." });

    const user = await User.findById(req.userId).select("+avatarPublicId");
    if (!user) return res.status(404).json({ message: "User not found" });

    const result = await uploadAvatar(req.file.buffer, req.userId);

    const oldPublicId = user.avatarPublicId;
    user.avatar = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save();

    await deleteAvatar(oldPublicId);

    return res.status(200).json(publicUser(user));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: `Failed to upload photo: ${error.message}` });
  }
};

export const removeProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+avatarPublicId");
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldPublicId = user.avatarPublicId;
    user.avatar = "";
    user.avatarPublicId = "";
    await user.save();

    await deleteAvatar(oldPublicId);

    return res.status(200).json(publicUser(user));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: `Failed to remove photo: ${error.message}` });
  }
};

export const changeSignInEmail = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({ message: "Google confirmation required." });
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken);
    } catch {
      return res
        .status(401)
        .json({ message: "Couldn't verify that Google account." });
    }

    // the Google popup must have just happened
    const secondsSinceSignIn =
      Math.floor(Date.now() / 1000) - (decoded.auth_time || 0);
    if (secondsSinceSignIn > 300) {
      return res
        .status(401)
        .json({
          message: "Please sign in with Google again to confirm the change.",
        });
    }

    const newEmail = decoded.email?.toLowerCase();
    if (!newEmail || !decoded.email_verified) {
      return res
        .status(400)
        .json({ message: "That Google account's email isn't verified." });
    }

    const current = await User.findById(req.userId).select("+googleUid");
    if (!current) return res.status(404).json({ message: "User not found" });

    if (newEmail === current.email || decoded.uid === current.googleUid) {
      return res
        .status(400)
        .json({ message: "That's already your sign-in email." });
    }

    // does this Google account already have a separate profile of its own?
    const clash = await User.exists({
      _id: { $ne: current._id },
      $or: [{ email: newEmail }, { googleUid: decoded.uid }],
    });
    if (clash) {
      return res.status(409).json({
        message:
          "That Google account already has its own InterviewFlow profile, so it can't be used here.",
      });
    }

    // overwrite in place: the old email simply stops existing, and all data stays put.
    // the email in the filter guards against two changes racing each other
    const updated = await User.findOneAndUpdate(
      { _id: current._id, email: current.email },
      {
        $set: {
          email: newEmail,
          googleUid: decoded.uid,
          photo: typeof decoded.picture === "string" ? decoded.picture : "",
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) {
      return res.status(409).json({
        message: "Your profile changed while updating. Please try again.",
      });
    }

    return res.status(200).json(publicUser(updated));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "That Google account already has its own InterviewFlow profile, so it can't be used here.",
      });
    }
    console.error(error);
    return res.status(500).json({ message: "Couldn't change your email." });
  }
};
