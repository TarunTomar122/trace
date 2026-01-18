#!/usr/bin/env python3
"""
Scheduler for automated agent tasks:
- Feed generation (morning)
- Reflection (evening)
"""
import schedule
import time
import os
from datetime import datetime
from dotenv import load_dotenv
from agent import generate_feed, reflect_on_day

load_dotenv()

GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", None)

def scheduled_generate_feed():
    import asyncio
    print(f"\n[{datetime.now()}] Scheduled: Generating daily feed...")
    try:
        asyncio.run(generate_feed(GITHUB_USERNAME))
        print("✓ Feed generation complete")
    except Exception as e:
        print(f"✗ Error generating feed: {e}")

def scheduled_reflect():
    import asyncio
    print(f"\n[{datetime.now()}] Scheduled: Running daily reflection...")
    try:
        asyncio.run(reflect_on_day(GITHUB_USERNAME))
        print("✓ Reflection complete")
    except Exception as e:
        print(f"✗ Error during reflection: {e}")

# Schedule tasks
schedule.every().day.at("08:00").do(scheduled_generate_feed)  # Morning feed
schedule.every().day.at("18:00").do(scheduled_reflect)         # Evening reflection

print("=" * 60)
print("Trace Scheduler Started")
print("=" * 60)
print("- Feed generation: 08:00 daily")
print("- Reflection: 18:00 daily")
if GITHUB_USERNAME:
    print(f"- GitHub username: {GITHUB_USERNAME}")
print("=" * 60)
print()

# Run loop
try:
    while True:
        schedule.run_pending()
        time.sleep(60)
except KeyboardInterrupt:
    print("\n\nScheduler stopped")
