import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, IsNull, Repository } from 'typeorm';
import { MenteeProfile, USER_ROLE, User } from '../users/index.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import type {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  UserResponseDto,
} from './dto/index.js';
import { toUserResponse } from './utils/index.js';

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists.';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const DUMMY_PASSWORD_HASH =
  '$2b$10$Ei5TpbJPQPNKf3I9WtJaEe89OhfsJDxHh8NEZWHbZ98ww2.M3vh4W';

interface AccessTokenPayload {
  sub: string;
  tokenVersion: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(signUp: RegisterDto): Promise<UserResponseDto> {
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

    const registeredUser = toUserResponse(createdUser);
    return registeredUser;
  }

  async login(credentials: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findOneBy({
      email: credentials.email,
      deletedAt: IsNull(),
    });
    const comparedHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isPasswordMatch = await compare(credentials.password, comparedHash);
    const isAuthenticated =
      user !== null && user.passwordHash !== null && isPasswordMatch;
    if (!isAuthenticated) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const lastLoginAt = new Date();
    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };
    const [, accessToken] = await Promise.all([
      this.usersRepository.update({ id: user.id }, { lastLoginAt }),
      this.jwtService.signAsync(accessTokenPayload),
    ]);
    const userResponse = toUserResponse(user);
    return { accessToken, user: userResponse };
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const payload = await this.verifyAccessToken(accessToken);
    const user = await this.usersRepository.findOneBy({
      id: payload.sub,
      deletedAt: IsNull(),
    });
    const isCurrentSession =
      user !== null && user.tokenVersion === payload.tokenVersion;
    if (!isCurrentSession) {
      throw new UnauthorizedException();
    }

    const { id, role } = user;
    return { id, role };
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.increment({ id: userId }, 'tokenVersion', 1);
  }

  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
