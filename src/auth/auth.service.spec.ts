import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { compare, getRounds } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { MenteeProfile, USER_ROLE, User } from '../users/index.js';
import { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/index.js';

const NEW_USER_ID = '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f';
const SIGN_UP_TIME = new Date('2026-11-12T09:30:00.000Z');

const signUp = {
  role: USER_ROLE.MENTEE,
  firstName: 'Ana',
  lastName: 'Pop',
  email: 'ana.pop@example.com',
  password: 'parola123',
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
} satisfies RegisterDto;

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
  let authService: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.setSystemTime(SIGN_UP_TIME);
    const testingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: DataSource, useValue: dataSource }],
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
});
