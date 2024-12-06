#!/bin/bash

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Navigate to frontend directory
cd "$SCRIPT_DIR/frontend"

# Create target directory if it doesn't exist
mkdir -p /workspaces/core/config/www/community/family-calendar-card

# Function to copy files
copy_files() {
    echo "Copying files at $(date)"
    cp -f dist/family-calendar-card.js /workspaces/core/config/www/community/family-calendar-card/
    cp -f dist/family-calendar-card.js.map /workspaces/core/config/www/community/family-calendar-card/
    echo "Files copied successfully"
}

# Run rollup in watch mode in the background
npm run watch &
ROLLUP_PID=$!

# Watch for changes in dist and copy to www directory
while inotifywait -e modify,create,delete -r dist/; do
    copy_files
done

# Clean up the rollup watch process when this script exits
trap "kill $ROLLUP_PID" EXIT