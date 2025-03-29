import { Injectable, NotFoundException } from '@nestjs/common';

// Define a Product interface
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: Date;
}

@Injectable()
export class ProductsService {
  // Mock database
  private products: Product[] = [
    {
      id: 1,
      name: 'Smartphone X',
      description: 'Latest smartphone with advanced features',
      price: 999.99,
      category: 'electronics',
      inStock: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      name: 'Laptop Pro',
      description: 'High-performance laptop for professionals',
      price: 1499.99,
      category: 'electronics',
      inStock: true,
      createdAt: new Date(),
    },
    {
      id: 3,
      name: 'Wireless Headphones',
      description: 'Noise-cancelling wireless headphones',
      price: 199.99,
      category: 'accessories',
      inStock: false,
      createdAt: new Date(),
    },
  ];

  // Get all products
  findAll(): Product[] {
    return this.products;
  }

  // Get products by category
  findByCategory(category: string): Product[] {
    return this.products.filter(product => product.category === category);
  }

  // Get product by ID
  findOne(id: number): Product {
    const product = this.products.find(product => product.id === id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  // Create a new product
  create(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const newProduct: Product = {
      id: this.products.length + 1,
      ...product,
      createdAt: new Date(),
    };
    this.products.push(newProduct);
    return newProduct;
  }

  // Update a product
  update(id: number, updateData: Partial<Product>): Product {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    
    // Update the product
    this.products[productIndex] = {
      ...this.products[productIndex],
      ...updateData,
    };
    
    return this.products[productIndex];
  }

  // Delete a product
  remove(id: number): void {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    this.products.splice(productIndex, 1);
  }
}
