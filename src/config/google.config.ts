import { readRequiredVariable } from './utils/index.js';

export const getGoogleClientId = (): string => {
  const googleClientId = readRequiredVariable('GOOGLE_CLIENT_ID');
  return googleClientId;
};
