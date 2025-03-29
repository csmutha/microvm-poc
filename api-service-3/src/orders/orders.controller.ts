import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  Logger
} from '@nestjs/common';
import { OrdersService, Order, CreateOrderDto } from './orders.service';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query('userId') userId?: string): Order[] {
    if (userId) {
      const userIdNum = parseInt(userId, 10);
      this.logger.log(`Getting orders for user: ${userIdNum}`);
      return this.ordersService.findByUserId(userIdNum);
    }
    this.logger.log('Getting all orders');
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Order {
    this.logger.log(`Getting order with id: ${id}`);
    return this.ordersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOrderDto: CreateOrderDto): Order {
    this.logger.log(`Creating a new order for user: ${createOrderDto.userId}`);
    return this.ordersService.create(createOrderDto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: Order['status'],
  ): Order {
    this.logger.log(`Updating order ${id} status to: ${status}`);
    return this.ordersService.updateStatus(id, status);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(@Param('id', ParseIntPipe) id: number): Order {
    this.logger.log(`Cancelling order with id: ${id}`);
    return this.ordersService.cancelOrder(id);
  }

  // Health check endpoint
  @Get('health/check')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'ok',
      service: 'orders-api',
      timestamp: new Date().toISOString(),
    };
  }
}
