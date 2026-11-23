import { TransformationType, type TransformFnParams } from 'class-transformer';
import { parseBooleanText } from './boolean-text.util.js';

const applyTransform = (value: unknown): unknown => {
  const transformParams: TransformFnParams = {
    value,
    key: 'field',
    obj: { field: value },
    type: TransformationType.PLAIN_TO_CLASS,
    options: {},
  };
  return parseBooleanText(transformParams);
};

describe('parseBooleanText', () => {
  it('turns the text "true" into true', () => {
    expect(applyTransform('true')).toBe(true);
  });

  it('turns the text "false" into false', () => {
    expect(applyTransform('false')).toBe(false);
  });

  it.each(['TRUE', 'yes', '1', '', true, undefined])(
    'passes %s through unchanged',
    (value) => {
      expect(applyTransform(value)).toBe(value);
    },
  );
});
