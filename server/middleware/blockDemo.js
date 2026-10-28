import User from "../models/users.js";
import { DEMO_EMAIL } from "../config/demo.js";

// keeps the shared demo account from being edited by visitors
export const blockDemo = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("email");
    if (user?.email === DEMO_EMAIL) {
      return res
        .status(403)
        .json({ message: "This isn't available on the demo account." });
    }
    next();
  } catch (error) {
    next(error);
  }
};