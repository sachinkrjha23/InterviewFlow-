import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const getAdminAuth = () => {
  const app = getApps().length
    ? getApp()
    : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  return getAuth(app);
};