import type { TransformFnParams } from 'class-transformer';

export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase().normalize();

export const toNormalizedEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
