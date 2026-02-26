#!/bin/bash
# Simple runner script for Daily Story AI experiments

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   Daily Story AI - Quick Launcher${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}   Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}   Please edit .env and add your API keys${NC}"
    exit 1
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo -e "${RED}❌ OPENAI_API_KEY not configured in .env${NC}"
    echo -e "${YELLOW}   Please add your OpenAI API key to .env${NC}"
    exit 1
fi

# Check if venv exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
if [ ! -f "venv/.deps_installed" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pip install -q -r requirements.txt
    touch venv/.deps_installed
fi

echo ""
echo "Select an option:"
echo ""
echo "  1) Quick Test (no Firebase, fastest)"
echo "  2) Test with Web Search (Perplexity)"
echo "  3) Generate for specific user (Firebase)"
echo "  4) Generate for all users (Firebase)"
echo "  5) Exit"
echo ""
read -p "Choose (1-5): " choice

case $choice in
    1)
        echo -e "${GREEN}🧪 Running quick test...${NC}"
        python quick_test.py
        ;;
    2)
        echo -e "${GREEN}🔍 Running with web search...${NC}"
        python story_generator.py
        ;;
    3)
        read -p "Enter user ID: " uid
        echo -e "${GREEN}📖 Generating story for user $uid...${NC}"
        python firebase_integration.py --user-id "$uid"
        ;;
    4)
        read -p "Limit (default 10): " limit
        limit=${limit:-10}
        echo -e "${GREEN}🚀 Generating stories for $limit users...${NC}"
        python firebase_integration.py --all --limit "$limit"
        ;;
    5)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✨ Done! Check the output/ folder for results.${NC}"
