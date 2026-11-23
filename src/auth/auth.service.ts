import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, type EntityManager, IsNull, Repository } from 'typeorm';
import {
  AUTH_PROVIDER,
  MenteeProfile,
  USER_ROLE,
  User,
  UserAuthProvider,
} from '../users/index.js';
import type { AuthSession } from './auth-session.interface.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import type {
  GoogleRegisterDto,
  LoginDto,
  LoginResponseDto,
  RegisterDto,
} from './dto/index.js';
import {
  GoogleIdentityService,
  type GoogleIdentity,
} from './google-identity.service.js';
import { REFRESH_TOKEN_LIFETIME_SECONDS } from './refresh-token-cookie.js';
import {
  MINIMUM_SIGN_UP_AGE,
  isOldEnoughToSignUp,
  toUserResponse,
} from './utils/index.js';

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists.';
const UNDER_MINIMUM_AGE_MESSAGE = `You must be at least ${MINIMUM_SIGN_UP_AGE} years old to create an account.`;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const GOOGLE_ACCOUNT_NOT_FOUND_MESSAGE =
  'No account is linked to this Google account yet.';
const DUMMY_PASSWORD_HASH =
  '$2b$10$Ei5TpbJPQPNKf3I9WtJaEe89OhfsJDxHh8NEZWHbZ98ww2.M3vh4W';

const TOKEN_TYPE = { ACCESS: 'ACCESS', REFRESH: 'REFRESH' } as const;

type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

interface TokenPayload {
  sub: string;
  tokenVersion: number;
  tokenType: TokenType;
}

