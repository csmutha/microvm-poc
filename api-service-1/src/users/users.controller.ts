import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  Logger
} from '@nestjs/common';
import { UsersService, User } from './users.service';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): User[] {
    this.logger.log('Attempting to get all users, but will throw an error');
    // Intentionally throw an error for testing log analyzer
    throw new Error('Simulated error fetching all users');
    // The original code is commented out below
    // this.logger.log('Getting all users');
    // return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): User {
    this.logger.log(`Getting user with id: ${id}`);
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: Omit<User, 'id' | 'createdAt'>): User {
    this.logger.log('Creating a new user');
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: Partial<User>,
  ): User {
    this.logger.log(`Updating user with id: ${id}`);
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.logger.log(`Deleting user with id: ${id}`);
    this.usersService.remove(id);
  }

  // Health check endpoint
  @Get('health/check')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'ok',
      service: 'users-api',
      timestamp: new Date().toISOString(),
    };
  }
}
