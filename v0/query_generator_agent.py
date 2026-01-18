"""
query_generator_agent - Generates user-tailored search queries.
"""

from __future__ import annotations

from pathlib import Path

import json
from typing import Literal, NotRequired
from typing_extensions import TypedDict

from agents import Agent, ModelSettings, RunContextWrapper, function_tool

from context import TraceContext

PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(filename: str) -> str:
    with open(PROMPTS_DIR / filename, "r") as f:
        return f.read()


class QueryItem(TypedDict):
    text: str
    category: Literal["exploit", "adjacent", "serendipity"]
    source_hint: NotRequired[
        Literal["blog", "video", "paper", "repo", "discussion"]
    ]


@function_tool
def generate_queries(
    ctx: RunContextWrapper[TraceContext],
    queries: list[QueryItem],
) -> str:
    _ = ctx
    return json.dumps({"status": "ok", "count": len(queries)})


query_generator_agent = Agent[TraceContext](
    name="Query Generator Agent (query_generator_agent)",
    instructions=load_prompt("query_generator_agent.md"),
    tools=[generate_queries],
    model="gpt-4.1-mini",
    model_settings=ModelSettings(tool_choice="required"),
)
