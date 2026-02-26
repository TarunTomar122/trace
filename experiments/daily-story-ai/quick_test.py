#!/usr/bin/env python3
"""
Quick Test - Generate a sample story without Firebase or web search

This is the fastest way to test the story generator.
"""

import os
from story_generator import generate_story

# Sample profiles to test
TEST_PROFILES = {
    "designer": {
        "name": "Alex Chen",
        "role": "designer",
        "seniority": "mid",
        "interests": ["experience", "technology", "startups"],
        "careerGoals": ["get-promoted"],
        "summaryStyle": "practitioner"
    },
    "developer": {
        "name": "Jordan Smith",
        "role": "developer",
        "seniority": "early",
        "interests": ["technology", "engineering", "startups"],
        "careerGoals": ["build-something", "stay-sharp"],
        "summaryStyle": "casual"
    },
    "pm": {
        "name": "Sam Rodriguez",
        "role": "pm",
        "seniority": "senior",
        "interests": ["business-market", "startups", "leadership"],
        "careerGoals": ["lead-team"],
        "summaryStyle": "executive"
    },
    "founder": {
        "name": "Maya Patel",
        "role": "founder",
        "seniority": "mid",
        "interests": ["startups", "business-market", "technology"],
        "careerGoals": ["build-something", "grow-network"],
        "summaryStyle": "executive"
    }
}


def main():
    """Run quick test."""
    print("\n" + "="*60)
    print("🧪 Quick Test - Daily Story Generator")
    print("="*60)

    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("\n❌ OPENAI_API_KEY not found in environment!")
        print("   Please set it in .env or export it:\n")
        print("   export OPENAI_API_KEY='your-api-key-here'\n")
        return

    # Select a profile
    print("\nAvailable test profiles:")
    for i, (key, profile) in enumerate(TEST_PROFILES.items(), 1):
        print(f"  {i}. {profile['name']} - {profile['role'].title()} ({profile['seniority']})")

    choice = input("\nSelect profile (1-4, or press Enter for #1): ").strip()

    if not choice:
        choice = "1"

    try:
        profile_key = list(TEST_PROFILES.keys())[int(choice) - 1]
        profile = TEST_PROFILES[profile_key]
    except (ValueError, IndexError):
        print("Invalid choice, using first profile")
        profile = TEST_PROFILES["designer"]

    print(f"\n✨ Generating story for {profile['name']}...")
    print(f"   Role: {profile['role']}")
    print(f"   Interests: {', '.join(profile['interests'])}")
    print(f"   Goals: {', '.join(profile['careerGoals'])}")

    # Generate story (no web search for quick test)
    story = generate_story(profile, search_method="none")

    print("\n" + "="*60)
    print("📖 Generated Story:")
    print("="*60)
    print()
    print(story)

    # Save to file
    os.makedirs("output", exist_ok=True)
    filename = f"output/quick_test_{profile['role']}.md"

    with open(filename, "w") as f:
        f.write(f"# Daily Story for {profile['name']}\n\n")
        f.write(story)

    print(f"\n💾 Story saved to: {filename}")
    print("\n✅ Test complete!")


if __name__ == "__main__":
    main()
