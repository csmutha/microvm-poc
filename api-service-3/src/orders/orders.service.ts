import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

// Define interfaces
export interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderDto {
  userId: number;
  items: {
    productId: number;
    quantity: number;
  }[];
}

@Injectable()
export class OrdersService {
  // Mock database
  private orders: Order[] = [
    {
      id: 1,
      userId: 1,
      items: [
        { productId: 1, quantity: 2, price: 999.99 },
        { productId: 3, quantity: 1, price: 199.99 },
      ],
      totalAmount: 2199.97,
      status: 'delivered',
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-01-20'),
    },
    {
      id: 2,
      userId: 2,
      items: [
        { productId: 2, quantity: 1, price: 1499.99 },
      ],
      totalAmount: 1499.99,
      status: 'processing',
      createdAt: new Date('2025-03-10'),
      updatedAt: new Date('2025-03-12'),
    },
  ];

  // Get all orders
  findAll(): Order[] {
    return this.orders;
  }

  // Get orders by user ID
  findByUserId(userId: number): Order[] {
    return this.orders.filter(order => order.userId === userId);
  }

  // Get order by ID
  findOne(id: number): Order {
    const order = this.orders.find(order => order.id === id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  // Create a new order
  create(createOrderDto: CreateOrderDto): Order {
    // In a real implementation, we would validate the user and products
    // by making HTTP requests to the user and product services
    
    // For this demo, we'll simulate product prices
    const items: OrderItem[] = createOrderDto.items.map(item => {
      // Simulate getting product price from product service
      const price = this.getProductPrice(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price,
      };
    });
    
    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    
    const newOrder: Order = {
      id: this.orders.length + 1,
      userId: createOrderDto.userId,
      items,
      totalAmount,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.orders.push(newOrder);
    return newOrder;
  }

  // Update order status
  updateStatus(id: number, status: Order['status']): Order {
    const orderIndex = this.orders.findIndex(order => order.id === id);
    if (orderIndex === -1) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    
    this.orders[orderIndex] = {
      ...this.orders[orderIndex],
      status,
      updatedAt: new Date(),
    };
    
    return this.orders[orderIndex];
  }

  // Cancel an order
  cancelOrder(id: number): Order {
    const orderIndex = this.orders.findIndex(order => order.id === id);
    if (orderIndex === -1) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    
    const order = this.orders[orderIndex];
    if (order.status === 'shipped' || order.status === 'delivered') {
      throw new BadRequestException(`Cannot cancel order with status: ${order.status}`);
    }
    
    this.orders[orderIndex] = {
      ...order,
      status: 'cancelled',
      updatedAt: new Date(),
    };
    
    return this.orders[orderIndex];
  }

  // Helper method to simulate getting product price
  private getProductPrice(productId: number): number {
    const prices = {
      1: 999.99,  // Smartphone X
      2: 1499.99, // Laptop Pro
      3: 199.99,  // Wireless Headphones
    };
    
    return prices[productId] || 0;
  }
}
