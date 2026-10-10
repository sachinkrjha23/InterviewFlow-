import React, { useState } from "react";
import { FaUser } from "react-icons/fa";

function Avatar({ user, size = 36, className = "" }) {
  const [failedSrc, setFailedSrc] = useState("");

  const src = user?.avatar || user?.photo || "";
  const initial = user?.name?.trim()?.[0]?.toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={user?.name || "Profile"}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        style={style}
        className={`rounded-full object-cover bg-gray-200 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-black text-white flex items-center
                  justify-center font-semibold shrink-0 ${className}`}
    >
      {initial || <FaUser size={size * 0.45} />}
    </div>
  );
}

export default Avatar;