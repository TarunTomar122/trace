"""
V1 Pydantic models for the umbrella-based system.

Models:
- Umbrella: Main tag category with dynamic sub-queries
- SubQuery: Individual search query within an umbrella
- PoolItem: Item in the retrieval pool
- QueryUsers: Users subscribed to a query
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SubQuery(BaseModel):
    """A specific search query within an umbrella."""
    id: str = Field(..., description="Query ID, e.g., 'llm-quantization'")
    text: str = Field(..., description="The actual search query text")
    source_hint: str = Field(default="blog", description="Preferred source type: blog, video, discussion, etc.")
    user_count: int = Field(default=0, description="Number of users interested in this query")
    last_searched: Optional[str] = Field(default=None, description="Date of last search (YYYY-MM-DD)")


class Umbrella(BaseModel):
    """Main tag category that groups related sub-queries."""
    id: str = Field(..., description="Umbrella ID, e.g., 'ai', 'frontend'")
    display_name: str = Field(..., description="Human-readable name, e.g., 'Artificial Intelligence'")
    sub_queries: list[SubQuery] = Field(default_factory=list, description="List of sub-queries")
    user_count: int = Field(default=0, description="Total users interested in this umbrella")
    created_at: Optional[str] = Field(default=None, description="ISO timestamp of creation")
    last_discovery_refresh: Optional[str] = Field(default=None, description="ISO timestamp of last trend discovery")


class QualitySignals(BaseModel):
    """Quality signals for a pool item."""
    domain_authority: Optional[str] = Field(default=None, description="high, medium, low")
    has_code: bool = Field(default=False, description="Whether the content has code examples")
    read_time_minutes: Optional[int] = Field(default=None, description="Estimated read time")


class PoolItem(BaseModel):
    """An item in the global retrieval pool."""
    id: str = Field(..., description="Pool item ID, e.g., 'pool_2026-01-18_001'")
    url: str = Field(..., description="URL of the content")
    title: str = Field(..., description="Title of the content")
    description: str = Field(default="", description="Brief description or snippet")
    type: str = Field(..., description="Content type: video, blog, paper, repo, discussion, tweet, launch, model")
    source: str = Field(..., description="Source API: tavily, exa, youtube")
    umbrella_id: str = Field(..., description="Umbrella this item belongs to")
    query_id: str = Field(..., description="Query that found this item")
    tags: list[str] = Field(default_factory=list, description="Content tags")
    fetched_at: str = Field(..., description="ISO timestamp when fetched")
    expires_at: Optional[str] = Field(default=None, description="ISO timestamp when item expires")
    quality_signals: QualitySignals = Field(default_factory=QualitySignals)
    trending_score: int = Field(default=50, description="Global trending score 0-100")
    freshness_score: int = Field(default=50, description="Freshness score 0-100")
    
    # Optional metadata from source
    thumbnail: Optional[str] = Field(default=None)
    published_date: Optional[str] = Field(default=None)
    score: Optional[float] = Field(default=None, description="Relevance score from search API")


class QueryUsers(BaseModel):
    """Tracks which users want which queries."""
    query_id: str = Field(..., description="Query ID")
    query_text: str = Field(..., description="The actual search query text")
    umbrella_id: str = Field(..., description="Parent umbrella ID")
    users: list[str] = Field(default_factory=list, description="List of user IDs")
    user_count: int = Field(default=0, description="Number of users")
    last_searched: Optional[str] = Field(default=None, description="Date of last search (YYYY-MM-DD)")


class PersonalSignal(BaseModel):
    """A personal follow-up signal from user interaction."""
    signal_id: str = Field(..., description="Unique signal ID")
    query: str = Field(..., description="Follow-up search query")
    priority: int = Field(default=5, ge=1, le=10, description="Priority 1-10")
    created_at: str = Field(..., description="ISO timestamp")
    expires_at: str = Field(..., description="ISO timestamp when signal expires")
    origin_item_id: Optional[str] = Field(default=None, description="Item that triggered this signal")

