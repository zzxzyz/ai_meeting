import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@/application/services/auth.service';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';
import { RefreshTokenRepository } from '@/infrastructure/database/repositories/refresh-token.repository';
import { RegisterDto, LoginDto } from '@/api/dto/auth.dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password_hash: 'hashedpassword',
    nickname: '测试用户',
    avatar: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            existsByEmail: jest.fn(),
          },
        },
        {
          provide: RefreshTokenRepository,
          useValue: {
            create: jest.fn(),
            findByTokenHash: jest.fn(),
            markAsUsed: jest.fn(),
            revoke: jest.fn(),
            revokeAllByUserId: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                BCRYPT_ROUNDS: 12,
                JWT_EXPIRES_IN: '1h',
                REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    refreshTokenRepository = module.get(RefreshTokenRepository);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123',
      nickname: '测试用户',
    };

    it('应该成功注册用户', async () => {
      // Arrange
      userRepository.existsByEmail.mockResolvedValue(false);
      userRepository.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      jwtService.sign.mockReturnValue('access-token');
      refreshTokenRepository.create.mockResolvedValue({
        id: 'token-123',
        user_id: mockUser.id,
        token_hash: 'token-hash',
        expires_at: new Date(),
        used_at: null,
        revoked_at: null,
        ip: null,
        user_agent: null,
        created_at: new Date(),
      } as any);

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(userRepository.existsByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password_hash: 'hashedpassword',
        nickname: registerDto.nickname,
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(refreshTokenRepository.create).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in', 3600);
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('邮箱已被注册时应该抛出 ConflictException', async () => {
      // Arrange
      userRepository.existsByEmail.mockResolvedValue(true);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepository.existsByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123',
    };

    it('应该成功登录', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('access-token');
      refreshTokenRepository.create.mockResolvedValue({
        id: 'token-123',
      } as any);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password_hash,
      );
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('用户不存在时应该抛出 UnauthorizedException', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
      );
    });

    it('密码错误时应该抛出 UnauthorizedException', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password_hash,
      );
    });
  });

  describe('refreshAccessToken', () => {
    const refreshToken = 'refresh-token-string';

    it('应该成功刷新 Token', async () => {
      // Arrange
      const mockRefreshToken = {
        id: 'token-123',
        user_id: mockUser.id,
        token_hash: 'token-hash',
        expires_at: new Date(Date.now() + 86400000), // 1 天后
        used_at: null,
        revoked_at: null,
        ip: null,
        user_agent: null,
        created_at: new Date(),
      };

      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        mockRefreshToken as any,
      );
      refreshTokenRepository.markAsUsed.mockResolvedValue(undefined);
      userRepository.findById.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue('new-access-token');
      refreshTokenRepository.create.mockResolvedValue({
        id: 'new-token-123',
      } as any);

      // Act
      const result = await service.refreshAccessToken(refreshToken);

      // Assert
      expect(refreshTokenRepository.findByTokenHash).toHaveBeenCalled();
      expect(refreshTokenRepository.markAsUsed).toHaveBeenCalledWith(
        mockRefreshToken.id,
      );
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('Token 已使用时应该撤销所有 Token 并抛出异常', async () => {
      // Arrange
      const mockRefreshToken = {
        id: 'token-123',
        user_id: mockUser.id,
        token_hash: 'token-hash',
        expires_at: new Date(Date.now() + 86400000),
        used_at: new Date(), // 已使用
        revoked_at: null,
        ip: null,
        user_agent: null,
        created_at: new Date(),
      };

      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        mockRefreshToken as any,
      );

      // Act & Assert
      await expect(
        service.refreshAccessToken(refreshToken),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        refreshTokenRepository.revokeAllByUserId,
      ).toHaveBeenCalledWith(mockUser.id);
    });

    it('Token 无效时应该抛出 UnauthorizedException', async () => {
      // Arrange
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.refreshAccessToken(refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Token 已过期时应该抛出 UnauthorizedException', async () => {
      // Arrange
      const mockRefreshToken = {
        id: 'token-123',
        user_id: mockUser.id,
        expires_at: new Date(Date.now() - 1000), // 已过期
        used_at: null,
        revoked_at: null,
      };

      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        mockRefreshToken as any,
      );

      // Act & Assert
      await expect(
        service.refreshAccessToken(refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('应该成功登出', async () => {
      // Arrange
      const userId = 'user-123';
      const refreshToken = 'refresh-token-string';
      const mockRefreshToken = {
        id: 'token-123',
        revoked_at: null,
      };

      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        mockRefreshToken as any,
      );
      refreshTokenRepository.revoke.mockResolvedValue(undefined);

      // Act
      await service.logout(userId, refreshToken);

      // Assert
      expect(refreshTokenRepository.findByTokenHash).toHaveBeenCalled();
      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(
        mockRefreshToken.id,
      );
    });

    it('没有 Refresh Token 时应该正常返回', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await service.logout(userId);

      // Assert
      expect(refreshTokenRepository.findByTokenHash).not.toHaveBeenCalled();
    });
  });
});
