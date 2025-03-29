#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="localhost:5000"
NAMESPACE="microvm-poc"
VM_COUNT=8
VM_PREFIX="microvm-poc"
VM_MEMORY="1GiB"
VM_CPUS=1

# Print section header
print_header() {
  echo -e "\n${GREEN}==== $1 ====${NC}\n"
}

# Print step
print_step() {
  echo -e "${YELLOW}-> $1${NC}"
}

# Print error and exit
print_error() {
  echo -e "${RED}ERROR: $1${NC}"
  exit 1
}

# Check if command exists
check_command() {
  if ! command -v $1 &> /dev/null; then
    print_error "$1 is required but not installed. Please install it first."
  fi
}

# Check required tools
check_requirements() {
  print_header "Checking requirements"
  
  print_step "Checking for required tools..."
  check_command "lima"
  check_command "limactl"
  check_command "docker"
  check_command "kubectl"
  
  echo "All required tools are installed."
}

# Build Docker images
build_images() {
  print_header "Building Docker images"
  
  # Start local Docker registry if not running
  print_step "Ensuring local Docker registry is running..."
  if ! docker ps | grep -q "registry:2"; then
    docker run -d -p 5001:5000 --restart=always --name registry registry:2
    echo "Started local Docker registry at localhost:5001"
    # Update registry address
    REGISTRY="localhost:5001"
  else
    echo "Local Docker registry is already running"
  fi
  
  # Build and push API services
  for i in {1..3}; do
    print_step "Building api-service-$i..."
    docker build -t ${REGISTRY}/microvm-poc/api-service-$i:latest ./api-service-$i
    docker push ${REGISTRY}/microvm-poc/api-service-$i:latest
  done
  
  # Build and push UI service
  print_step "Building ui-service-1..."
  docker build -t ${REGISTRY}/microvm-poc/ui-service-1:latest ./ui-service-1
  docker push ${REGISTRY}/microvm-poc/ui-service-1:latest
  
  echo "All Docker images built and pushed to registry."
}

# Create and configure microVMs
create_microvms() {
  print_header "Creating microVMs"
  
  # Create VMs
  for i in $(seq 1 $VM_COUNT); do
    VM_NAME="${VM_PREFIX}-vm-$i"
    print_step "Creating VM: $VM_NAME..."
    
    # Check if VM already exists
    if limactl list | grep -q "$VM_NAME"; then
      echo "VM $VM_NAME already exists, skipping creation."
      continue
    fi
    
    # Create VM with custom configuration
    cat > /tmp/${VM_NAME}.yaml <<EOF
# VM configuration for $VM_NAME
cpus: $VM_CPUS
memory: "$VM_MEMORY"
disk: "10GiB"

# Use Ubuntu 22.04 image
images:
  - location: "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img"
    arch: "x86_64"
  - location: "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-arm64.img"
    arch: "aarch64"

# Enable Docker
provision:
  - mode: system
    script: |
      #!/bin/bash
      set -eux -o pipefail
      # Install Docker
      if ! command -v docker >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y apt-transport-https ca-certificates curl software-properties-common
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        usermod -aG docker lima
      fi
      
      # Install kubectl
      if ! command -v kubectl >/dev/null 2>&1; then
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl"
        chmod +x kubectl
        mv kubectl /usr/local/bin/
      fi
      
      # Configure Docker to use local registry
      cat > /etc/docker/daemon.json <<'EOF'
{
  "insecure-registries": ["localhost:5001", "localhost:5001"]
}
EOF
      systemctl restart docker
EOF
    
    # Start the VM
    limactl start --name=$VM_NAME /tmp/${VM_NAME}.yaml
    
    # Configure VM
    print_step "Configuring VM: $VM_NAME..."
    limactl shell $VM_NAME sudo mkdir -p /etc/rancher/k3s
    limactl shell $VM_NAME sudo tee /etc/rancher/k3s/registries.yaml > /dev/null <<EOF
mirrors:
  "${REGISTRY}":
    endpoint:
      - "http://${REGISTRY}"
EOF
  done
  
  echo "All microVMs created and configured."
}

