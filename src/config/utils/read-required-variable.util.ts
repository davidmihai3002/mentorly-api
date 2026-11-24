export const readRequiredVariable = (name: string): string => {
  const value = process.env[name];
  const isMissing = !value;
  if (isMissing) {
    throw new Error(`${name} must be set`);
  }
  return value;
};
