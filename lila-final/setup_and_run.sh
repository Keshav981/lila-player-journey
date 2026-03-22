#!/bin/bash

echo ""
echo "================================================"
echo "  LILA BLACK - Player Journey Visualizer"
echo "================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is NOT installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Then run this script again."
    exit 1
fi
echo "[OK] Node.js: $(node --version)"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 is NOT installed!"
    echo "Please install from: https://python.org"
    exit 1
fi
echo "[OK] Python: $(python3 --version)"

echo ""
echo "================================================"
echo "  STEP 1: Installing Python packages..."
echo "================================================"
pip3 install pandas pyarrow --quiet
echo "[OK] Python packages ready"

echo ""
echo "================================================"
echo "  STEP 2: Converting your player data..."
echo "================================================"

if [ -f "public/data.json" ]; then
    echo "[OK] data.json already exists - skipping conversion"
else
    echo ""
    echo "Paste the full path to your player_data folder:"
    echo "Example: /Users/keshav/Downloads/player_data"
    echo ""
    read -p "Path: " DATA_PATH

    if [ ! -d "$DATA_PATH" ]; then
        echo "[ERROR] Folder not found: $DATA_PATH"
        exit 1
    fi

    python3 scripts/convert_data.py --input "$DATA_PATH" --output "public/data.json"
    echo "[OK] Data converted!"
fi

echo ""
echo "================================================"
echo "  STEP 3: Installing React packages..."
echo "================================================"
npm install

echo ""
echo "================================================"
echo "  STEP 4: Starting the app..."
echo "================================================"
echo ""
echo "App will open in your browser automatically."
echo "Press Ctrl+C to stop."
echo ""
npm start