type NewUserAccount = Pick<
  User,
  | 'email'
  | 'passwordHash'
  | 'role'
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'termsAcceptedAt'
> &
  Partial<Pick<User, 'emailVerifiedAt'>>;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserAuthProvider)
    private readonly authProvidersRepository: Repository<UserAuthProvider>,
    private readonly jwtService: JwtService,
    private readonly googleIdentityService: GoogleIdentityService,
  ) {}

  async register(signUp: RegisterDto): Promise<AuthSession> {
    this.ensureOldEnoughToSignUp(signUp.birthDate);

    const passwordHash = await hash(signUp.password, BCRYPT_SALT_ROUNDS);
    const termsAcceptedAt = new Date();
    const account: NewUserAccount = {
      email: signUp.email,
      passwordHash,
      role: signUp.role,
      firstName: signUp.firstName,
      lastName: signUp.lastName,
      birthDate: signUp.birthDate,
      termsAcceptedAt,
    };
    const createdUser = await this.dataSource.transaction((manager) =>
      this.insertUserAccount(manager, account),
    );

    const session = await this.createSession(createdUser);
    return session;
  }

  async googleRegister(signUp: GoogleRegisterDto): Promise<AuthSession> {
    this.ensureOldEnoughToSignUp(signUp.birthDate);

    const googleIdentity = await this.googleIdentityService.verifyIdToken(
      signUp.idToken,
    );
    const signUpTime = new Date();
    const account: NewUserAccount = {
      email: googleIdentity.email,
      passwordHash: null,
      role: signUp.role,
      firstName: googleIdentity.firstName,
      lastName: googleIdentity.lastName,
      birthDate: signUp.birthDate,
      termsAcceptedAt: signUpTime,
      emailVerifiedAt: signUpTime,
    };
    const createdUser = await this.dataSource.transaction(async (manager) => {
      const user = await this.insertUserAccount(manager, account);
      await this.insertGoogleAuthProvider(manager, user.id, googleIdentity);
      return user;
    });

    const session = await this.createSession(createdUser);
    return session;
  }

  async login(credentials: LoginDto): Promise<AuthSession> {
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

    const session = await this.startLoginSession(user);
    return session;
  }

  async googleLogin(idToken: string): Promise<AuthSession> {
    const googleIdentity =
      await this.googleIdentityService.verifyIdToken(idToken);
    const linkedUser = await this.findGoogleLinkedUser(
      googleIdentity.googleUserId,
    );
    const user =
      linkedUser ?? (await this.linkGoogleToEmailAccount(googleIdentity));

    const session = await this.startLoginSession(user);
    return session;
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const user = await this.findSessionUser(refreshToken, TOKEN_TYPE.REFRESH);
    const accessToken = await this.signToken(user, TOKEN_TYPE.ACCESS);
    const userResponse = toUserResponse(user);
    return { accessToken, user: userResponse };
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const user = await this.findSessionUser(accessToken, TOKEN_TYPE.ACCESS);
    const { id, role } = user;
    return { id, role };
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.increment({ id: userId }, 'tokenVersion', 1);
  }

  async setAvatar(userId: string, fileId: string): Promise<void> {
    await this.usersRepository.update({ id: userId }, { avatarFileId: fileId });
  }

  async findAvatarFileId(userId: string): Promise<string | null> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    const avatarFileId = user?.avatarFileId ?? null;
    return avatarFileId;
  }

  private ensureOldEnoughToSignUp(birthDate: string): void {
    const today = new Date();
    const isOldEnough = isOldEnoughToSignUp(birthDate, today);
    if (!isOldEnough) {
      throw new ForbiddenException(UNDER_MINIMUM_AGE_MESSAGE);
    }
  }

  private async startLoginSession(user: User): Promise<AuthSession> {
    const lastLoginAt = new Date();
    const [, session] = await Promise.all([
      this.usersRepository.update({ id: user.id }, { lastLoginAt }),
      this.createSession(user),
    ]);
    return session;
  }

  private async insertUserAccount(
    manager: EntityManager,
    account: NewUserAccount,
  ): Promise<User> {
    const usersRepository = manager.getRepository(User);
    const user = usersRepository.create(account);
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
  }

  private async insertGoogleAuthProvider(
    manager: EntityManager,
    userId: string,
    googleIdentity: GoogleIdentity,
  ): Promise<void> {
    const authProvider = {
      userId,
      provider: AUTH_PROVIDER.GOOGLE,
      providerUserId: googleIdentity.googleUserId,
      providerEmail: googleIdentity.email,
    };
    await manager.getRepository(UserAuthProvider).insert(authProvider);
  }

  private async findGoogleLinkedUser(
    googleUserId: string,
  ): Promise<User | null> {
    const authProvider = await this.authProvidersRepository.findOneBy({
      provider: AUTH_PROVIDER.GOOGLE,
      providerUserId: googleUserId,
    });
    if (authProvider === null) {
      return null;
    }

    const user = await this.usersRepository.findOneBy({
      id: authProvider.userId,
      deletedAt: IsNull(),
    });
    return user;
  }

  private async linkGoogleToEmailAccount(
    googleIdentity: GoogleIdentity,
  ): Promise<User> {
    const user = await this.usersRepository.findOneBy({
      email: googleIdentity.email,
      deletedAt: IsNull(),
    });
    if (user === null) {
      throw new NotFoundException(GOOGLE_ACCOUNT_NOT_FOUND_MESSAGE);
    }

    const linkedUser = await this.dataSource.transaction(async (manager) => {
      await this.insertGoogleAuthProvider(manager, user.id, googleIdentity);
      const isEmailVerified = user.emailVerifiedAt !== null;
      if (isEmailVerified) {
        return user;
      }

      const emailOwnerChanges = {
        passwordHash: null,
        tokenVersion: user.tokenVersion + 1,
        emailVerifiedAt: new Date(),
      };
      await manager
        .getRepository(User)
        .update({ id: user.id }, emailOwnerChanges);
      const verifiedUser = Object.assign(new User(), user, emailOwnerChanges);
      return verifiedUser;
    });
    return linkedUser;
  }

  private async createSession(user: User): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(user, TOKEN_TYPE.ACCESS),
      this.signToken(user, TOKEN_TYPE.REFRESH),
    ]);
    const userResponse = toUserResponse(user);
    return { accessToken, refreshToken, user: userResponse };
  }

  private signToken(user: User, tokenType: TokenType): Promise<string> {
    const payload: TokenPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
      tokenType,
    };
    if (tokenType === TOKEN_TYPE.ACCESS) {
      return this.jwtService.signAsync(payload);
    }
    return this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_LIFETIME_SECONDS,
    });
  }

  private async findSessionUser(
    token: string,
    tokenType: TokenType,
  ): Promise<User> {
    const payload = await this.verifyToken(token);
    if (payload.tokenType !== tokenType) {
      throw new UnauthorizedException();
    }

    const user = await this.usersRepository.findOneBy({
      id: payload.sub,
      deletedAt: IsNull(),
    });
    const isCurrentSession =
      user !== null && user.tokenVersion === payload.tokenVersion;
    if (!isCurrentSession) {
      throw new UnauthorizedException();
    }
    return user;
  }

  private async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
