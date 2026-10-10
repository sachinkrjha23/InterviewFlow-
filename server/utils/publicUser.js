export const publicUser = (user) => {
  const { avatarPublicId, googleUid, ...safe } = user.toObject();
  return safe;
};