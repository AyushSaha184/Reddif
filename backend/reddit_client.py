"""Reddit client using public JSON endpoint - NO API KEY NEEDED."""

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Optional, Callable, List

import requests
import structlog

logger = structlog.get_logger(__name__)

# Target flairs to monitor
TARGET_FLAIRS = ["Paid - No AI", "Paid - AI OK", "Free"]

# Budget/Price regex pattern
BUDGET_PATTERN = re.compile(
    r"(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s*(?:\$|€|£|USD|EUR|GBP)?",
    re.IGNORECASE,
)

# Reddit JSON endpoint
REDDIT_JSON_URL = "https://www.reddit.com/r/{subreddit}.json"

# Polling interval in seconds
POLL_INTERVAL = 30  # Check every 30 seconds


@dataclass
class ParsedSubmission:
    """Parsed Reddit submission data."""

    post_id: str
    flair: str
    title: str
    permalink: str
    image_urls: list[str]
    detected_budget: Optional[str]
    created_at: int
    author: str
    selftext: str = ""


class RedditClient:
    """Poll Reddit public JSON endpoint for new posts."""

    def __init__(
        self,
        subreddit: str,
        on_new_post: Callable[[ParsedSubmission], None],
        poll_interval: int = POLL_INTERVAL,
    ):
        self.subreddit = subreddit
        self.on_new_post = on_new_post
        self.poll_interval = poll_interval
        self.base_url = REDDIT_JSON_URL.format(subreddit=subreddit)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "ReddifLeads/1.0 (https://github.com/yourusername/Reddif)",
                "Accept": "application/json",
            }
        )
        self._running = False
        self._seen_posts = set()  # Track seen post IDs
        self._last_post_time = 0  # For sorting

    def _extract_budget(self, title: str) -> Optional[str]:
        """Extract budget/price from title using regex."""
        match = BUDGET_PATTERN.search(title)
        if match:
            amount = match.group(1)
            if "$" in title or "USD" in title.upper():
                return f"${amount}"
            elif "€" in title or "EUR" in title.upper():
                return f"€{amount}"
            elif "£" in title or "GBP" in title.upper():
                return f"£{amount}"
            return f"${amount}"
        return None

    def _extract_image_urls(self, post_data: dict) -> List[str]:
        """Extract image URLs from post data."""
        image_urls = []

        # Check for gallery
        if post_data.get("is_gallery") and "gallery_data" in post_data:
            gallery = post_data.get("gallery_data", {})
            media_metadata = post_data.get("media_metadata", {})

            for item in gallery.get("items", []):
                media_id = item.get("media_id")
                if media_id in media_metadata:
                    media = media_metadata[media_id]
                    # Get highest resolution
                    if "s" in media:
                        url = media["s"].get("u", "")
                        if url:
                            image_urls.append(url.split("?")[0])  # Remove query params
                    elif "p" in media:
                        # Try preview images
                        for p in media["p"]:
                            if "u" in p:
                                url = p["u"].split("?")[0]
                                if url:
                                    image_urls.append(url)
                                    break

        # Check for single image
        elif post_data.get("url"):
            url = post_data["url"]
            # Check if it's an image
            image_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
            if (
                any(url.lower().endswith(ext) for ext in image_extensions)
                or "i.redd.it" in url
            ):
                image_urls.append(url)

        # Check for video
        elif post_data.get("is_video") and "media" in post_data:
            media = post_data.get("media", {})
            if "reddit_video" in media:
                # Videos don't have a simple image URL
                pass

        return image_urls

    def _parse_post(self, post_data: dict) -> Optional[ParsedSubmission]:
        """Parse a Reddit post into our format."""
        try:
            post_id = post_data.get("id", "")

            # Get the link flair
            flair = post_data.get("link_flair_text", "")

            # Only process target flairs
            if flair not in TARGET_FLAIRS:
                return None

            title = post_data.get("title", "Untitled")
            permalink = f"https://reddit.com{post_data.get('permalink', '')}"
            author = post_data.get("author", "[deleted]")
            selftext = post_data.get("selftext", "")
            created_utc = int(post_data.get("created_utc", time.time()))

            # Extract images
            image_urls = self._extract_image_urls(post_data)

            # Extract budget from title
            detected_budget = self._extract_budget(title)

            return ParsedSubmission(
                post_id=post_id,
                flair=flair,
                title=title,
                permalink=permalink,
                image_urls=image_urls,
                detected_budget=detected_budget,
                created_at=created_utc,
                author=author,
                selftext=selftext,
            )

        except Exception as e:
            logger.error("parse_post_failed", error=str(e))
            return None

    def fetch_new_posts(self) -> List[ParsedSubmission]:
        """Fetch new posts from the subreddit."""
        try:
            response = self.session.get(
                self.base_url, params={"limit": 100, "sort": "new"}, timeout=30
            )
            response.raise_for_status()

            data = response.json()
            posts = []

            for child in data.get("data", {}).get("children", []):
                post_data = child.get("data", {})
                post_id = post_data.get("id", "")

                # Skip if already seen
                if post_id in self._seen_posts:
                    continue

                # Mark as seen
                self._seen_posts.add(post_id)

                # Parse the post
                parsed = self._parse_post(post_data)
                if parsed:
                    posts.append(parsed)
                    logger.info(
                        "new_post_found",
                        post_id=post_id,
                        flair=parsed.flair,
                        title=parsed.title[:50],
                    )

            return posts

        except requests.RequestException as e:
            logger.error("fetch_posts_failed", error=str(e))
            return []
        except json.JSONDecodeError as e:
            logger.error("json_parse_failed", error=str(e))
            return []

    def run(self) -> None:
        """Start polling for new posts."""
        self._running = True
        logger.info(
            "reddit_client_started",
            subreddit=self.subreddit,
            interval=self.poll_interval,
        )

        while self._running:
            try:
                # Fetch new posts
                posts = self.fetch_new_posts()

                # Process each new post
                for post in posts:
                    try:
                        self.on_new_post(post)
                    except Exception as e:
                        logger.error(
                            "callback_failed", post_id=post.post_id, error=str(e)
                        )

                # Wait before next poll
                time.sleep(self.poll_interval)

            except KeyboardInterrupt:
                logger.info("reddit_client_stopped_by_user")
                break
            except Exception as e:
                logger.error("reddit_client_error", error=str(e))
                time.sleep(self.poll_interval)  # Wait on error too

    def stop(self) -> None:
        """Stop the client."""
        self._running = False
        logger.info("reddit_client_stopped")

    def fetch_single_post(self, post_id: str) -> Optional[ParsedSubmission]:
        """Fetch a specific post by ID."""
        try:
            url = f"https://www.reddit.com/r/{self.subreddit}/comments/{post_id}.json"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            data = response.json()
            if data and len(data) > 0:
                post_data = data[0]["data"]["children"][0]["data"]
                return self._parse_post(post_data)

            return None

        except Exception as e:
            logger.error("fetch_single_post_failed", post_id=post_id, error=str(e))
            return None
