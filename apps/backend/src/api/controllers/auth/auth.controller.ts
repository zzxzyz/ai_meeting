import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@/application/services/auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, TokenResponseDto } from '@/api/dto/auth.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ThrottlerAuthGuard } from '@/common/guards/throttler-auth.guard';

/**
 * 认证控制器
 * 处理用户注册、登录、Token 刷新、登出等请求
 */
@ApiTags('认证')
@Controller('auth')
@UseGuards(ThrottlerAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册
   * 限流: 3 次/60 分钟/IP
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } }) // 3 次/60 分钟
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '邮箱已被注册' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.register(dto, ip, userAgent);

    // 设置 Refresh Token Cookie
    this.setRefreshTokenCookie(res, result.refresh_token);

    // 返回响应（不包含 refresh_token）
    const { refresh_token, ...response } = result;

    return {
      code: 0,
      message: '注册成功',
      data: response,
    };
  }

  /**
   * 用户登录
   * 限流: 5 次/15 分钟/IP
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } }) // 5 次/15 分钟
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(dto, ip, userAgent);

    // 设置 Refresh Token Cookie
    this.setRefreshTokenCookie(res, result.refresh_token);

    // 返回响应（不包含 refresh_token）
    const { refresh_token, ...response } = result;

    return {
      code: 0,
      message: '登录成功',
      data: response,
    };
  }

  /**
   * 刷新 Access Token
   * 限流: 10 次/1 分钟/用户
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } }) // 10 次/1 分钟
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token' })
  @ApiResponse({
    status: 200,
    description: 'Token 刷新成功',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh Token 无效或已过期' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new Error('缺少 Refresh Token');
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshAccessToken(
      refreshToken,
      ip,
      userAgent,
    );

    // 设置新的 Refresh Token Cookie
    this.setRefreshTokenCookie(res, result.refresh_token);

    // 返回响应（不包含 refresh_token）
    const { refresh_token: newRefreshToken, ...response } = result;

    return {
      code: 0,
      message: 'Token 刷新成功',
      data: response,
    };
  }

  /**
   * 用户登出
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  @ApiResponse({ status: 401, description: '未认证或 Token 无效' })
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.id;
    const refreshToken = req.cookies?.refresh_token;

    await this.authService.logout(userId, refreshToken);

    // 清除 Refresh Token Cookie
    this.clearRefreshTokenCookie(res);

    return {
      code: 0,
      message: '登出成功',
    };
  }

  /**
   * 设置 Refresh Token Cookie
   */
  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 生产环境使用 HTTPS
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
      path: '/auth/refresh',
    });
  }

  /**
   * 清除 Refresh Token Cookie
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
    });
  }
}
