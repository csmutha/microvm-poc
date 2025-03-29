import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // In a real environment, this would be the URL of the product service
        const response = await axios.get('http://localhost:3002/api/v1/products');
        setProducts(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to fetch products. Please try again later.');
        // For demo purposes, set mock data if API call fails
        setProducts([
          {
            id: 1,
            name: 'Smartphone X',
            description: 'Latest smartphone with advanced features',
            price: 999.99,
            category: 'electronics',
            inStock: true,
          },
          {
            id: 2,
            name: 'Laptop Pro',
            description: 'High-performance laptop for professionals',
            price: 1499.99,
            category: 'electronics',
            inStock: true,
          },
          {
            id: 3,
            name: 'Wireless Headphones',
            description: 'Noise-cancelling wireless headphones',
            price: 199.99,
            category: 'accessories',
            inStock: false,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4">Product Catalog</h2>
      
      {error && (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      )}
      
      <div className="row">
        {products.map(product => (
          <div className="col-md-4 mb-4" key={product.id}>
            <div className="card h-100">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">{product.name}</h5>
              </div>
              <div className="card-body">
                <p className="card-text">{product.description}</p>
                <p className="card-text">
                  <strong>Price:</strong> ${product.price.toFixed(2)}
                </p>
                <p className="card-text">
                  <strong>Category:</strong> {product.category}
                </p>
                <p className="card-text">
                  <strong>Status:</strong>{' '}
                  <span className={`badge ${product.inStock ? 'bg-success' : 'bg-danger'}`}>
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </p>
              </div>
              <div className="card-footer">
                <button className="btn btn-primary me-2">View Details</button>
                <button className="btn btn-success" disabled={!product.inStock}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductList;
