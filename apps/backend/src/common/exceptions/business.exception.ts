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

/**
 * 会议不存在异常
 */
export class MeetingNotFoundException extends BusinessException {
  constructor(message: string = '会议不存在，请检查会议号是否正确') {
    super(40401, message, HttpStatus.NOT_FOUND);
  }
}

/**
 * 会议已结束异常（无法加入）
 */
export class MeetingAlreadyEndedException extends BusinessException {
  constructor(message: string = '该会议已结束，无法加入') {
    super(41001, message, HttpStatus.GONE);
  }
}

/**
 * 会议已结束异常（无法重复结束）
 */
export class MeetingAlreadyEndedConflictException extends BusinessException {
  constructor(message: string = '会议已结束') {
    super(40901, message, HttpStatus.CONFLICT);
  }
}

/**
 * 无权限查询会议异常
 */
export class MeetingForbiddenException extends BusinessException {
  constructor(message: string = '无权限查询该会议') {
    super(40301, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 非会议创建者无权结束会议异常
 */
export class MeetingNotCreatorException extends BusinessException {
  constructor(message: string = '只有会议创建者可以结束会议') {
    super(40302, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 会议号生成失败异常
 */
export class MeetingNumberGenerationFailedException extends BusinessException {
  constructor() {
    super(50001, '会议号生成失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
