#!/usr/bin/env python3
"""
Test WhatsApp bot flow locally without Twilio
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from whatsapp_bot import init_firebase, process_message

# Initialize
init_firebase()

# Test phone number
test_phone = "whatsapp:+1234567890"

print("="*60)
print("WhatsApp Bot Flow Test")
print("="*60)
print()

# Simulate conversation
def simulate(message):
    print(f"User: {message}")
    response = process_message(test_phone, message)
    print(f"Bot: {response}")
    print()
    return response

# Test flow
print("Starting conversation...\n")

simulate("news")
simulate("1")
simulate("I build with open source models, what can I explore with this?")

print("="*60)
print("Flow test complete!")
print("="*60)
