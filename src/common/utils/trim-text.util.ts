import type { TransformFnParams } from 'class-transformer';

export const trimText = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimTextItems = ({ value }: TransformFnParams): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }
  const trimmedItems = value.map((item: unknown) =>
    typeof item === 'string' ? item.trim() : item,
  );
  return trimmedItems;
};
