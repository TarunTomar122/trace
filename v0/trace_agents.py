"""
Trace's agent definitions using OpenAI Agents SDK
"""
from pathlib import Path
from agents import Agent, ModelSettings
from context import TraceContext

# Load prompts from files
PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(filename: str) -> str:
    """Load a prompt from the prompts directory"""
    with open(PROMPTS_DIR / filename, 'r') as f:
        return f.read()


from tools import (
    read_user_profile, read_memory, write_memory,
    fetch_arxiv, fetch_youtube,
    fetch_exa,
    run_reflection_algorithm,
    save_feed, get_seen_urls
)

# ============================================
# SUB-AGENTS: Specialized workers
# ============================================

arxiv_agent = Agent[TraceContext](
    name="ArXiv Researcher",
    instructions=load_prompt("arxiv_agent.txt"),
    tools=[fetch_arxiv, read_user_profile, read_memory],
    model="gpt-4.1-mini"
)

youtube_agent = Agent[TraceContext](
    name="YouTube Curator",
    instructions=load_prompt("youtube_agent.txt"),
    tools=[fetch_youtube, read_user_profile, read_memory],
    model="gpt-4.1-mini"
)

exa_agent = Agent[TraceContext](
    name="Web Content Curator",
    instructions=load_prompt("exa_agent.txt"),
    tools=[fetch_exa, read_user_profile, read_memory],
    model="gpt-4.1-mini"
)

web_search_agent = Agent[TraceContext](
    name="Intelligent Web Search Agent",
    instructions=load_prompt("web_search_agent.txt"),
    tools=[read_user_profile, read_memory],
    model="gpt-4.1-mini",
    model_settings=ModelSettings(web_search=True)
)

# ============================================
# FEED GENERATION AGENT: Orchestrator
# ============================================

feed_generator = Agent[TraceContext](
    name="Feed Generator",
    instructions=load_prompt("feed_generator.txt"),
    tools=[
        read_user_profile,
        read_memory,
        get_seen_urls,
        # arxiv_agent disabled for now - uncomment when needed for research-heavy users
        # arxiv_agent.as_tool(
        #     tool_name="search_arxiv",
        #     tool_description="Search for academic papers on arXiv"
        # ),
        youtube_agent.as_tool(
            tool_name="search_youtube",
            tool_description="Search for YouTube videos"
        ),
        exa_agent.as_tool(
            tool_name="search_exa",
            tool_description="Search web content: blogs, HN discussions, tweets, Product Hunt launches, HuggingFace models. Specify content_type."
        ),
        web_search_agent.as_tool(
            tool_name="search_web",
            tool_description="Intelligent web search agent that can find any type of content across the internet. Use this for diverse searches when you want the model to intelligently decide what content to find."
        ),
        save_feed
    ],
    model="gpt-4.1-mini",
    model_settings=ModelSettings(tool_choice='required')
)

# ============================================
# REFLECTION AGENT: End-of-day analyzer
# ============================================

reflection_agent = Agent[TraceContext](
    name="Reflection Agent",
    instructions=load_prompt("reflection_agent.txt"),
    tools=[
        run_reflection_algorithm,
        read_memory,
        write_memory,
    ],
    model="gpt-4.1-mini",
    model_settings=ModelSettings(tool_choice='required')
)
