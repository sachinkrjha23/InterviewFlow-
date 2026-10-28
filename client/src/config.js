export const serverUrl = (import.meta.env.VITE_SERVER_URL || "http://localhost:1000").replace(/\/+$/, "");

// keep these two in sync with the server (interview cost, and the default credits in models/users.js)
export const INTERVIEW_COST = 50;
export const SIGNUP_CREDITS = 150;
export const DEMO_ENABLED = import.meta.env.VITE_DEMO_ENABLED === "true";
export const DEMO_EMAIL = "demo@interviewflow.demo"; // keep in sync with server/config/demo.js