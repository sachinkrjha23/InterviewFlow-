import { v2 as cloudinary } from "cloudinary";

let configured = false;

const getCloudinary = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

export const uploadAvatar = (buffer, userId) =>
  new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(
      {
        folder: "interviewflow/avatars",
        public_id: `user_${userId}_${Date.now()}`,
        resource_type: "image",
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "auto" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });

export const deleteAvatar = async (publicId) => {
  if (!publicId) return;
  try {
    await getCloudinary().uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
  }
};
