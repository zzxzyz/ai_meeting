import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';
import { UserResponseDto, UpdateUserDto } from '@/api/dto/user.dto';

/**
 * 用户服务
 * 负责用户信息管理相关业务逻辑
 */
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * 根据 ID 获取用户信息
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.toResponseDto(user);
  }

  /**
   * 更新用户信息
   */
  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.update(id, dto);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.toResponseDto(user);
  }

  /**
   * 转换为响应 DTO
   */
  private toResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
