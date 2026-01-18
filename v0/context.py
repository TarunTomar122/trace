from dataclasses import dataclass
from pathlib import Path
from typing import Optional

@dataclass
class TraceContext:
    """Context passed to all agents and tools"""
    user_folder: str  # Path to user's data folder (e.g., "users/tarun")
    user_id: Optional[str] = None
    github_username: Optional[str] = None
    date: Optional[str] = None
    
    @property
    def memory_dir(self) -> Path:
        return Path(self.user_folder) / "memory"
    
    @property
    def feeds_dir(self) -> Path:
        return Path(self.user_folder) / "feeds"
    
    @property
    def daily_dir(self) -> Path:
        return self.memory_dir / "daily"
