#!/bin/bash

# 1. Stop and Remove All Docker Containers and Images
# echo "Stopping and removing all Docker containers..."
# docker stop $(docker ps -aq)  # Stop all running containers
# docker rm $(docker ps -aq)    # Remove all containers

# echo "Removing all Docker images..."
# docker rmi $(docker images -q) -f  # Force remove all images

# echo "Cleaning up networks and volumes..."
# docker network prune -f  # Remove all unused networks
# docker volume prune -f   # Remove all unused volumes
# docker system prune -a -f  # Absolute cleanup

# 2. Start Multiple Lima MicroVMs
echo "Starting multiple Lima microVMs..."
limactl start --name=vm1 lima-base.yaml
limactl start --name=vm2 lima-base.yaml
limactl start --name=vm3 lima-base.yaml

# 3. Deploy Docker Services Across Multiple MicroVMs
echo "Deploying Docker services across multiple Lima VMs..."

export DOCKER_HOST=tcp://vm1:2375
docker-compose up -d service1 service4

export DOCKER_HOST=tcp://vm2:2375
docker-compose up -d service2

export DOCKER_HOST=tcp://vm3:2375
docker-compose up -d service3

echo "Deployment completed!"
