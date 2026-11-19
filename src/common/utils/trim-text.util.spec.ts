import { TransformationType, type TransformFnParams } from 'class-transformer';
import { trimText } from './trim-text.util.js';

const trimField = (value: unknown): unknown => {
  const transformParams: TransformFnParams = {
    value,
    key: 'needs',
    obj: { needs: value },
    type: TransformationType.PLAIN_TO_CLASS,
    options: {},
  };
  return trimText(transformParams);
};

describe('trimText', () => {
  it('removes the surrounding whitespace and keeps tabs and line breaks inside the text', () => {
    expect(trimField(' \t\r\n First line\r\nSecond\tline \n ')).toBe(
      'First line\r\nSecond\tline',
    );
  });

  it.each([42, undefined])('passes %s through unchanged', (value) => {
    expect(trimField(value)).toBe(value);
  });
});
