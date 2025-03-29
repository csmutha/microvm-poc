# MicroVM POC - NestJS Microservices Architecture

This project demonstrates a microservices architecture using NestJS, with each REST API and UI page deployed as a separate microVM. The system is deployed using Docker and Kubernetes, with observability for monitoring and logging.

## Architecture Overview

The system consists of:

- **5 independent NestJS REST API microservices**, each running on its own microVM:
  - User Management Service (api-service-1)
  - Product Management Service (api-service-2)
  - Order Management Service (api-service-3)
  - (Two more services can be added following the same pattern)

- **3 UI pages**, each deployed on a separate microVM:
  - User Dashboard (ui-service-1)
  - (Two more UI services can be added following the same pattern)

- **API Gateway** for routing requests to the appropriate microservices
- **Observability Stack** with Prometheus and Grafana for monitoring and logging

## Prerequisites

To run this POC, you need the following tools installed on your Mac:

- [Lima](https://github.com/lima-vm/lima) - For running microVMs
- [Docker](https://www.docker.com/products/docker-desktop/) - For building container images
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - For interacting with the Kubernetes cluster

## Project Structure

```
microvm-poc/
├── api-service-1/         # User Management Service
├── api-service-2/         # Product Management Service
├── api-service-3/         # Order Management Service
├── ui-service-1/          # User Dashboard UI
├── k8s/                   # Kubernetes manifests
│   ├── namespace.yaml
│   ├── api-service-1.yaml
│   ├── api-service-2.yaml
│   ├── api-service-3.yaml
│   ├── ui-service-1.yaml
│   ├── api-gateway.yaml
│   └── observability.yaml
├── docker-compose.yml     # For local development
├── deploy.sh              # One-click deployment script
└── README.md              # This file
```

## Getting Started

### Local Development

For local development without microVMs, you can use Docker Compose:

```bash
cd microvm-poc
docker-compose up
```

This will start all services locally, and you can access:
- User Service: http://localhost:3001/api/v1/users
- Product Service: http://localhost:3002/api/v1/products
- Order Service: http://localhost:3003/api/v1/orders
- UI Dashboard: http://localhost:8001

### MicroVM Deployment

To deploy the full microVM architecture:

```bash
cd microvm-poc
./deploy.sh
```

This script will:
1. Check for required tools
2. Build and push Docker images to a local registry
3. Create 8 microVMs (5 for APIs + 3 for UIs)
4. Deploy Kubernetes on the microVMs
5. Deploy the application components
6. Configure local hosts file for easy access
7. Print access information

> **Note**: The script is configured to create 8 VMs by default. You can verify the VMs are created by running `limactl list`. If you see fewer VMs than expected, you may need to adjust the VM creation process:
> 
> 1. You can modify the `VM_COUNT` variable in the `deploy.sh` script (default is 8)
> 2. For testing purposes, you can reduce this number to 3 or 4 VMs
> 3. If you encounter issues with VM creation, try running the script again or create VMs manually using `limactl start --name=microvm-poc-vm-X /tmp/microvm-poc-vm-X.yaml`

After deployment, you can access:
- Dashboard: http://dashboard.microvm-poc.local
- API Gateway: http://api.microvm-poc.local
- Monitoring: http://monitoring.microvm-poc.local

## API Services

### User Service (api-service-1)

Manages user accounts and authentication.

Endpoints:
- `GET /api/v1/users` - List all users
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create a new user
- `PUT /api/v1/users/:id` - Update a user
- `DELETE /api/v1/users/:id` - Delete a user

### Product Service (api-service-2)

Manages product catalog.

Endpoints:
- `GET /api/v1/products` - List all products
- `GET /api/v1/products/:id` - Get product by ID
- `POST /api/v1/products` - Create a new product
- `PUT /api/v1/products/:id` - Update a product
- `DELETE /api/v1/products/:id` - Delete a product

### Order Service (api-service-3)

Manages customer orders.

Endpoints:
- `GET /api/v1/orders` - List all orders
- `GET /api/v1/orders/:id` - Get order by ID
- `POST /api/v1/orders` - Create a new order
- `PUT /api/v1/orders/:id/status` - Update order status
- `PUT /api/v1/orders/:id/cancel` - Cancel an order

## Observability

The system includes a comprehensive observability stack:

- **Prometheus** for metrics collection
- **Grafana** for visualization and dashboards

Access the monitoring dashboard at http://monitoring.microvm-poc.local

## Cleanup

To clean up the microVMs and resources:

```bash
# List all microVMs
limactl list

# Stop and remove each microVM
for i in {1..8}; do
  limactl stop microvm-poc-vm-$i
  limactl delete microvm-poc-vm-$i
done

# Remove Docker registry
docker stop registry
docker rm registry
```

## Extending the System

### Adding a New API Service

1. Create a new NestJS project:
   ```bash
   nest new api-service-X
   ```

2. Implement your service logic

3. Create a Dockerfile similar to the existing services

4. Add the service to docker-compose.yml

5. Create Kubernetes manifests in the k8s directory

6. Update the API Gateway configuration to route to your new service

### Adding a New UI Service

1. Create a new React project structure

2. Implement your UI components

3. Create a Dockerfile similar to the existing UI service

4. Add the service to docker-compose.yml

5. Create Kubernetes manifests in the k8s directory

## License

This project is licensed under the MIT License - see the LICENSE file for details.
