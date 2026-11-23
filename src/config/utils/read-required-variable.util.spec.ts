import { readRequiredVariable } from './read-required-variable.util.js';

const VARIABLE_NAME = 'UNIT_TEST_REQUIRED_VARIABLE';

describe('readRequiredVariable', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('fails naming the variable when it is %s', (_problem, value) => {
    vi.stubEnv(VARIABLE_NAME, value);

    expect(() => readRequiredVariable(VARIABLE_NAME)).toThrow(
      `${VARIABLE_NAME} must be set`,
    );
  });

  it('returns the value of a set variable', () => {
    vi.stubEnv(VARIABLE_NAME, 'configured-value');

    expect(readRequiredVariable(VARIABLE_NAME)).toBe('configured-value');
  });
});
