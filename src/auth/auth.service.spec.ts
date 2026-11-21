import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, getRounds, hash, hashSync } from 'bcryptjs';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { MenteeProfile, USER_ROLE, User } from '../users/index.js';
import { AuthService } from './auth.service.js';
import type { LoginDto, RegisterDto } from './dto/index.js';

vi.mock(import('bcryptjs'), { spy: true });

const NEW_USER_ID = '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f';
const SIGN_UP_TIME = new Date('2026-11-12T09:30:00.000Z');
const TURNS_16_ON_SIGN_UP_DAY = '2010-11-12';
const TURNS_16_DAY_AFTER_SIGN_UP = '2010-11-13';
const UNDER_MINIMUM_AGE_ERROR = new ForbiddenException(
  'You must be at least 16 years old to create an account.',
);

const signUp = {
  role: USER_ROLE.MENTEE,
  firstName: 'Ana',
  lastName: 'Pop',
  email: 'ana.pop@example.com',
  password: 'parola123',
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
} satisfies RegisterDto;

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const AVATAR_FILE_ID = '9d3f5b7a-2c4e-4a6b-8d0f-1e3a5c7b9d2f';
const ANA_PASSWORD = 'parola123';
const ANA_PASSWORD_HASH = hashSync(ANA_PASSWORD, 10);
const INVALID_CREDENTIALS = new UnauthorizedException(
  'Invalid email or password.',
);
const BCRYPT_COST_10_HASH = /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/;
const TEST_JWT_SECRET = 'unit-test-only-fake-jwt-secret-not-for-real-use';
const OTHER_JWT_SECRET = 'another-unit-test-only-fake-jwt-secret-value';
const TEST_TOKEN_LIFETIME_SECONDS = 60;
const MILLISECONDS_PER_SECOND = 1000;

const credentials = {
  email: 'ana.pop@example.com',
  password: ANA_PASSWORD,
} satisfies LoginDto;

const buildUser = (changes: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: USER_ID,
    email: 'ana.pop@example.com',
    passwordHash: ANA_PASSWORD_HASH,
    role: USER_ROLE.MENTOR,
    firstName: 'Ana',
    lastName: 'Pop',
    birthDate: '2001-03-15',
    avatarFileId: null,
    termsAcceptedAt: SIGN_UP_TIME,
    tokenVersion: 4,
    lastLoginAt: null,
    deletedAt: null,
    ...changes,
  });

