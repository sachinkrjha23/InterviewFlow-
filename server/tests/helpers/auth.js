import User from "../../models/users.js";
import genToken from "../../config/token.js";

let n = 0;

export const makeUser = (overrides = {}) =>
  User.create({
    name: "Test User",
    email: `user${++n}@test.com`,
    ...overrides,
  });

// the real genToken + test JWT_SECRET, as a Cookie header value
export const authCookie = async (user) => `token=${await genToken(user._id)}`;
