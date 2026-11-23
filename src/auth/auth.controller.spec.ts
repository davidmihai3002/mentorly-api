import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { USER_ROLE } from '../users/index.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import type { GoogleRegisterDto, LoginDto, RegisterDto } from './dto/index.js';

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const ACCESS_TOKEN = 'access-token-value';
const REFRESH_TOKEN = 'refresh-token-value';
const GOOGLE_ID_TOKEN = 'google-id-token-value';

const user = {
  id: USER_ID,
  email: 'ana.pop@example.com',
  role: USER_ROLE.MENTEE,
  firstName: 'Ana',
  lastName: 'Pop',
};

const session = {
  accessToken: ACCESS_TOKEN,
  refreshToken: REFRESH_TOKEN,
  user,
};

const expectedCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 2592000000,
};

const credentials = {
  email: 'ana.pop@example.com',
  password: 'parola123',
} satisfies LoginDto;

const signUp = {
  role: USER_ROLE.MENTEE,
  firstName: 'Ana',
  lastName: 'Pop',
  email: 'ana.pop@example.com',
  password: 'parola123',
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
} satisfies RegisterDto;

const googleSignUp = {
  idToken: GOOGLE_ID_TOKEN,
  role: USER_ROLE.MENTEE,
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
} satisfies GoogleRegisterDto;

const currentUser: AuthenticatedUser = { id: USER_ID, role: USER_ROLE.MENTEE };

describe('AuthController', () => {
  const authService = {
    register: vi.fn<AuthService['register']>(),
    login: vi.fn<AuthService['login']>(),
    googleRegister: vi.fn<AuthService['googleRegister']>(),
    googleLogin: vi.fn<AuthService['googleLogin']>(),
    refresh: vi.fn<AuthService['refresh']>(),
    logout: vi.fn<AuthService['logout']>(),
  };
  const response = {
    cookie: vi.fn<Response['cookie']>(),
    clearCookie: vi.fn<Response['clearCookie']>(),
  };
  const expressResponse = response as unknown as Response;
  let authController: AuthController;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    authController = testingModule.get(AuthController);
  });

  it.each([
    ['login', () => authController.login(credentials, expressResponse)],
    ['register', () => authController.register(signUp, expressResponse)],
    [
      'Google login',
      () =>
        authController.googleLogin(
          { idToken: GOOGLE_ID_TOKEN },
          expressResponse,
        ),
    ],
    [
      'Google register',
      () => authController.googleRegister(googleSignUp, expressResponse),
    ],
  ])(
    '%s sets the refresh token as an httpOnly, secure, strict cookie for 30 days and returns only the access token and the user',
    async (_endpoint, startSession) => {
      authService.login.mockResolvedValue(session);
      authService.register.mockResolvedValue(session);
      authService.googleLogin.mockResolvedValue(session);
      authService.googleRegister.mockResolvedValue(session);

      await expect(startSession()).resolves.toStrictEqual({
        accessToken: ACCESS_TOKEN,
        user,
      });
      expect(response.cookie.mock.calls).toStrictEqual([
        ['refreshToken', REFRESH_TOKEN, expectedCookieOptions],
      ]);
    },
  );

  it('Google login passes only the ID token from the body to the service, exactly once', async () => {
    authService.googleLogin.mockResolvedValue(session);

    await authController.googleLogin(
      { idToken: GOOGLE_ID_TOKEN },
      expressResponse,
    );

    expect(authService.googleLogin).toHaveBeenCalledExactlyOnceWith(
      GOOGLE_ID_TOKEN,
    );
  });

  it('Google register passes the whole sign-up to the service, exactly once', async () => {
    authService.googleRegister.mockResolvedValue(session);

    await authController.googleRegister(googleSignUp, expressResponse);

    expect(authService.googleRegister).toHaveBeenCalledExactlyOnceWith(
      googleSignUp,
    );
  });

  it('refresh passes the refresh token cookie value to the service and returns its response', async () => {
    authService.refresh.mockResolvedValue({ accessToken: ACCESS_TOKEN, user });

    await expect(authController.refresh(REFRESH_TOKEN)).resolves.toStrictEqual({
      accessToken: ACCESS_TOKEN,
      user,
    });
    expect(authService.refresh).toHaveBeenCalledExactlyOnceWith(REFRESH_TOKEN);
  });

  it('logout logs the user out and clears the refresh token cookie with the same options', async () => {
    await authController.logout(currentUser, expressResponse);

    expect(authService.logout).toHaveBeenCalledExactlyOnceWith(USER_ID);
    expect(response.clearCookie.mock.calls).toStrictEqual([
      ['refreshToken', expectedCookieOptions],
    ]);
  });
});
