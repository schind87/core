#!/bin/bash
while true; do
  inotifywait -e modify dist/family-calendar-card.js
  cp dist/family-calendar-card.js /home/vscode/core/config/www/community/family-calendar-card/
  echo "Copied updated file"
done
