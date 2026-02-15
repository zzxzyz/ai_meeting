import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 自定义业务异常基类
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: number,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly data?: any,
  ) {
    super(
      {
        code,
        message,
        data,
      },
      statusCode,
    );
  }
}

/**
 * 邮箱已被注册异常
 */
export class EmailAlreadyExistsException extends BusinessException {
  constructor() {
    super(40901, '邮箱已被注册', HttpStatus.CONFLICT);
  }
}

/**
 * 邮箱或密码错误异常
 */
export class InvalidCredentialsException extends BusinessException {
  constructor(remainingAttempts?: number) {
    const data = remainingAttempts !== undefined
      ? { remaining_attempts: remainingAttempts }
      : undefined;
    super(40101, '邮箱或密码错误', HttpStatus.UNAUTHORIZED, data);
  }
}

/**
 * 账户被锁定异常
 */
export class AccountLockedException extends BusinessException {
  constructor(lockedUntil: Date) {
    super(
      40102,
      '密码错误次数过多，账户已被锁定 15 分钟',
      HttpStatus.UNAUTHORIZED,
      { locked_until: lockedUntil.toISOString() },
    );
  }
}

/**
 * Token 无效异常
 */
export class InvalidTokenException extends BusinessException {
  constructor(message: string = 'Token 无效') {
    super(40103, message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Token 已过期异常
 */
export class TokenExpiredException extends BusinessException {
  constructor(message: string = 'Token 已过期') {
    super(40102, message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 检测到重放攻击异常
 */
export class ReplayAttackDetectedException extends BusinessException {
  constructor() {
    super(
      40104,
      '检测到异常，已撤销所有 Token，请重新登录',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * 限流异常
 */
export class RateLimitException extends BusinessException {
  constructor(message: string, retryAfter: number) {
    super(
      42901,
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      { retry_after: retryAfter },
    );
  }
}
