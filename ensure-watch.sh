#!/bin/bash

# Script to ensure library watch mode is running

LIB_DIR="/Users/zikolight/ngx-event-hub/ngx-event-hub-lib"
DEMO_DIR="/Users/zikolight/ngx-event-hub/ngx-event-hub-demo"

# Check if library watch is running
if ! pgrep -f "ng build --watch.*ngx-event-hub-lib" > /dev/null; then
    echo "Starting library watch mode..."
    cd "$LIB_DIR" && npm run watch > /dev/null 2>&1 &
    echo "Library watch started (PID: $!)"
else
    echo "Library watch is already running"
fi

# Check if demo server is running
if ! pgrep -f "ng serve.*ngx-event-hub-demo" > /dev/null; then
    echo "Starting demo server..."
    cd "$DEMO_DIR" && npm start > /dev/null 2>&1 &
    echo "Demo server started (PID: $!)"
else
    echo "Demo server is already running"
fi

echo "All services checked!"

