import type { TransformFnParams } from 'class-transformer';

export const trimText = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
