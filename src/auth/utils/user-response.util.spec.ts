import { USER_ROLE, User } from '../../users/index.js';
import { toUserResponse } from './user-response.util.js';

describe('toUserResponse', () => {
  it('copies only the public user fields', () => {
    const user = Object.assign(new User(), {
      id: '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f',
      email: 'ana.pop@example.com',
      passwordHash: 'stored-bcrypt-hash',
      role: USER_ROLE.MENTEE,
      firstName: 'Ana',
      lastName: 'Pop',
      birthDate: '2001-03-15',
      termsAcceptedAt: new Date('2026-11-12T09:30:00.000Z'),
      tokenVersion: 3,
      lastLoginAt: new Date('2026-11-16T18:00:00.000Z'),
      deletedAt: null,
    });

    expect(toUserResponse(user)).toStrictEqual({
      id: '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f',
      email: 'ana.pop@example.com',
      role: USER_ROLE.MENTEE,
      firstName: 'Ana',
      lastName: 'Pop',
    });
  });
});
