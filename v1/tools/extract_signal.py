"""
Signal Extraction Tool - extracts specific follow-up queries from user notes.

Uses LLM to extract a specific topic/query (2-5 words) from a user's note
on an upvoted item.

Usage:
    python v1/tools/extract_signal.py --title 'DeepSeek R1' --note 'GRPO is fascinating'
"""
import argparse
import json
import os
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from openai import OpenAI


EXTRACT_SIGNAL_PROMPT = """You are a search query extractor. Given an item title and a user's note about why they liked it, extract a specific follow-up search query.

Rules:
1. The query should be 2-5 words
2. Focus on the SPECIFIC topic the user mentioned, not the general item topic
3. Make it actionable for a search engine
4. If the note is too generic (like "cool" or "nice") or unrelated to the title, return null
5. Return a confidence score (0.0-1.0) based on how specific the extracted topic is

Examples:
- Title: "DeepSeek R1: GRPO Explained", Note: "GRPO is fascinating" → "GRPO reinforcement learning"
- Title: "LLM Finetuning Guide", Note: "LoRA is so cool" → "LoRA finetuning"
- Title: "React 19 Features", Note: "nice article" → null (too generic)
- Title: "AI Agents Tutorial", Note: "I want to learn more about memory systems" → "AI agent memory systems"

Item Title: {title}
User Note: {note}

Return a JSON object with:
- "query": string or null (2-5 words search query)
- "confidence": float (0.0-1.0)
- "reasoning": string (brief explanation)

Return ONLY valid JSON, no other text."""


def extract_signal(title: str, note: str) -> dict | None:
    """
    Extract a specific follow-up query from user's note on an upvoted item.
    
    Args:
        title: The item title that was upvoted
        note: The user's note about why they liked it
    
    Returns:
        Dict with 'query' and 'confidence', or None if note is too generic
    """
    if not note or len(note.strip()) < 3:
        return None
    
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    prompt = EXTRACT_SIGNAL_PROMPT.format(title=title, note=note)
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a precise search query extractor. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean up JSON if wrapped in code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        result = json.loads(content)
        
        # Validate response
        if result.get("query") is None:
            return None
        
        query = result.get("query", "").strip()
        confidence = float(result.get("confidence", 0.5))
        
        # Validate query length (2-5 words)
        word_count = len(query.split())
        if word_count < 2 or word_count > 6:
            # Try to adjust confidence if query is slightly off
            if word_count == 1:
                return None
            confidence = max(0.3, confidence - 0.2)
        
        return {
            "query": query,
            "confidence": min(1.0, max(0.0, confidence))
        }
        
    except json.JSONDecodeError:
        print(f"Error parsing LLM response", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error extracting signal: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="Extract search signal from user note")
    parser.add_argument("--title", required=True, help="Item title that was upvoted")
    parser.add_argument("--note", required=True, help="User's note about the item")
    args = parser.parse_args()
    
    result = extract_signal(args.title, args.note)
    
    if result:
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"query": None, "confidence": 0, "message": "Note too generic or unrelated"}))


if __name__ == "__main__":
    main()

