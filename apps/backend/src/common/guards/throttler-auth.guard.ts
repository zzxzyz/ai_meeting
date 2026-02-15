import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * 认证接口限流守卫
 * 用于注册和登录接口的限流保护
 */
@Injectable()
export class ThrottlerAuthGuard extends ThrottlerGuard {
  /**
   * 获取限流的 tracker key
   * 使用 IP 地址作为限流标识
   */
  protected async getTracker(req: Request): Promise<string> {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip;
  }

  /**
   * 生成限流的 throttler key
   */
  protected generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ): string {
    const request = context.switchToHttp().getRequest<Request>();
    const endpoint = request.path;
    return `${throttlerName}:${endpoint}:${tracker}`;
  }
}
