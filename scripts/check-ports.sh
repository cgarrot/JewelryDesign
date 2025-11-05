#!/bin/bash

# Port availability checker for production deployment
# This script checks which ports are in use by Docker containers
# and suggests available ports for the jewelry app deployment

set -e

echo "Checking Docker containers and port usage..."
echo "============================================"
echo ""

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "Error: Docker daemon is not running"
    exit 1
fi

# Function to check if a port is available
check_port_available() {
    local port=$1
    # Check if port is in use by any Docker container
    if docker ps --format "{{.Ports}}" | grep -q ":$port->"; then
        return 1  # Port is in use
    fi
    # Also check if port is listening on host
    if command -v lsof &> /dev/null; then
        if lsof -i :$port &> /dev/null; then
            return 1  # Port is in use
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            return 1  # Port is in use
        fi
    fi
    return 0  # Port is available
}

# Function to find next available port
find_available_port() {
    local start_port=$1
    local max_port=$((start_port + 100))
    local port=$start_port
    
    while [ $port -lt $max_port ]; do
        if check_port_available $port; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    echo ""  # No available port found
    return 1
}

# List all running Docker containers and their ports
echo "Running Docker containers:"
echo "-------------------------"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" || echo "No containers running"
echo ""

# Check specific ports we care about
PORTS_TO_CHECK=(3000 5432 9000 9001)
USED_PORTS=()
AVAILABLE_PORTS=()

echo "Port status check:"
echo "------------------"
for port in "${PORTS_TO_CHECK[@]}"; do
    if check_port_available $port; then
        echo "✓ Port $port is available"
        AVAILABLE_PORTS+=($port)
    else
        echo "✗ Port $port is in use"
        USED_PORTS+=($port)
        
        # Show which container is using it
        container=$(docker ps --format "{{.Names}}\t{{.Ports}}" | grep ":$port->" | awk '{print $1}' | head -1)
        if [ -n "$container" ]; then
            echo "  → Used by container: $container"
        fi
    fi
done
echo ""

# Check application port (3000)
APP_PORT=3000
if ! check_port_available $APP_PORT; then
    echo "⚠️  Port 3000 is already in use!"
    echo "Finding alternative port..."
    ALTERNATIVE_PORT=$(find_available_port 3001)
    if [ -n "$ALTERNATIVE_PORT" ]; then
        echo "✓ Found available port: $ALTERNATIVE_PORT"
        APP_PORT=$ALTERNATIVE_PORT
    else
        echo "✗ Error: Could not find an available port (checked up to 3100)"
        exit 1
    fi
else
    echo "✓ Port 3000 is available for the application"
fi

echo ""
echo "============================================"
echo "Recommended configuration:"
echo "  APP_PORT=$APP_PORT"
echo "============================================"

# Export the port for use in other scripts
export APP_PORT
echo $APP_PORT
