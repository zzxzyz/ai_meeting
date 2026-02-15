import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from '@/application/services/user.service';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';
import { UpdateUserDto } from '@/api/dto/user.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password_hash: 'hashedpassword',
    nickname: '测试用户',
    avatar: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('应该成功获取用户信息', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser as any);

      // Act
      const result = await service.findById('user-123');

      // Assert
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        nickname: mockUser.nickname,
        avatar: mockUser.avatar,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('用户不存在时应该抛出 NotFoundException', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('user-123')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      nickname: '新昵称',
      avatar: 'https://example.com/avatar.jpg',
    };

    it('应该成功更新用户信息', async () => {
      // Arrange
      const updatedUser = { ...mockUser, ...updateDto };
      userRepository.update.mockResolvedValue(updatedUser as any);

      // Act
      const result = await service.update('user-123', updateDto);

      // Assert
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-123',
        updateDto,
      );
      expect(result).toEqual({
        id: updatedUser.id,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      });
    });

    it('用户不存在时应该抛出 NotFoundException', async () => {
      // Arrange
      userRepository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('user-123', updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-123',
        updateDto,
      );
    });
  });
});
