#!/bin/bash

# Get the actual script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "Script directory: $SCRIPT_DIR"

# Navigate to frontend directory
cd "$SCRIPT_DIR/frontend"
echo "Current directory: $(pwd)"

# Clean up old installations
rm -rf node_modules
rm -rf dist
echo "Cleaned up old installations"

# Install dependencies
npm install

# Create directories if they don't exist
echo "Creating directories..."
mkdir -pv /workspaces/core/config/www/community/family-calendar-card
mkdir -pv dist

# Create symbolic link for development
echo "Creating symbolic link..."
ln -sfv "$(pwd)/dist/family-calendar-card.js" /workspaces/core/config/www/community/family-calendar-card/family-calendar-card.js

# Initial build
echo "Starting build..."
npm run build
echo "Setup complete!"