import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { MediaConfig, MediaService } from '@/application/services/media.service';

@ApiTags('媒体配置')
@Controller('api/meetings/:meetingId/media-config')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * 获取会议媒体配置
   * 返回 STUN/TURN 服务器配置，用于 WebRTC ICE 候选者收集
   */
  @Get()
  @ApiOperation({
    summary: '获取会议媒体配置',
    description: '返回 STUN/TURN 服务器配置，用于 WebRTC ICE 候选者收集',
  })
  @ApiResponse({
    status: 200,
    description: '成功获取媒体配置',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        message: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            iceServers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  urls: { type: 'string', example: 'stun:stun.l.google.com:19302' },
                  username: { type: 'string', example: 'optional-username' },
                  credential: { type: 'string', example: 'optional-password' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '会议不存在',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 40401 },
        message: { type: 'string', example: '会议不存在' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '无权限访问该会议',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 40301 },
        message: { type: 'string', example: '无权限访问该会议' },
      },
    },
  })
  @ApiResponse({
    status: 410,
    description: '会议已结束',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 41001 },
        message: { type: 'string', example: '会议已结束' },
      },
    },
  })
  async getMediaConfig(@Param('meetingId') meetingId: string): Promise<{ code: number; message: string; data: MediaConfig }> {
    const mediaConfig = await this.mediaService.getMediaConfig(meetingId);

    return {
      code: 0,
      message: 'success',
      data: mediaConfig,
    };
  }
}