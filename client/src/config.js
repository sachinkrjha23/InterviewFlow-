export const serverUrl = (import.meta.env.VITE_SERVER_URL || "http://localhost:1000").replace(/\/+$/, "");

// keep these two in sync with the server (interview cost, and the default credits in models/users.js)
export const INTERVIEW_COST = 50;
export const SIGNUP_CREDITS = 150;