describe('AuthService', () => {
  const insertUser = vi.fn((user: User) =>
    Promise.resolve(Object.assign(user, { id: NEW_USER_ID })),
  );
  const usersRepository = {
    create: (account: Partial<User>) => Object.assign(new User(), account),
    createQueryBuilder: () => ({
      insert: () => ({
        values: (user: User) => ({
          orIgnore: () => ({ execute: () => insertUser(user) }),
        }),
      }),
    }),
  };
  const profilesRepository = {
    insert: vi.fn((profile: MenteeProfile) => Promise.resolve(profile)),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === MenteeProfile ? profilesRepository : usersRepository,
  };
  const dataSource = {
    transaction: vi.fn(
      (work: (entityManager: typeof manager) => Promise<User>) => work(manager),
    ),
  };
  const injectedUsersRepository = {
    findOneBy: vi.fn<Repository<User>['findOneBy']>(),
    update: vi.fn<Repository<User>['update']>(),
    increment: vi.fn<Repository<User>['increment']>(),
  };
  const jwtService = new JwtService({
    secret: TEST_JWT_SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: TEST_TOKEN_LIFETIME_SECONDS },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const signAsync = vi.spyOn(jwtService, 'signAsync');
  let authService: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.setSystemTime(SIGN_UP_TIME);
    const testingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(User),
          useValue: injectedUsersRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = testingModule.get(AuthService);
  });

  it('rejects a sign-up with an email that is already registered', async () => {
    insertUser.mockImplementationOnce((user) => Promise.resolve(user));

    await expect(authService.register(signUp)).rejects.toThrow(
      new ConflictException('An account with this email already exists.'),
    );
    expect(profilesRepository.insert).not.toHaveBeenCalled();
  });

  it.each([{ role: USER_ROLE.MENTEE }, { role: USER_ROLE.MENTOR }])(
    'rejects a $role sign-up with 403 when the user turns 16 tomorrow, without hashing the password or opening a transaction',
    async ({ role }) => {
      const underageSignUp = {
        ...signUp,
        role,
        birthDate: TURNS_16_DAY_AFTER_SIGN_UP,
      };

      await expect(authService.register(underageSignUp)).rejects.toThrow(
        UNDER_MINIMUM_AGE_ERROR,
      );
      expect(hash).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it('signs up a user who turns 16 on the sign-up day', async () => {
    const registerResponse = await authService.register({
      ...signUp,
      birthDate: TURNS_16_ON_SIGN_UP_DAY,
    });

    expect(registerResponse.id).toBe(NEW_USER_ID);
    expect(dataSource.transaction).toHaveBeenCalledOnce();
  });

  it('stores a bcrypt hash of cost 10, the birth date and the terms acceptance time', async () => {
    await authService.register(signUp);

    const [storedUser] = insertUser.mock.calls[0];
    const passwordHash = storedUser.passwordHash ?? '';
    const isHashOfPassword = await compare(signUp.password, passwordHash);
    expect(isHashOfPassword).toBe(true);
    expect(getRounds(passwordHash)).toBe(10);
    expect(storedUser.birthDate).toBe(signUp.birthDate);
    expect(storedUser.termsAcceptedAt).toEqual(SIGN_UP_TIME);
  });

  it.each([
    { role: USER_ROLE.MENTEE, profileInserts: [[{ userId: NEW_USER_ID }]] },
    { role: USER_ROLE.MENTOR, profileInserts: [] },
  ])(
    'signs up a $role in one transaction, with a mentee profile only for a mentee',
    async ({ role, profileInserts }) => {
      const registerResponse = await authService.register({ ...signUp, role });

      expect(registerResponse).toStrictEqual({
        id: NEW_USER_ID,
        email: 'ana.pop@example.com',
        role,
        firstName: 'Ana',
        lastName: 'Pop',
      });
      expect(dataSource.transaction).toHaveBeenCalledOnce();
      expect(profilesRepository.insert.mock.calls).toEqual(profileInserts);
    },
  );

  describe('login', () => {
    it.each([
      ['an unknown or deleted email', null, ANA_PASSWORD],
      ['a wrong password', buildUser(), 'parola124'],
      [
        'a Google-only account',
        buildUser({ passwordHash: null }),
        ANA_PASSWORD,
      ],
    ])(
      'rejects a login with %s with the generic 401, looking up only accounts without deleted_at',
      async (_case, storedUser, password) => {
        injectedUsersRepository.findOneBy.mockResolvedValue(storedUser);

        await expect(
          authService.login({ ...credentials, password }),
        ).rejects.toThrow(INVALID_CREDENTIALS);
        expect(compare).toHaveBeenCalledOnce();
        expect(injectedUsersRepository.update).not.toHaveBeenCalled();
        expect(injectedUsersRepository.findOneBy.mock.calls).toStrictEqual([
          [{ email: 'ana.pop@example.com', deletedAt: IsNull() }],
        ]);
      },
    );

    it('rejects a Google-only account even when the compare matches', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValue(
        buildUser({ passwordHash: null }),
      );
      vi.mocked(compare).mockImplementationOnce(async () => true);

      await expect(authService.login(credentials)).rejects.toThrow(
        INVALID_CREDENTIALS,
      );
    });

    it('compares the password against the same cost-10 dummy hash for an unknown email and a Google-only account', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValueOnce(null);
      injectedUsersRepository.findOneBy.mockResolvedValueOnce(
        buildUser({ passwordHash: null }),
      );

      await expect(authService.login(credentials)).rejects.toThrow();
      await expect(authService.login(credentials)).rejects.toThrow();
      const [unknownEmailCall, googleOnlyCall] = vi.mocked(compare).mock.calls;
      expect(unknownEmailCall).toStrictEqual(googleOnlyCall);
      expect(unknownEmailCall).toStrictEqual([
        ANA_PASSWORD,
        expect.stringMatching(BCRYPT_COST_10_HASH),
      ]);
    });

    it('logs in with the right password, sets last_login_at and returns the public user fields with a token signed with only the id and token version', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValue(buildUser());

      const loginResponse = await authService.login(credentials);

      expect(loginResponse).toStrictEqual({
        accessToken: await signAsync.mock.results[0].value,
        user: {
          id: USER_ID,
          email: 'ana.pop@example.com',
          role: USER_ROLE.MENTOR,
          firstName: 'Ana',
          lastName: 'Pop',
        },
      });
      expect(compare).toHaveBeenCalledExactlyOnceWith(
        ANA_PASSWORD,
        ANA_PASSWORD_HASH,
      );
      expect(injectedUsersRepository.update.mock.calls).toEqual([
        [{ id: USER_ID }, { lastLoginAt: SIGN_UP_TIME }],
      ]);
      expect(signAsync.mock.calls).toStrictEqual([
        [{ sub: USER_ID, tokenVersion: 4 }],
      ]);
    });
  });

  describe('authenticate', () => {
    const signAccessToken = (tokenVersion = 4): Promise<string> =>
      jwtService.signAsync({ sub: USER_ID, tokenVersion });
    const signExpiredAccessToken = async (): Promise<string> => {
      const accessToken = await signAccessToken();
      const lifetimeMilliseconds =
        (TEST_TOKEN_LIFETIME_SECONDS + 1) * MILLISECONDS_PER_SECOND;
      vi.setSystemTime(SIGN_UP_TIME.getTime() + lifetimeMilliseconds);
      return accessToken;
    };

    it.each([
      [
        'signed with another secret',
        () =>
          new JwtService({ secret: OTHER_JWT_SECRET }).signAsync({
            sub: USER_ID,
            tokenVersion: 4,
          }),
      ],
      ['that is not a JWT', () => Promise.resolve('not-a-jwt')],
      ['that has expired', signExpiredAccessToken],
    ])(
      'rejects a token %s with 401, without loading the user',
      async (_case, createToken) => {
        const accessToken = await createToken();

        await expect(authService.authenticate(accessToken)).rejects.toThrow(
          new UnauthorizedException(),
        );
        expect(injectedUsersRepository.findOneBy).not.toHaveBeenCalled();
      },
    );

    it('rejects a token of an unknown or deleted user with 401 by looking up only users without deleted_at', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValue(null);

      await expect(
        authService.authenticate(await signAccessToken()),
      ).rejects.toThrow(new UnauthorizedException());
      expect(injectedUsersRepository.findOneBy.mock.calls).toStrictEqual([
        [{ id: USER_ID, deletedAt: IsNull() }],
      ]);
    });

    it('rejects a token with an old token version with 401', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValue(
        buildUser({ tokenVersion: 5 }),
      );

      await expect(
        authService.authenticate(await signAccessToken(4)),
      ).rejects.toThrow(new UnauthorizedException());
    });

    it('returns the id and the role from the database for a valid token', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValue(
        buildUser({ role: USER_ROLE.MENTEE }),
      );

      await expect(
        authService.authenticate(await signAccessToken()),
      ).resolves.toStrictEqual({ id: USER_ID, role: USER_ROLE.MENTEE });
    });
  });

  describe('logout', () => {
    it('logs the user out on every device by bumping token_version in one atomic update', async () => {
      await authService.logout(USER_ID);

      expect(injectedUsersRepository.increment.mock.calls).toStrictEqual([
        [{ id: USER_ID }, 'tokenVersion', 1],
      ]);
    });
  });

  describe('setAvatar', () => {
    it('updates only the avatar_file_id of that user', async () => {
      await authService.setAvatar(USER_ID, AVATAR_FILE_ID);

      expect(injectedUsersRepository.update.mock.calls).toStrictEqual([
        [{ id: USER_ID }, { avatarFileId: AVATAR_FILE_ID }],
      ]);
    });
  });

  describe('findAvatarFileId', () => {
    it('returns the avatar file id of that user', async () => {
      injectedUsersRepository.findOneBy.mockResolvedValueOnce(
        buildUser({ avatarFileId: AVATAR_FILE_ID }),
      );

      await expect(authService.findAvatarFileId(USER_ID)).resolves.toBe(
        AVATAR_FILE_ID,
      );
      expect(injectedUsersRepository.findOneBy).toHaveBeenCalledExactlyOnceWith(
        { id: USER_ID },
      );
    });

    it.each([
      ['a user without an avatar', buildUser()],
      ['an unknown user', null],
    ])('returns null for %s', async (_case, user) => {
      injectedUsersRepository.findOneBy.mockResolvedValueOnce(user);

      await expect(authService.findAvatarFileId(USER_ID)).resolves.toBeNull();
    });
  });
});
