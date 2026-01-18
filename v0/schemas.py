"""
Strict Pydantic schemas for all Trace JSON data structures.
"""
from pydantic import BaseModel, Field
from typing import Literal, Optional


# =============================================================================
# FEED ITEMS
# =============================================================================

VALID_TAGS = [
    "agents", "memory", "llm", "frontend", "performance",
    "tools", "infra", "web-components", "design-systems",
    "databases", "ml-research", "new-releases", "tutorials",
    "devops", "career"
]


class FeedItemMetadata(BaseModel):
    why_relevant: str
    feed_category: Optional[Literal["exploit", "adjacent", "serendipity"]] = None


class FeedItem(BaseModel):
    id: str = Field(..., pattern=r"^(github|arxiv|youtube|exa)_\d{4}-\d{2}-\d{2}_\d+$")
    type: Literal["video", "paper", "repo", "blog", "discussion", "tweet", "launch", "model"]
    title: str
    description: str
    tags: list[str] = Field(default_factory=list, description="1-3 tags from VALID_TAGS")
    thumbnail: Optional[str] = None
    url: str
    timestamp: str
    source: Literal["arxiv", "github", "youtube", "exa"]
    metadata: FeedItemMetadata
    stars: Optional[int] = None
    view_count: Optional[int] = None
    score: Optional[float] = None


# =============================================================================
# INTERACTIONS
# =============================================================================

class Interaction(BaseModel):
    item_id: str
    action: Literal["upvote", "downvote"]
    timestamp: str
    item_metadata: dict


# =============================================================================
# USER PROFILE (read-only)
# =============================================================================

class CurrentWork(BaseModel):
    project: str
    focus: str


class Project(BaseModel):
    name: str
    type: str
    users: Optional[int] = None
    focus: list[str]


class Goals(BaseModel):
    short_term: str
    long_term: str


class UserProfile(BaseModel):
    name: str
    role: str
    location: str
    experience_years: int
    skills: list[str]
    current_work: CurrentWork
    projects: list[Project]
    goals: Goals
    learning_style: str


# =============================================================================
# PATTERNS (tag-based with exploration)
# =============================================================================

class TagStats(BaseModel):
    score: int = Field(..., ge=0, le=100)
    up: int = 0
    down: int = 0
    shown: int = 0
    flagged_for_exclusion: Optional[bool] = None


class Exploration(BaseModel):
    adjacent_searches: list[str] = Field(default_factory=list)
    serendipity_queries: list[str] = Field(default_factory=list)


class HistoryEntry(BaseModel):
    date: str
    summary: str
    insights: Optional[str] = None
    suggested_explorations: Optional[list[str]] = None


class Patterns(BaseModel):
    tags: dict[str, TagStats]
    exclude_tags: list[str]
    exploration: Exploration
    history: list[HistoryEntry] = Field(default_factory=list)
    updated: str


# =============================================================================
# PREFERENCES
# =============================================================================

class ContentMix(BaseModel):
    repos: int = Field(..., ge=0, le=100)
    videos: int = Field(..., ge=0, le=100)
    papers: int = Field(..., ge=0, le=100)
    articles: int = Field(..., ge=0, le=100)


class MinPopularity(BaseModel):
    stars: int
    views: int


class Format(BaseModel):
    style: Literal["dense", "detailed"]
    explain_relevance: bool
    max_items: int


class AgentRules(BaseModel):
    default_action: str
    never: list[str]


class Preferences(BaseModel):
    content_mix: ContentMix
    min_popularity: MinPopularity
    format: Format
    agent_rules: AgentRules


# =============================================================================
# FETCH RESULTS
# =============================================================================

class ArxivPaper(BaseModel):
    title: str
    url: str
    published: str


class GitHubRepo(BaseModel):
    name: str
    url: str
    stars: int
    forks: int
    language: Optional[str]
    description: Optional[str]
    updated_at: Optional[str]


class YouTubeVideo(BaseModel):
    title: str
    url: str
    thumbnail: Optional[str]
    channel: Optional[str]
    view_count: int = 0
    like_count: int = 0
    duration: Optional[int] = None


class ExaResult(BaseModel):
    title: str
    url: str
    published_date: Optional[str]
    author: Optional[str]
    score: float
    content_type: Literal["blog", "discussion", "tweet", "substack", "launch", "model"]
