import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 用户响应 DTO
 */
export class UserResponseDto {
  @ApiProperty({
    description: '用户 ID',
    example: 'user_123456789',
  })
  id: string;

  @ApiProperty({
    description: '用户邮箱',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: '用户昵称',
    example: '张三',
  })
  nickname: string;

  @ApiProperty({
    description: '用户头像 URL',
    example: 'https://cdn.example.com/avatars/123456789.jpg',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: '创建时间',
    example: '2026-02-13T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: '更新时间',
    example: '2026-02-14T10:00:00Z',
  })
  updated_at: Date;
}

/**
 * 更新用户信息 DTO
 */
export class UpdateUserDto {
  @ApiProperty({
    description: '用户昵称（2-20个字符）',
    example: '张三',
    required: false,
  })
  @IsString({ message: '昵称必须是字符串' })
  @MinLength(2, { message: '昵称长度至少 2 个字符' })
  @MaxLength(20, { message: '昵称长度不能超过 20 个字符' })
  nickname?: string;

  @ApiProperty({
    description: '用户头像 URL',
    example: 'https://cdn.example.com/avatars/123456789.jpg',
    required: false,
  })
  @IsString({ message: '头像必须是字符串' })
  avatar?: string;
}
