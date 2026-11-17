import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/internal';
import { Test } from '@nestjs/testing';
import { USER_ROLE } from '../users/index.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface GuardedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

const authenticatedUser: AuthenticatedUser = {
  id: '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f',
  role: USER_ROLE.MENTOR,
};

describe('JwtAuthGuard', () => {
  const authService = {
    authenticate: vi.fn<AuthService['authenticate']>(),
  };
  let jwtAuthGuard: JwtAuthGuard;

  const activateFor = (request: GuardedRequest): Promise<boolean> => {
    const context = new ExecutionContextHost([request]);
    return jwtAuthGuard.canActivate(context);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    jwtAuthGuard = testingModule.get(JwtAuthGuard);
  });

  it.each([
    ['no value', undefined],
    ['another scheme', 'Basic YW5hOnBhcm9sYTEyMw=='],
    ['a lowercase scheme', 'bearer token-value'],
    ['no token', 'Bearer'],
    ['an empty token', 'Bearer '],
    ['a token with spaces', 'Bearer token value'],
    ['a bare token', 'token-value'],
  ])(
    'rejects an Authorization header with %s with 401, without calling the auth service',
    async (_problem, authorization) => {
      await expect(activateFor({ headers: { authorization } })).rejects.toThrow(
        new UnauthorizedException(),
      );
      expect(authService.authenticate).not.toHaveBeenCalled();
    },
  );

  it('passes the bearer token to the auth service and attaches the authenticated user to the request', async () => {
    authService.authenticate.mockResolvedValue(authenticatedUser);
    const request: GuardedRequest = {
      headers: { authorization: 'Bearer header.payload.signature' },
    };

    await expect(activateFor(request)).resolves.toBe(true);
    expect(authService.authenticate.mock.calls).toStrictEqual([
      ['header.payload.signature'],
    ]);
    expect(request.user).toBe(authenticatedUser);
  });
});
