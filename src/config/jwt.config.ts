const JWT_SECRET_MIN_LENGTH = 32;

export const getJwtSecret = (): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const isValidJwtSecret =
    jwtSecret !== undefined && jwtSecret.length >= JWT_SECRET_MIN_LENGTH;
  if (!isValidJwtSecret) {
    throw new Error(
      `JWT_SECRET must be set and at least ${JWT_SECRET_MIN_LENGTH} characters long`,
    );
  }
  return jwtSecret;
};
