import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';

/**
 * Users service
 * Handles business logic for user management
 * Responsible for authentication, authorization, and user CRUD
 */
@Injectable()
export class UsersService {
  // TODO: Implement in-memory storage or database integration later

  /**
   * Create a new user
   * Password should be hashed before storing
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find all users
   * May include filtering by role or active status
   */
  async findAll(): Promise<User[]> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<User> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Find user by email
   * Used for authentication
   */
  async findByEmail(email: string): Promise<User> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Implementation pending
    throw new Error('Not implemented');
  }

  /**
   * Soft delete user (set isActive to false)
   * Users are not permanently deleted to maintain data integrity
   */
  async remove(id: string): Promise<void> {
    // Implementation pending
    throw new Error('Not implemented');
  }
}
