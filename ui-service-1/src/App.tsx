import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import UserDashboard from './components/UserDashboard';
import ProductList from './components/ProductList';
import OrderList from './components/OrderList';

const App: React.FC = () => {
  return (
    <div className="app">
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <Link className="navbar-brand" to="/">MicroVM POC - Dashboard</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav">
              <li className="nav-item">
                <Link className="nav-link" to="/">Users</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/products">Products</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/orders">Orders</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        <Routes>
          <Route path="/" element={<UserDashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/orders" element={<OrderList />} />
        </Routes>
      </div>

      <footer className="bg-light py-3 mt-5">
        <div className="container text-center">
          <p className="text-muted mb-0">MicroVM POC - NestJS Microservices Architecture</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
