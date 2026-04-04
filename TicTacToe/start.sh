#!/bin/bash

echo "Starting Tic Tac Toe Online Server..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo
    echo "Please download and install Node.js from: https://nodejs.org/"
    echo
    echo "After installing Node.js, run this script again."
    echo
    exit 1
fi

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo
fi

echo "Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo

npm start