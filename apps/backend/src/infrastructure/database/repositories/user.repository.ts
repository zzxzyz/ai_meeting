import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';

/**
 * 用户仓储
 * 负责用户数据的持久化操作
 */
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  /**
   * 创建用户
   */
  async create(data: {
    email: string;
    password_hash: string;
    nickname: string;
    avatar?: string | null;
  }): Promise<UserEntity> {
    const user = this.repository.create(data);
    return await this.repository.save(user);
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { id } });
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.repository.findOne({ where: { email } });
  }

  /**
   * 更新用户信息
   */
  async update(
    id: string,
    data: Partial<Pick<UserEntity, 'nickname' | 'avatar'>>,
  ): Promise<UserEntity | null> {
    await this.repository.update(id, data);
    return await this.findById(id);
  }

  /**
   * 删除用户
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== null && result.affected > 0;
  }

  /**
   * 检查邮箱是否已被注册
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.count({ where: { email } });
    return count > 0;
  }
}
