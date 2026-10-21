import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { FaTimes } from "react-icons/fa";
import Modal from "./Modal";
import SignInCard from "./SignInCard";

function AuthModel({ onClose }) {
  const { userData } = useSelector((state) => state.user);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // close as soon as sign-in succeeds
  useEffect(() => {
    if (userData) onCloseRef.current();
  }, [userData]);

  return (
    <Modal onClose={onClose} labelledBy="signin-title">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close sign-in"
        className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
      >
        <FaTimes size={16} aria-hidden="true" />
      </button>
      <SignInCard />
    </Modal>
  );
}

export default AuthModel;