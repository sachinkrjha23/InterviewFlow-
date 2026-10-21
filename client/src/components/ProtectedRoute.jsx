import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import PageLoader from "./PageLoader";

function ProtectedRoute({ children }) {
  const { userData, authChecked } = useSelector((state) => state.user);
  const location = useLocation();

  if (!authChecked) return <PageLoader />;

  if (!userData) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default ProtectedRoute;