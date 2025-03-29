import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // In a real environment, this would be the URL of the order service
        const response = await axios.get('http://localhost:3003/api/v1/orders');
        setOrders(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to fetch orders. Please try again later.');
        // For demo purposes, set mock data if API call fails
        setOrders([
          {
            id: 1,
            userId: 1,
            items: [
              { productId: 1, quantity: 2, price: 999.99 },
              { productId: 3, quantity: 1, price: 199.99 },
            ],
            totalAmount: 2199.97,
            status: 'delivered',
            createdAt: '2025-01-15T00:00:00.000Z',
            updatedAt: '2025-01-20T00:00:00.000Z',
          },
          {
            id: 2,
            userId: 2,
            items: [
              { productId: 2, quantity: 1, price: 1499.99 },
            ],
            totalAmount: 1499.99,
            status: 'processing',
            createdAt: '2025-03-10T00:00:00.000Z',
            updatedAt: '2025-03-12T00:00:00.000Z',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusBadgeClass = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-warning';
      case 'processing':
        return 'bg-info';
      case 'shipped':
        return 'bg-primary';
      case 'delivered':
        return 'bg-success';
      case 'cancelled':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  };

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
      <h2 className="mb-4">Order Management</h2>
      
      {error && (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      )}
      
      {orders.length === 0 ? (
        <div className="alert alert-info">No orders found.</div>
      ) : (
        orders.map(order => (
          <div className="card mb-4" key={order.id}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Order #{order.id}</h5>
              <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <div className="card-body">
              <p><strong>User ID:</strong> {order.userId}</p>
              <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> ${order.totalAmount.toFixed(2)}</p>
              
              <h6 className="mt-4 mb-3">Items</h6>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.productId}</td>
                        <td>{item.quantity}</td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>${(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-primary me-2">View Details</button>
              {order.status === 'pending' && (
                <button className="btn btn-danger">Cancel Order</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default OrderList;
