import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';
import { RefreshTokenRepository } from '@/infrastructure/database/repositories/refresh-token.repository';
import { RegisterDto, LoginDto, AuthResponseDto } from '@/api/dto/auth.dto';
import { UserEntity } from '@/infrastructure/database/entities/user.entity';
import {
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  InvalidTokenException,
  TokenExpiredException,
  ReplayAttackDetectedException,
} from '@/common/exceptions/business.exception';

/**
 * 认证服务
 * 负责用户注册、登录、Token 刷新等认证相关业务逻辑
 */
@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: number; // 秒

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.bcryptRounds = this.configService.get<number>(
      'BCRYPT_ROUNDS',
      12,
    );
    this.accessTokenExpiry = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '1h',
    );
    this.refreshTokenExpiry = this.configService.get<number>(
      'REFRESH_TOKEN_EXPIRES_IN',
      7 * 24 * 60 * 60, // 7 天
    );
  }

  /**
   * 用户注册
   */
  async register(
    dto: RegisterDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // 检查邮箱是否已被注册
    const exists = await this.userRepository.existsByEmail(dto.email);
    if (exists) {
      throw new EmailAlreadyExistsException();
    }

    // 加密密码
    const passwordHash = await this.hashPassword(dto.password);

    // 创建用户
    const user = await this.userRepository.create({
      email: dto.email,
      password_hash: passwordHash,
      nickname: dto.nickname,
    });

    // 生成 Token
    const tokens = await this.generateTokenPair(user, ip, userAgent);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * 用户登录
   */
  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // 查找用户
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    // 验证密码
    const isPasswordValid = await this.verifyPassword(
      dto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    // 生成 Token
    const tokens = await this.generateTokenPair(user, ip, userAgent);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(
    refreshTokenString: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; refresh_token: string }> {
    // 计算 Token 哈希
    const tokenHash = this.hashToken(refreshTokenString);

    // 查找 Refresh Token
    const refreshToken =
      await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!refreshToken) {
      throw new InvalidTokenException('Refresh Token 无效');
    }

    // 检查是否已使用（防止重放攻击）
    if (refreshToken.used_at) {
      // 检测到重放攻击，撤销该用户所有 Token
      await this.refreshTokenRepository.revokeAllByUserId(
        refreshToken.user_id,
      );
      throw new ReplayAttackDetectedException();
    }

    // 检查是否已撤销
    if (refreshToken.revoked_at) {
      throw new InvalidTokenException('Refresh Token 已被撤销');
    }

    // 检查是否过期
    if (refreshToken.expires_at < new Date()) {
      throw new TokenExpiredException('Refresh Token 已过期，请重新登录');
    }

    // 标记旧 Token 为已使用
    await this.refreshTokenRepository.markAsUsed(refreshToken.id);

    // 查找用户
    const user = await this.userRepository.findById(refreshToken.user_id);
    if (!user) {
      throw new InvalidTokenException('用户不存在');
    }

    // 生成新的 Token Pair
    const tokens = await this.generateTokenPair(user, ip, userAgent);

    return tokens;
  }

  /**
   * 用户登出
   */
  async logout(
    userId: string,
    refreshTokenString?: string,
  ): Promise<void> {
    // 撤销 Refresh Token
    if (refreshTokenString) {
      const tokenHash = this.hashToken(refreshTokenString);
      const refreshToken =
        await this.refreshTokenRepository.findByTokenHash(tokenHash);

      if (refreshToken && !refreshToken.revoked_at) {
        await this.refreshTokenRepository.revoke(refreshToken.id);
      }
    }

    // 注意: Access Token 需要通过黑名单机制失效（在 Redis 中实现）
    // 这里仅撤销 Refresh Token
  }

  /**
   * 生成 Token Pair (Access Token + Refresh Token)
   */
  private async generateTokenPair(
    user: UserEntity,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  }> {
    // 生成 Access Token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
      roles: ['user'],
    });

    // 生成 Refresh Token
    const refreshTokenString = this.generateRandomToken();
    const tokenHash = this.hashToken(refreshTokenString);
    const expiresAt = new Date(
      Date.now() + this.refreshTokenExpiry * 1000,
    );

    // 存储 Refresh Token
    await this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 小时
      refresh_token: refreshTokenString,
    };
  }

  /**
   * 加密密码
   */
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * 验证密码
   */
  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * 生成随机 Token
   */
  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 计算 Token 哈希
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 清理用户敏感信息
   */
  private sanitizeUser(user: UserEntity) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }
}
