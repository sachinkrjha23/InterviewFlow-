import axios from "axios";
import { serverUrl } from "../config";
import { store } from "../redux/store";
import { setUserData } from "../redux/userSlice";

// Settings every request shares, so each call doesn't have to repeat them.
axios.defaults.withCredentials = true;
axios.defaults.timeout = 100000; // a little above the server's own 75s limit for AI calls

// When the login has expired, every page used to fail in its own way. Now the first
// "not signed in" answer from our server signs the user out once, and ProtectedRoute
// sends them to /auth. (The code comes from server/middleware/isAuth.js.)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const fromOurServer = String(error.config?.url || "").startsWith(serverUrl);
    const sessionGone =
      error.response?.status === 401 && error.response?.data?.code === "AUTH_REQUIRED";

    if (fromOurServer && sessionGone && store.getState().user.userData) {
      store.dispatch(setUserData(null));
    }
    return Promise.reject(error);
  },
);