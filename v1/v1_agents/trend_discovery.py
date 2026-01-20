"""
Trend Discovery Agent - discovers fresh sub-queries for a main tag.

Uses OpenAI Agents SDK with web search to find what's trending.

Usage:
    python v1/agents/trend_discovery.py --tag 'AI'
"""
import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from agents import Agent, ModelSettings, Runner


PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(filename: str) -> str:
    """Load a prompt from the prompts directory."""
    with open(PROMPTS_DIR / filename, "r") as f:
        return f.read()


def create_trend_discovery_agent() -> Agent:
    """Create the trend discovery agent with web search enabled."""
    return Agent(
        name="Trend Discovery Agent",
        instructions=load_prompt("trend_discovery_agent.md"),
        model="gpt-4.1-mini",
        model_settings=ModelSettings(web_search=True),
    )


def discover_trends(main_tag: str) -> list[str]:
    """
    Discover diverse trending queries for a main tag covering different user types.
    
    Args:
        main_tag: The main topic tag (e.g., "AI", "Frontend", "Running")
    
    Returns:
        List of 2 diverse specific search queries
    """
    agent = create_trend_discovery_agent()
    
    prompt = f"""Find 2 diverse and specific queries about "{main_tag}".

Search the web for what's currently trending about {main_tag}.

Return ONLY a JSON array of 2 queries (2-5 words each).
No markdown formatting, just the raw JSON array."""

    result = Runner.run_sync(agent, prompt)
    
    # Extract the final output
    output = result.final_output
    
    # Parse JSON from the response
    # The response might have markdown code blocks, so we need to clean it
    output = output.strip()
    if output.startswith("```"):
        # Remove markdown code blocks
        lines = output.split("\n")
        output = "\n".join(lines[1:-1])
    
    try:
        queries = json.loads(output)
        if isinstance(queries, list) and len(queries) >= 2:
            return queries[:2]
        elif isinstance(queries, list) and len(queries) == 1:
            queries.append(f"{main_tag} latest trends")
            return queries[:2]
        else:
            raise ValueError("Expected a list")
    except json.JSONDecodeError:
        # Try to extract JSON array from the text
        import re
        match = re.search(r'\[.*?\]', output, re.DOTALL)
        if match:
            try:
                queries = json.loads(match.group())
                if isinstance(queries, list):
                    while len(queries) < 2:
                        queries.append(f"{main_tag} latest trends")
                    return queries[:2]
            except json.JSONDecodeError:
                pass
        
        # Fallback: return 2 generic queries
        return [
            f"{main_tag} latest developments",
            f"{main_tag} trends insights",
        ]


def main():
    parser = argparse.ArgumentParser(description="Discover trending topics for a main tag")
    parser.add_argument("--tag", required=True, help="Main tag to discover trends for (e.g., 'AI')")
    args = parser.parse_args()
    
    queries = discover_trends(args.tag)
    
    # Output as JSON to stdout
    print(json.dumps(queries))


if __name__ == "__main__":
    main()

