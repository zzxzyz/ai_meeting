import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建会议 DTO
 */
export class CreateMeetingDto {
  @ApiPropertyOptional({
    description: '会议标题，最长 50 字符',
    example: '产品评审会议',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: '会议标题必须是字符串' })
  @MaxLength(50, { message: '会议标题不能超过 50 个字符' })
  title?: string;
}

/**
 * 加入会议 DTO
 */
export class JoinMeetingDto {
  @ApiProperty({
    description: '9 位数字会议号',
    example: '123456789',
    pattern: '^\\d{9}$',
  })
  @IsString({ message: '会议号必须是字符串' })
  @Matches(/^\d{9}$/, { message: '会议号格式不正确，请输入 9 位数字' })
  meetingNumber: string;
}

/**
 * 会议列表查询 DTO
 */
export class MeetingListQueryDto {
  @ApiPropertyOptional({
    description: '过滤类型：created=我创建的，joined=我参加的',
    enum: ['created', 'joined'],
  })
  @IsOptional()
  @IsIn(['created', 'joined'], { message: 'type 必须为 created 或 joined' })
  type?: 'created' | 'joined';

  @ApiPropertyOptional({
    description: '页码，从 1 开始',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码不能小于 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数，最大 50',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数不能小于 1' })
  @Max(50, { message: '每页条数不能超过 50' })
  pageSize?: number = 10;
}