# Deploy Kubernetes components
deploy_kubernetes() {
  print_header "Deploying Kubernetes components"
  
  # Initialize Kubernetes on the first VM
  MASTER_VM="${VM_PREFIX}-vm-1"
  print_step "Initializing Kubernetes on $MASTER_VM..."
  
  # Install K3s on master node
  limactl shell $MASTER_VM -- bash -c "curl -sfL https://get.k3s.io | sh -"
  
  # Get K3s token
  K3S_TOKEN=$(limactl shell $MASTER_VM -- sudo cat /var/lib/rancher/k3s/server/node-token)
  MASTER_IP=$(limactl shell $MASTER_VM -- hostname -I | awk '{print $1}')
  
  # Join worker nodes
  for i in $(seq 2 $VM_COUNT); do
    WORKER_VM="${VM_PREFIX}-vm-$i"
    print_step "Joining $WORKER_VM to Kubernetes cluster..."
    limactl shell $WORKER_VM -- bash -c "curl -sfL https://get.k3s.io | K3S_URL=https://${MASTER_IP}:6443 K3S_TOKEN=${K3S_TOKEN} sh -"
  done
  
  # Copy kubeconfig from master
  print_step "Setting up kubectl configuration..."
  mkdir -p ~/.kube
  limactl shell $MASTER_VM -- sudo cat /etc/rancher/k3s/k3s.yaml > /tmp/k3s.yaml
  sed "s/127.0.0.1/${MASTER_IP}/" /tmp/k3s.yaml > ~/.kube/config
  chmod 600 ~/.kube/config
  
  # Wait for nodes to be ready
  print_step "Waiting for all nodes to be ready..."
  kubectl wait --for=condition=ready node --all --timeout=300s
  
  echo "Kubernetes cluster is ready."
}

# Deploy application
deploy_application() {
  print_header "Deploying application"
  
  # Create namespace
  print_step "Creating namespace..."
  kubectl apply -f ./k8s/namespace.yaml
  
  # Deploy services
  print_step "Deploying API services..."
  kubectl apply -f ./k8s/api-service-1.yaml
  kubectl apply -f ./k8s/api-service-2.yaml
  kubectl apply -f ./k8s/api-service-3.yaml
  
  print_step "Deploying API Gateway..."
  kubectl apply -f ./k8s/api-gateway.yaml
  
  print_step "Deploying UI service..."
  kubectl apply -f ./k8s/ui-service-1.yaml
  
  print_step "Deploying observability stack..."
  kubectl apply -f ./k8s/observability.yaml
  
  # Wait for deployments to be ready
  print_step "Waiting for deployments to be ready..."
  kubectl -n $NAMESPACE wait --for=condition=available deployment --all --timeout=300s
  
  echo "Application deployed successfully."
}

# Configure hosts file
configure_hosts() {
  print_header "Configuring hosts file"
  
  print_step "Adding entries to /etc/hosts..."
  MASTER_IP=$(limactl shell ${VM_PREFIX}-vm-1 -- hostname -I | awk '{print $1}')
  
  # Check if entries already exist
  if ! grep -q "microvm-poc.local" /etc/hosts; then
    sudo tee -a /etc/hosts > /dev/null <<EOF
# MicroVM POC entries
$MASTER_IP dashboard.microvm-poc.local api.microvm-poc.local monitoring.microvm-poc.local
EOF
    echo "Hosts file updated."
  else
    echo "Hosts entries already exist."
  fi
}

# Print access information
print_access_info() {
  print_header "Access Information"
  
  echo "Your MicroVM POC is now running!"
  echo ""
  echo "Access the services at:"
  echo "- Dashboard: http://dashboard.microvm-poc.local"
  echo "- API Gateway: http://api.microvm-poc.local"
  echo "- Monitoring: http://monitoring.microvm-poc.local"
  echo ""
  echo "Grafana credentials:"
  echo "- Username: admin"
  echo "- Password: admin"
  echo ""
  echo "To view the status of your services:"
  echo "kubectl -n $NAMESPACE get all"
  echo ""
}

# Main function
main() {
  print_header "MicroVM POC Deployment"
  
  check_requirements
  build_images
  create_microvms
  deploy_kubernetes
  deploy_application
  configure_hosts
  print_access_info
}

# Run main function
main
