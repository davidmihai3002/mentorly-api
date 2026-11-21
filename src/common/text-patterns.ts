export const SINGLE_LINE_TEXT_PATTERN = /^\P{Cc}+$/u;
export const SINGLE_LINE_TEXT_MESSAGE =
  '$property must be non-empty text without control characters';

export const MULTILINE_TEXT_PATTERN = /^(?:\P{Cc}|[\t\n\r])+$/u;
export const MULTILINE_TEXT_MESSAGE =
  '$property must be non-empty text without control characters other than tabs and line breaks';
