#!/bin/bash

echo "=========================================="
echo "Setting up Trace..."
echo "=========================================="
echo ""

# Activate venv
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Create .env file with your keys:"
echo "   OPENAI_API_KEY=your_openai_key"
echo "   GITHUB_TOKEN=your_github_token (optional)"
echo "   GITHUB_USERNAME=your_username (optional)"
echo ""
echo "2. Edit agent/memory/user_profile.json with your info:"
echo "   - Who you are, what you do"
echo "   - Your interests and current focus"
echo "   - Content preferences and goals"
echo ""
echo "3. Start the system:"
echo "   python web.py              # Web interface (http://localhost:5000)"
echo "   python scheduler.py        # Automated scheduler (8am feed, 6pm reflection)"
echo ""
echo "4. Manual commands:"
echo "   python agent.py generate   # Generate feed now"
echo "   python agent.py reflect    # Reflect on today now"
echo ""
echo "=========================================="
