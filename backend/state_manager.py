"""State Manager for SQLite operations with WAL mode."""

import json
import logging
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Post:
    """Represents a Reddit post."""

    post_id: str
    flair: str
    title: str
    permalink: str
    image_urls: list[str]
    detected_budget: str | None
    status: str
    created_at: int


class StateManager:
    """Manages SQLite database with WAL mode for concurrent access."""

    def __init__(self, db_path: str = "reddit_posts.db"):
        self.db_path = Path(db_path)
        self._init_db()

    def _init_db(self) -> None:
        """Initialize database with WAL mode."""
        with self._get_connection() as conn:
            # Enable WAL mode for safer concurrent access
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    post_id TEXT PRIMARY KEY,
                    flair TEXT NOT NULL,
                    title TEXT NOT NULL,
                    permalink TEXT NOT NULL,
                    image_urls TEXT,  -- JSON-encoded list
                    detected_budget TEXT,
                    status TEXT DEFAULT 'open',
                    created_at INTEGER NOT NULL
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_status ON posts(status)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON posts(created_at)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_flair ON posts(flair)
            """)

            conn.commit()
            logger.info("Database initialized with WAL mode")

    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper error handling."""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row
            yield conn
        except sqlite3.Error as e:
            logger.error(f"Database error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()

    def post_exists(self, post_id: str) -> bool:
        """Check if a post exists in the database."""
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT 1 FROM posts WHERE post_id = ?", (post_id,))
            return cursor.fetchone() is not None

    def insert_post(self, post: Post) -> bool:
        """Insert a new post. Returns True if successful, False if already exists."""
        if self.post_exists(post.post_id):
            logger.warning(f"Post {post.post_id} already exists, skipping")
            return False

        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO posts 
                    (post_id, flair, title, permalink, image_urls, detected_budget, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        post.post_id,
                        post.flair,
                        post.title,
                        post.permalink,
                        json.dumps(post.image_urls),
                        post.detected_budget,
                        post.status,
                        post.created_at,
                    ),
                )
                conn.commit()
                logger.info(f"Inserted post {post.post_id}")
                return True
        except sqlite3.IntegrityError:
            logger.warning(f"Integrity error for post {post.post_id}")
            return False

    def get_post(self, post_id: str) -> Post | None:
        """Get a post by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM posts WHERE post_id = ?", (post_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_post(row)
            return None

    def get_active_posts(self) -> list[Post]:
        """Get all posts with status 'open'."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM posts WHERE status = 'open' ORDER BY created_at DESC"
            )
            return [self._row_to_post(row) for row in cursor.fetchall()]

    def get_all_posts(self) -> list[Post]:
        """Get all posts."""
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM posts ORDER BY created_at DESC")
            return [self._row_to_post(row) for row in cursor.fetchall()]

    def update_post_status(self, post_id: str, new_status: str) -> bool:
        """Update post status. Returns True if successful."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE posts SET status = ? WHERE post_id = ?", (new_status, post_id)
            )
            conn.commit()
            if cursor.rowcount > 0:
                logger.info(f"Updated post {post_id} status to {new_status}")
                return True
            return False

    def update_post_flair(self, post_id: str, new_flair: str) -> bool:
        """Update post flair. Returns True if successful."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE posts SET flair = ? WHERE post_id = ?", (new_flair, post_id)
            )
            conn.commit()
            if cursor.rowcount > 0:
                logger.info(f"Updated post {post_id} flair to {new_flair}")
                return True
            return False

    def delete_expired_posts(self, expiry_seconds: int = 172800) -> list[str]:
        """Delete posts older than expiry_seconds (default 48 hours)."""
        import time

        cutoff_time = int(time.time()) - expiry_seconds

        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT post_id FROM posts WHERE created_at < ?", (cutoff_time,)
            )
            expired_ids = [row[0] for row in cursor.fetchall()]

            if expired_ids:
                conn.execute("DELETE FROM posts WHERE created_at < ?", (cutoff_time,))
                conn.commit()
                logger.info(f"Deleted {len(expired_ids)} expired posts")

            return expired_ids

    def get_stats(self) -> dict[str, Any]:
        """Get database statistics."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) as total, "
                "SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open, "
                "SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) as solved "
                "FROM posts"
            )
            row = cursor.fetchone()
            return {
                "total_posts": row[0] or 0,
                "open_posts": row[1] or 0,
                "solved_posts": row[2] or 0,
            }

    def _row_to_post(self, row: sqlite3.Row) -> Post:
        """Convert a database row to a Post object."""
        return Post(
            post_id=row["post_id"],
            flair=row["flair"],
            title=row["title"],
            permalink=row["permalink"],
            image_urls=json.loads(row["image_urls"]) if row["image_urls"] else [],
            detected_budget=row["detected_budget"],
            status=row["status"],
            created_at=row["created_at"],
        )
