import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { MenteeProfile, USER_ROLE, User } from '../users/index.js';
import type { RegisterDto, RegisterResponseDto } from './dto/index.js';

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists.';

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async register(signUp: RegisterDto): Promise<RegisterResponseDto> {
    const passwordHash = await hash(signUp.password, BCRYPT_SALT_ROUNDS);
    const termsAcceptedAt = new Date();
    const createdUser = await this.dataSource.transaction(async (manager) => {
      const usersRepository = manager.getRepository(User);
      const user = usersRepository.create({
        email: signUp.email,
        passwordHash,
        role: signUp.role,
        firstName: signUp.firstName,
        lastName: signUp.lastName,
        birthDate: signUp.birthDate,
        termsAcceptedAt,
      });
      const insertQuery = usersRepository.createQueryBuilder().insert();
      await insertQuery.values(user).orIgnore().execute();
      const isEmailTaken = user.id === undefined;
      if (isEmailTaken) {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      const isMentee = user.role === USER_ROLE.MENTEE;
      if (isMentee) {
        await manager.getRepository(MenteeProfile).insert({ userId: user.id });
      }
      return user;
    });

    const { id, email, role, firstName, lastName } = createdUser;
    return { id, email, role, firstName, lastName };
  }
}
