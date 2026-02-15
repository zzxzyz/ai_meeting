import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';

/**
 * JWT 认证策略
 * 用于验证 Access Token
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * 验证 JWT Payload
   * @param payload JWT 解码后的 Payload
   * @returns 用户信息
   */
  async validate(payload: any) {
    // Payload 结构: { sub: userId, email, nickname, roles, iat, exp, jti }
    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 返回的用户信息会被挂载到 request.user
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
    };
  }
}
