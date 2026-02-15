import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '@/application/services/user.service';
import { UserResponseDto, UpdateUserDto } from '@/api/dto/user.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

/**
 * 用户控制器
 * 处理用户信息管理相关请求
 */
@ApiTags('用户')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户信息
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '成功获取用户信息',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: '未认证或 Token 无效' })
  async getCurrentUser(@Req() req: any) {
    const userId = req.user.id;
    const user = await this.userService.findById(userId);

    return {
      code: 0,
      message: '成功',
      data: user,
    };
  }

  /**
   * 更新当前用户信息
   */
  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未认证或 Token 无效' })
  async updateCurrentUser(
    @Req() req: any,
    @Body() dto: UpdateUserDto,
  ) {
    const userId = req.user.id;
    const user = await this.userService.update(userId, dto);

    return {
      code: 0,
      message: '更新成功',
      data: user,
    };
  }
}
