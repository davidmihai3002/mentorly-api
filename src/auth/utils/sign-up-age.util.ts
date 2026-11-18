export const MINIMUM_SIGN_UP_AGE = 16;

export const isOldEnoughToSignUp = (
  birthDate: string,
  today: Date,
): boolean => {
  const [todayDate] = today.toISOString().split('T');
  const [todayYear, todayMonth, todayDay] = todayDate.split('-');
  const latestAllowedBirthYear = Number(todayYear) - MINIMUM_SIGN_UP_AGE;
  const latestAllowedBirthDate = `${latestAllowedBirthYear}-${todayMonth}-${todayDay}`;
  const isOldEnough = birthDate <= latestAllowedBirthDate;
  return isOldEnough;
};
