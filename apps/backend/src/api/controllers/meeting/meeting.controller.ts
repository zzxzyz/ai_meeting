import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MeetingService } from '@/application/services/meeting.service';
import { CreateMeetingDto, JoinMeetingDto, MeetingListQueryDto } from '@/api/dto/meeting.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ThrottlerAuthGuard } from '@/common/guards/throttler-auth.guard';

/**
 * 从请求中获取当前用户的装饰器
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * 会议管理控制器
 * 处理会议创建、加入、查询、结束等请求
 */
@ApiTags('会议管理')
@ApiBearerAuth()
@Controller('meetings')
@UseGuards(ThrottlerAuthGuard, JwtAuthGuard)
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  /**
   * 创建会议
   * 限流: 10 次/分钟/用户
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建会议' })
  @ApiResponse({ status: 201, description: '会议创建成功' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async createMeeting(
    @CurrentUser() user: any,
    @Body() dto: CreateMeetingDto,
  ) {
    const data = await this.meetingService.createMeeting(dto, user.id);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 加入会议
   * 限流: 20 次/分钟/用户
   */
  @Post('join')
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '加入会议' })
  @ApiResponse({ status: 200, description: '加入成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '会议不存在' })
  @ApiResponse({ status: 410, description: '会议已结束' })
  async joinMeeting(
    @CurrentUser() user: any,
    @Body() dto: JoinMeetingDto,
  ) {
    const data = await this.meetingService.joinMeeting(dto.meetingNumber, user.id);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 查询会议列表
   * 限流: 60 次/分钟/用户
   */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询会议列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMeetingList(
    @CurrentUser() user: any,
    @Query() query: MeetingListQueryDto,
  ) {
    const data = await this.meetingService.getMeetingList(user.id, query);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 查询会议详情
   * 限流: 60 次/分钟/用户
   */
  @Get(':meetingId')
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询会议详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: '会议不存在' })
  async getMeetingDetail(
    @CurrentUser() user: any,
    @Param('meetingId') meetingId: string,
  ) {
    const data = await this.meetingService.getMeetingDetail(meetingId, user.id);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }

  /**
   * 结束会议（仅创建者）
   * 限流: 5 次/分钟/用户
   */
  @Post(':meetingId/end')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '结束会议' })
  @ApiResponse({ status: 200, description: '会议结束成功' })
  @ApiResponse({ status: 403, description: '非会议创建者' })
  @ApiResponse({ status: 404, description: '会议不存在' })
  @ApiResponse({ status: 409, description: '会议已结束' })
  async endMeeting(
    @CurrentUser() user: any,
    @Param('meetingId') meetingId: string,
  ) {
    const data = await this.meetingService.endMeeting(meetingId, user.id);
    return {
      code: 0,
      message: 'success',
      data,
    };
  }
}
