import { TransformationType, type TransformFnParams } from 'class-transformer';
import { trimText, trimTextItems } from './trim-text.util.js';

const applyTransform = (
  transform: (params: TransformFnParams) => unknown,
  value: unknown,
): unknown => {
  const transformParams: TransformFnParams = {
    value,
    key: 'field',
    obj: { field: value },
    type: TransformationType.PLAIN_TO_CLASS,
    options: {},
  };
  return transform(transformParams);
};

describe('trimText', () => {
  it('removes the surrounding whitespace and keeps tabs and line breaks inside the text', () => {
    expect(
      applyTransform(trimText, ' \t\r\n First line\r\nSecond\tline \n '),
    ).toBe('First line\r\nSecond\tline');
  });

  it.each([42, undefined])('passes %s through unchanged', (value) => {
    expect(applyTransform(trimText, value)).toBe(value);
  });
});

describe('trimTextItems', () => {
  it('trims every text item and passes other items through unchanged', () => {
    expect(
      applyTransform(trimTextItems, [
        '  Senior engineer at Nordwave \t',
        42,
        ' \r\n ',
        null,
      ]),
    ).toStrictEqual(['Senior engineer at Nordwave', 42, '', null]);
  });

  it.each(['  Nordwave  ', 42, undefined])(
    'passes the non-list value %s through unchanged',
    (value) => {
      expect(applyTransform(trimTextItems, value)).toBe(value);
    },
  );
});
