import type { TransformFnParams } from 'class-transformer';

export const toNormalizedEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase().normalize() : value;
