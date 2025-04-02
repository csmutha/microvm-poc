import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  Logger
} from '@nestjs/common';
import { ProductsService, Product } from './products.service';

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query('category') category?: string): Product[] {
    if (category) {
      this.logger.log(`Getting products by category: ${category}`);
      return this.productsService.findByCategory(category);
    }
    this.logger.log('Attempting to get all products, but will throw an error');
    // Intentionally throw an error for testing log analyzer
    throw new Error('Simulated error fetching all products');
    // The original code is commented out below
    // this.logger.log('Getting all products');
    // return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Product {
    this.logger.log(`Getting product with id: ${id}`);
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProductDto: Omit<Product, 'id' | 'createdAt'>): Product {
    this.logger.log('Creating a new product');
    return this.productsService.create(createProductDto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: Partial<Product>,
  ): Product {
    this.logger.log(`Updating product with id: ${id}`);
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.logger.log(`Deleting product with id: ${id}`);
    this.productsService.remove(id);
  }

  // Health check endpoint
  @Get('health/check')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'ok',
      service: 'products-api',
      timestamp: new Date().toISOString(),
    };
  }
}
