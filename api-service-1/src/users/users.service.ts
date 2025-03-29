import { Injectable, NotFoundException } from '@nestjs/common';

// Define a User interface
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  // Mock database
  private users: User[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'user',
      createdAt: new Date(),
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      role: 'user',
      createdAt: new Date(),
    },
  ];

  // Get all users
  findAll(): User[] {
    return this.users;
  }

  // Get user by ID
  findOne(id: number): User {
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  // Create a new user
  create(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      id: this.users.length + 1,
      ...user,
      createdAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  // Update a user
  update(id: number, updateData: Partial<User>): User {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    // Update the user
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updateData,
    };
    
    return this.users[userIndex];
  }

  // Delete a user
  remove(id: number): void {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    this.users.splice(userIndex, 1);
  }
}
