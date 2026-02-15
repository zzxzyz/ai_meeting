import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 用户注册 DTO
 */
export class RegisterDto {
  @ApiProperty({
    description: '用户邮箱',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255, { message: '邮箱长度不能超过 255 个字符' })
  email: string;

  @ApiProperty({
    description: '用户密码（8-32位，包含字母和数字）',
    example: 'Password123',
    minLength: 8,
    maxLength: 32,
  })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码长度至少 8 位' })
  @MaxLength(32, { message: '密码长度不能超过 32 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,32}$/, {
    message: '密码必须包含字母和数字',
  })
  password: string;

  @ApiProperty({
    description: '用户昵称（2-20个字符）',
    example: '张三',
    minLength: 2,
    maxLength: 20,
  })
  @IsString({ message: '昵称必须是字符串' })
  @MinLength(2, { message: '昵称长度至少 2 个字符' })
  @MaxLength(20, { message: '昵称长度不能超过 20 个字符' })
  nickname: string;
}

/**
 * 用户登录 DTO
 */
export class LoginDto {
  @ApiProperty({
    description: '用户邮箱',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @ApiProperty({
    description: '用户密码',
    example: 'Password123',
  })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(1, { message: '密码不能为空' })
  password: string;
}

/**
 * Token 响应 DTO
 */
export class TokenResponseDto {
  @ApiProperty({
    description: '访问令牌（有效期 1 小时）',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: '令牌类型',
    example: 'Bearer',
  })
  token_type: string;

  @ApiProperty({
    description: 'Access Token 过期时间（秒）',
    example: 3600,
  })
  expires_in: number;
}

/**
 * 登录/注册响应 DTO
 */
export class AuthResponseDto {
  @ApiProperty({
    description: '用户信息',
  })
  user: {
    id: string;
    email: string;
    nickname: string;
    avatar: string | null;
    created_at: Date;
    updated_at: Date;
  };

  @ApiProperty({
    description: 'Access Token',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: '令牌类型',
    example: 'Bearer',
  })
  token_type: string;

  @ApiProperty({
    description: 'Access Token 过期时间（秒）',
    example: 3600,
  })
  expires_in: number;
}
