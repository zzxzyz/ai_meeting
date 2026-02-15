import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

/**
 * Refresh Token 仓储
 * 负责 Refresh Token 的持久化操作
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repository: Repository<RefreshTokenEntity>,
  ) {}

  /**
   * 创建 Refresh Token
   */
  async create(data: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
    ip?: string;
    user_agent?: string;
  }): Promise<RefreshTokenEntity> {
    const token = this.repository.create(data);
    return await this.repository.save(token);
  }

  /**
   * 根据 ID 查找 Token
   */
  async findById(id: string): Promise<RefreshTokenEntity | null> {
    return await this.repository.findOne({ where: { id } });
  }

  /**
   * 根据 token_hash 查找 Token
   */
  async findByTokenHash(
    token_hash: string,
  ): Promise<RefreshTokenEntity | null> {
    return await this.repository.findOne({ where: { token_hash } });
  }

  /**
   * 标记 Token 为已使用
   */
  async markAsUsed(id: string): Promise<void> {
    await this.repository.update(id, {
      used_at: new Date(),
    });
  }

  /**
   * 撤销 Token
   */
  async revoke(id: string): Promise<void> {
    await this.repository.update(id, {
      revoked_at: new Date(),
    });
  }

  /**
   * 撤销用户的所有 Token
   */
  async revokeAllByUserId(user_id: string): Promise<void> {
    await this.repository.update(
      {
        user_id,
        revoked_at: null,
      },
      {
        revoked_at: new Date(),
      },
    );
  }

  /**
   * 查找用户的有效 Token
   */
  async findValidTokensByUserId(
    user_id: string,
  ): Promise<RefreshTokenEntity[]> {
    return await this.repository.find({
      where: {
        user_id,
        used_at: null,
        revoked_at: null,
      },
    });
  }

  /**
   * 删除过期的 Token
   */
  async deleteExpired(): Promise<number> {
    const result = await this.repository.delete({
      expires_at: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
