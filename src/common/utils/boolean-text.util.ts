import type { TransformFnParams } from 'class-transformer';

const TRUE_TEXT = 'true';
const FALSE_TEXT = 'false';

export const parseBooleanText = ({ value }: TransformFnParams): unknown => {
  if (value === TRUE_TEXT) {
    return true;
  }
  if (value === FALSE_TEXT) {
    return false;
  }
  return value;
};
