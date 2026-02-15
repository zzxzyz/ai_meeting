import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/api/controllers/auth/auth.controller';
import { AuthService } from '@/application/services/auth.service';
import { RegisterDto, LoginDto } from '@/api/dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      nickname: '测试用户',
      avatar: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    access_token: 'access-token',
    token_type: 'Bearer' as const,
    expires_in: 3600,
    refresh_token: 'refresh-token',
  };

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'test-agent' },
    cookies: {},
    user: { id: 'user-123' },
  } as any;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshAccessToken: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
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
      authService.register.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.register(
        registerDto,
        mockRequest,
        mockResponse,
      );

      // Assert
      expect(authService.register).toHaveBeenCalledWith(
        registerDto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
      expect(result).toEqual({
        code: 0,
        message: '注册成功',
        data: {
          user: mockAuthResponse.user,
          access_token: mockAuthResponse.access_token,
          token_type: mockAuthResponse.token_type,
          expires_in: mockAuthResponse.expires_in,
        },
      });
      expect(result.data).not.toHaveProperty('refresh_token');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123',
    };

    it('应该成功登录', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.login(
        loginDto,
        mockRequest,
        mockResponse,
      );

      // Assert
      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.any(Object),
      );
      expect(result).toEqual({
        code: 0,
        message: '登录成功',
        data: {
          user: mockAuthResponse.user,
          access_token: mockAuthResponse.access_token,
          token_type: mockAuthResponse.token_type,
          expires_in: mockAuthResponse.expires_in,
        },
      });
    });
  });

  describe('refresh', () => {
    it('应该成功刷新 Token', async () => {
      // Arrange
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer' as const,
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
      };

      const requestWithCookie = {
        ...mockRequest,
        cookies: { refresh_token: 'old-refresh-token' },
      };

      authService.refreshAccessToken.mockResolvedValue(
        mockRefreshResponse,
      );

      // Act
      const result = await controller.refresh(
        requestWithCookie,
        mockResponse,
      );

      // Assert
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'old-refresh-token',
        mockRequest.ip,
        mockRequest.headers['user-agent'],
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.any(Object),
      );
      expect(result).toEqual({
        code: 0,
        message: 'Token 刷新成功',
        data: {
          access_token: mockRefreshResponse.access_token,
          token_type: mockRefreshResponse.token_type,
          expires_in: mockRefreshResponse.expires_in,
        },
      });
    });

    it('缺少 Refresh Token 时应该抛出错误', async () => {
      // Arrange
      const requestWithoutCookie = {
        ...mockRequest,
        cookies: {},
      };

      // Act & Assert
      await expect(
        controller.refresh(requestWithoutCookie, mockResponse),
      ).rejects.toThrow('缺少 Refresh Token');
      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('应该成功登出', async () => {
      // Arrange
      const requestWithCookie = {
        ...mockRequest,
        cookies: { refresh_token: 'refresh-token' },
      };

      authService.logout.mockResolvedValue(undefined);

      // Act
      const result = await controller.logout(
        requestWithCookie,
        mockResponse,
      );

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(
        'user-123',
        'refresh-token',
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(Object),
      );
      expect(result).toEqual({
        code: 0,
        message: '登出成功',
      });
    });
  });
});
