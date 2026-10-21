// Logs the real error on the server and sends the browser a safe, generic message.
export const sendServerError = (
  res,
  error,
  message = "Something went wrong. Please try again.",
) => {
  console.error(error);
  return res.status(500).json({ message });
};