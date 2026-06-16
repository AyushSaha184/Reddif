"""Multi-source Reddit acquisition with OAuth-first failover."""

import html
import json
import os
import random
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Optional, Protocol
from urllib.parse import urljoin

import certifi
import requests
import structlog
from requests.auth import HTTPBasicAuth

try:
    import feedparser
except ImportError:  # pragma: no cover - dependency is declared in requirements.
    feedparser = None

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover - dependency is declared in requirements.
    BeautifulSoup = None

logger = structlog.get_logger(__name__)

TARGET_FLAIRS = ["Paid - No AI", "Paid - AI OK", "Free"]
BUDGET_PATTERN = re.compile(
    r"(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:\.\d{2})?)\s*(?:\$|€|£|USD|EUR|GBP)?",
    re.IGNORECASE,
)

REDDIT_OAUTH_URL = "https://oauth.reddit.com/r/{subreddit}/new.json"
REDDIT_OAUTH_COMMENTS_URL = "https://oauth.reddit.com/r/{subreddit}/comments/{post_id}.json"
REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_RSS_URL = "https://www.reddit.com/r/{subreddit}/.rss"
OLD_REDDIT_URL = "https://old.reddit.com/r/{subreddit}/new/"
OLD_REDDIT_COMMENTS_URL = "https://old.reddit.com/r/{subreddit}/comments/{post_id}/"

POLL_INTERVAL = 30
MAX_ERROR_SNIPPET_CHARS = 240
MAX_CONSECUTIVE_FAILURE_BACKOFF = 300
DEFAULT_POLL_JITTER_SECONDS = 5
MAX_FCM_METADATA_CHARS = 3500


def normalize_flair(flair: str | None) -> str:
    """Normalize Reddit flair text so variant formatting maps consistently."""
    if not flair:
        return ""

    normalized = flair.strip().lower()
    normalized = re.sub(r":[a-z0-9_+-]+:", " ", normalized)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized


def canonicalize_flair(flair: str | None) -> Optional[str]:
    """Map Reddit flair variants to the canonical labels used by app + topics."""
    normalized = normalize_flair(flair)
    if not normalized:
        return None

    if re.match(r"^solved(?:-|$)", normalized):
        return "Solved"

    if re.match(r"^free(?:-|$)", normalized):
        return "Free"

    has_paid_token = bool(re.search(r"(?:^|-)paid(?:-|$)", normalized))
    has_no_ai_token = bool(re.search(r"(?:^|-)no-ai(?:-|$)", normalized))
    has_ai_ok_token = bool(re.search(r"(?:^|-)ai-ok(?:-|$)", normalized))
    has_ai_token = bool(re.search(r"(?:^|-)ai(?:-|$)", normalized))
    has_ok_token = bool(re.search(r"(?:^|-)ok(?:-|$)", normalized))

    if has_paid_token and has_no_ai_token:
        return "Paid - No AI"

    if has_paid_token and (has_ai_ok_token or (has_ai_token and has_ok_token)):
        return "Paid - AI OK"

    return None


def resolve_request_verify() -> bool | str:
    """Return a valid CA bundle path for requests, ignoring stale env paths."""
    for env_name in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        candidate = os.getenv(env_name, "").strip()
        if not candidate:
            continue

        if Path(candidate).is_file():
            return candidate

        logger.warning(
            "invalid_tls_bundle_env",
            env_var=env_name,
            configured_path=candidate,
        )

    certifi_bundle = certifi.where()
    if certifi_bundle and Path(certifi_bundle).is_file():
        return certifi_bundle

    logger.warning("certifi_bundle_unavailable", certifi_path=certifi_bundle)
    return True


@dataclass
class ParsedSubmission:
    """Normalized Reddit submission data shared by all sources."""

    post_id: str
    flair: str
    title: str
    permalink: str
    image_urls: list[str]
    detected_budget: Optional[str]
    created_at: int
    author: str
    selftext: str = ""
    subreddit: str = ""
    score: int | None = None
    upvote_ratio: float | None = None
    num_comments: int | None = None
    external_url: str = ""
    thumbnail: str = ""
    media: dict[str, Any] = field(default_factory=dict)
    stickied: bool = False
    over_18: bool = False
    spoiler: bool = False
    source: str = ""
    raw_metadata: dict[str, Any] = field(default_factory=dict)

    def richness_score(self) -> int:
        fields = [
            self.selftext,
            self.subreddit,
            self.score,
            self.upvote_ratio,
            self.num_comments,
            self.external_url,
            self.thumbnail,
            self.media,
            self.raw_metadata,
        ]
        return sum(1 for value in fields if value not in ("", None, {}, [])) + len(self.image_urls)


@dataclass
class SourceHealth:
    name: str
    priority: int
    enabled: bool = True
    last_attempt_at: int | None = None
    last_success_at: int | None = None
    last_failure_at: int | None = None
    failure_reason: str | None = None
    last_status_code: int | None = None
    last_error_url: str | None = None
    last_error_body_snippet: str | None = None
    consecutive_failures: int = 0
    fetch_duration_ms: int | None = None
    posts_retrieved_count: int = 0


class SourceUnavailable(Exception):
    """Raised when a source cannot fetch usable data in the current cycle."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        url: str | None = None,
        body: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.url = url
        self.body = body


class RedditSource(Protocol):
    name: str
    priority: int
    enabled: bool

    def fetch_new_posts(self, include_non_target: bool = False) -> list[ParsedSubmission]:
        ...

    def fetch_single_post(self, post_id: str) -> ParsedSubmission | None:
        ...


class BaseSource:
    name = "base"
    priority = 0
    enabled = True

    def __init__(self, subreddit: str, session: requests.Session):
        self.subreddit = subreddit
        self.session = session

    def fetch_single_post(self, post_id: str) -> ParsedSubmission | None:
        return None

    def _extract_budget(self, title: str) -> Optional[str]:
        match = BUDGET_PATTERN.search(title)
        if not match:
            return None

        amount = match.group(1)
        upper_title = title.upper()
        if "$" in title or "USD" in upper_title:
            return f"${amount}"
        if "€" in title or "EUR" in upper_title:
            return f"€{amount}"
        if "£" in title or "GBP" in upper_title:
            return f"£{amount}"
        return f"${amount}"

    def _extract_image_urls(self, post_data: dict[str, Any]) -> list[str]:
        image_urls: list[str] = []

        if post_data.get("is_gallery") and "gallery_data" in post_data:
            gallery = post_data.get("gallery_data", {})
            media_metadata = post_data.get("media_metadata", {})
            for item in gallery.get("items", []):
                media_id = item.get("media_id")
                media = media_metadata.get(media_id, {})
                if "s" in media:
                    url = media["s"].get("u", "")
                    if url:
                        image_urls.append(html.unescape(url).split("?")[0])
                elif "p" in media:
                    for preview in media["p"]:
                        url = preview.get("u", "")
                        if url:
                            image_urls.append(html.unescape(url).split("?")[0])
                            break

        url = post_data.get("url") or ""
        if url:
            image_extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp")
            if any(url.lower().split("?")[0].endswith(ext) for ext in image_extensions) or "i.redd.it" in url:
                image_urls.append(html.unescape(url))

        preview_images = (
            post_data.get("preview", {}).get("images", [])
            if isinstance(post_data.get("preview"), dict)
            else []
        )
        for preview in preview_images:
            source_url = preview.get("source", {}).get("url")
            if source_url:
                image_urls.append(html.unescape(source_url))

        return list(dict.fromkeys(image_urls))

    def _safe_int(self, value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _safe_float(self, value: Any) -> float | None:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _parse_oauth_like_post(
        self, post_data: dict[str, Any], include_non_target: bool = False
    ) -> ParsedSubmission | None:
        try:
            post_id = str(post_data.get("id") or "").strip()
            if not post_id:
                return None

            raw_flair = post_data.get("link_flair_text", "")
            flair = canonicalize_flair(raw_flair)
            if not flair:
                logger.debug("unsupported_flair", post_id=post_id, flair=raw_flair, source=self.name)
                return None

            if not include_non_target and flair not in TARGET_FLAIRS:
                return None

            title = html.unescape(str(post_data.get("title") or "Untitled"))
            permalink_path = str(post_data.get("permalink") or f"/r/{self.subreddit}/comments/{post_id}/")
            permalink = permalink_path if permalink_path.startswith("http") else f"https://reddit.com{permalink_path}"
            created_at = self._safe_int(post_data.get("created_utc"), int(time.time()))
            media = {
                "media": post_data.get("media"),
                "secure_media": post_data.get("secure_media"),
                "gallery_data": post_data.get("gallery_data"),
                "media_metadata": post_data.get("media_metadata"),
                "is_video": post_data.get("is_video"),
            }
            media = {key: value for key, value in media.items() if value not in (None, {}, [])}

            return ParsedSubmission(
                post_id=post_id,
                flair=flair,
                title=title,
                permalink=permalink,
                image_urls=self._extract_image_urls(post_data),
                detected_budget=self._extract_budget(title),
                created_at=created_at,
                author=str(post_data.get("author") or "[deleted]"),
                selftext=html.unescape(str(post_data.get("selftext") or "")),
                subreddit=str(post_data.get("subreddit") or self.subreddit),
                score=self._safe_int(post_data.get("score")) if post_data.get("score") is not None else None,
                upvote_ratio=self._safe_float(post_data.get("upvote_ratio")),
                num_comments=self._safe_int(post_data.get("num_comments")) if post_data.get("num_comments") is not None else None,
                external_url=html.unescape(str(post_data.get("url") or "")),
                thumbnail=html.unescape(str(post_data.get("thumbnail") or "")),
                media=media,
                stickied=bool(post_data.get("stickied")),
                over_18=bool(post_data.get("over_18")),
                spoiler=bool(post_data.get("spoiler")),
                source=self.name,
                raw_metadata={
                    key: post_data.get(key)
                    for key in (
                        "domain",
                        "link_flair_text",
                        "link_flair_css_class",
                        "total_awards_received",
                        "is_gallery",
                        "is_self",
                    )
                    if post_data.get(key) is not None
                },
            )
        except Exception as exc:
            logger.error("parse_post_failed", source=self.name, error=str(exc))
            return None


class OAuthRedditSource(BaseSource):
    name = "oauth"
    priority = 1

    def __init__(
        self,
        subreddit: str,
        session: requests.Session,
        client_id: str,
        client_secret: str,
        username: str = "",
        password: str = "",
    ):
        super().__init__(subreddit, session)
        self.client_id = client_id.strip()
        self.client_secret = client_secret.strip()
        self.username = username.strip()
        self.password = password.strip()
        self.enabled = bool(self.client_id and self.client_secret)
        self._access_token: str | None = None
        self._access_token_expires_at = 0.0

    def _get_access_token(self) -> str:
        if not self.enabled:
            raise SourceUnavailable("oauth_credentials_missing", url=REDDIT_TOKEN_URL)

        now = time.time()
        if self._access_token and now < self._access_token_expires_at:
            return self._access_token

        data: dict[str, str] = {"grant_type": "client_credentials"}
        if self.username and self.password:
            data = {
                "grant_type": "password",
                "username": self.username,
                "password": self.password,
            }

        response = self.session.post(
            REDDIT_TOKEN_URL,
            auth=HTTPBasicAuth(self.client_id, self.client_secret),
            data=data,
            headers={
                "User-Agent": self.session.headers["User-Agent"],
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            timeout=30,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise SourceUnavailable("oauth_response_missing_access_token", url=REDDIT_TOKEN_URL)

        expires_in = int(token_data.get("expires_in", 3600))
        self._access_token = access_token
        self._access_token_expires_at = now + max(expires_in - 60, 60)
        return access_token

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._get_access_token()}"}

    def fetch_new_posts(self, include_non_target: bool = False) -> list[ParsedSubmission]:
        url = REDDIT_OAUTH_URL.format(subreddit=self.subreddit)
        response = self.session.get(
            url,
            params={"limit": 100, "raw_json": 1},
            headers=self._auth_headers(),
            timeout=30,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        data = response.json()
        posts = []
        for child in data.get("data", {}).get("children", []):
            parsed = self._parse_oauth_like_post(child.get("data", {}), include_non_target)
            if parsed:
                posts.append(parsed)
        return posts

    def fetch_single_post(self, post_id: str) -> ParsedSubmission | None:
        url = REDDIT_OAUTH_COMMENTS_URL.format(subreddit=self.subreddit, post_id=post_id)
        response = self.session.get(
            url,
            params={"raw_json": 1},
            headers=self._auth_headers(),
            timeout=30,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        data = response.json()
        if data and data[0].get("data", {}).get("children"):
            post_data = data[0]["data"]["children"][0].get("data", {})
            return self._parse_oauth_like_post(post_data, include_non_target=True)
        return None


class RssRedditSource(BaseSource):
    name = "rss"
    priority = 2

    def fetch_new_posts(self, include_non_target: bool = False) -> list[ParsedSubmission]:
        if feedparser is None:
            raise SourceUnavailable("feedparser_not_installed")

        url = REDDIT_RSS_URL.format(subreddit=self.subreddit)
        response = self.session.get(url, timeout=30)
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        feed = feedparser.parse(response.content)
        if getattr(feed, "bozo", False) and not feed.entries:
            raise SourceUnavailable(f"rss_parse_failed: {getattr(feed, 'bozo_exception', '')}", url=url)

        return [
            parsed
            for parsed in (self._parse_entry(entry, include_non_target) for entry in feed.entries)
            if parsed
        ]

    def _parse_entry(self, entry: Any, include_non_target: bool) -> ParsedSubmission | None:
        try:
            link = str(getattr(entry, "link", "") or "")
            post_id = self._extract_id(link) or self._extract_id(str(getattr(entry, "id", "") or ""))
            if not post_id:
                return None

            tags = [getattr(tag, "term", "") for tag in getattr(entry, "tags", [])]
            raw_flair = next((tag for tag in tags if canonicalize_flair(tag)), "")
            title = html.unescape(str(getattr(entry, "title", "") or "Untitled"))
            if not raw_flair:
                raw_flair = self._flair_from_title(title)

            flair = canonicalize_flair(raw_flair)
            if not flair:
                return None
            if not include_non_target and flair not in TARGET_FLAIRS:
                return None

            created = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
            created_at = int(time.mktime(created)) if created else int(time.time())
            summary = html.unescape(re.sub(r"<[^>]+>", " ", str(getattr(entry, "summary", "") or ""))).strip()
            image_urls = self._extract_urls_from_text(str(getattr(entry, "summary", "") or ""))

            return ParsedSubmission(
                post_id=post_id,
                flair=flair,
                title=title,
                permalink=link or f"https://reddit.com/r/{self.subreddit}/comments/{post_id}/",
                image_urls=image_urls,
                detected_budget=self._extract_budget(title),
                created_at=created_at,
                author=str(getattr(entry, "author", "") or "[deleted]").replace("/u/", ""),
                selftext=summary,
                subreddit=self.subreddit,
                source=self.name,
                raw_metadata={"rss_id": str(getattr(entry, "id", "") or "")},
            )
        except Exception as exc:
            logger.error("rss_entry_parse_failed", error=str(exc))
            return None

    def _extract_id(self, value: str) -> str:
        match = re.search(r"/comments/([A-Za-z0-9_]+)/", value)
        return match.group(1) if match else ""

    def _flair_from_title(self, title: str) -> str:
        match = re.match(r"^\s*\[([^\]]+)\]", title)
        return match.group(1) if match else ""

    def _extract_urls_from_text(self, text: str) -> list[str]:
        urls = re.findall(r"https?://[^\"'\s<>]+", html.unescape(text))
        image_extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp")
        return list(
            dict.fromkeys(
                url.rstrip(")")
                for url in urls
                if any(url.lower().split("?")[0].endswith(ext) for ext in image_extensions)
                or "i.redd.it" in url
                or "preview.redd.it" in url
            )
        )


class PushshiftRedditSource(BaseSource):
    name = "pushshift"
    priority = 3

    def __init__(self, subreddit: str, session: requests.Session, mirror_urls: Iterable[str]):
        super().__init__(subreddit, session)
        self.mirror_urls = [url.strip().rstrip("/") for url in mirror_urls if url.strip()]
        self.enabled = bool(self.mirror_urls)

    def fetch_new_posts(self, include_non_target: bool = False) -> list[ParsedSubmission]:
        if not self.enabled:
            raise SourceUnavailable("pushshift_mirrors_not_configured")

        last_error: SourceUnavailable | None = None
        for base_url in self.mirror_urls:
            url = f"{base_url}/reddit/search/submission/"
            try:
                response = self.session.get(
                    url,
                    params={"subreddit": self.subreddit, "sort": "desc", "sort_type": "created_utc", "size": 100},
                    timeout=30,
                )
                response.raise_for_status()
                payload = response.json()
                records = payload.get("data", payload if isinstance(payload, list) else [])
                return [
                    parsed
                    for parsed in (self._parse_record(record, include_non_target) for record in records)
                    if parsed
                ]
            except requests.HTTPError as exc:
                last_error = SourceUnavailable(
                    str(exc),
                    status_code=exc.response.status_code if exc.response is not None else None,
                    url=exc.response.url if exc.response is not None else url,
                    body=exc.response.text if exc.response is not None else None,
                )
            except (requests.RequestException, json.JSONDecodeError) as exc:
                last_error = SourceUnavailable(str(exc), url=url)

        raise last_error or SourceUnavailable("pushshift_fetch_failed")

    def fetch_single_post(self, post_id: str) -> ParsedSubmission | None:
        if not self.enabled:
            raise SourceUnavailable("pushshift_mirrors_not_configured")

        for base_url in self.mirror_urls:
            url = f"{base_url}/reddit/search/submission/"
            try:
                response = self.session.get(url, params={"ids": post_id, "size": 1}, timeout=30)
                response.raise_for_status()
                payload = response.json()
                records = payload.get("data", payload if isinstance(payload, list) else [])
                if records:
                    return self._parse_record(records[0], include_non_target=True)
            except (requests.RequestException, json.JSONDecodeError):
                continue
        return None

    def _parse_record(self, record: dict[str, Any], include_non_target: bool) -> ParsedSubmission | None:
        mapped = {
            "id": record.get("id"),
            "link_flair_text": record.get("link_flair_text") or record.get("link_flair_richtext"),
            "title": record.get("title"),
            "permalink": record.get("permalink"),
            "created_utc": record.get("created_utc"),
            "author": record.get("author"),
            "selftext": record.get("selftext"),
            "subreddit": record.get("subreddit"),
            "score": record.get("score"),
            "num_comments": record.get("num_comments"),
            "url": record.get("url") or record.get("full_link"),
            "thumbnail": record.get("thumbnail"),
            "over_18": record.get("over_18"),
            "spoiler": record.get("spoiler"),
            "stickied": record.get("stickied"),
        }
        parsed = self._parse_oauth_like_post(mapped, include_non_target)
        if parsed:
            parsed.source = self.name
            parsed.raw_metadata.update({"pushshift_created_utc": record.get("created_utc")})
        return parsed


class OldRedditHtmlSource(BaseSource):
    name = "old_reddit"
    priority = 4

    def fetch_new_posts(self, include_non_target: bool = False) -> list[ParsedSubmission]:
        if BeautifulSoup is None:
            raise SourceUnavailable("beautifulsoup4_not_installed")

        url = OLD_REDDIT_URL.format(subreddit=self.subreddit)
        response = self.session.get(url, timeout=30)
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        return self._parse_html(response.text, include_non_target)

    def fetch_single_post(self, post_id: str) -> ParsedSubmission | None:
        if BeautifulSoup is None:
            raise SourceUnavailable("beautifulsoup4_not_installed")

        url = OLD_REDDIT_COMMENTS_URL.format(subreddit=self.subreddit, post_id=post_id)
        response = self.session.get(url, timeout=30)
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SourceUnavailable(
                str(exc),
                status_code=response.status_code,
                url=response.url,
                body=response.text,
            ) from exc

        posts = self._parse_html(response.text, include_non_target=True)
        return posts[0] if posts else None

    def _parse_html(self, text: str, include_non_target: bool) -> list[ParsedSubmission]:
        soup = BeautifulSoup(text, "html.parser")
        posts: list[ParsedSubmission] = []
        for thing in soup.select("div.thing.link"):
            try:
                parsed = self._parse_thing(thing, include_non_target)
                if parsed:
                    posts.append(parsed)
            except Exception as exc:
                logger.error("old_reddit_parse_failed", error=str(exc))
        return posts

    def _parse_thing(self, thing: Any, include_non_target: bool) -> ParsedSubmission | None:
        post_id = str(thing.get("data-fullname", "")).replace("t3_", "") or str(thing.get("data-id", ""))
        if not post_id:
            return None

        title_node = thing.select_one("a.title")
        title = html.unescape(title_node.get_text(" ", strip=True) if title_node else "Untitled")
        flair_node = thing.select_one(".linkflairlabel")
        raw_flair = flair_node.get_text(" ", strip=True) if flair_node else ""
        flair = canonicalize_flair(raw_flair)
        if not flair:
            return None
        if not include_non_target and flair not in TARGET_FLAIRS:
            return None

        comments_url = thing.get("data-permalink") or ""
        if comments_url and not comments_url.startswith("http"):
            comments_url = urljoin("https://old.reddit.com", comments_url)
        external_url = thing.get("data-url") or (title_node.get("href") if title_node else "")
        timestamp = thing.select_one("time")
        created_at = int(time.time())
        if timestamp and timestamp.get("datetime"):
            try:
                created_at = int(time.mktime(time.strptime(timestamp["datetime"][:19], "%Y-%m-%dT%H:%M:%S")))
            except ValueError:
                pass

        score_node = thing.select_one(".score.unvoted")
        score = self._parse_score(score_node.get_text(" ", strip=True) if score_node else "")

        return ParsedSubmission(
            post_id=post_id,
            flair=flair,
            title=title,
            permalink=comments_url or f"https://reddit.com/r/{self.subreddit}/comments/{post_id}/",
            image_urls=[external_url] if self._looks_like_image(external_url) else [],
            detected_budget=self._extract_budget(title),
            created_at=created_at,
            author=str(thing.get("data-author") or "[deleted]"),
            subreddit=self.subreddit,
            score=score,
            external_url=external_url,
            thumbnail="",
            stickied="stickied" in thing.get("class", []),
            over_18="over18" in thing.get("class", []),
            spoiler="spoiler" in thing.get("class", []),
            source=self.name,
            raw_metadata={"html_flair": raw_flair},
        )

    def _parse_score(self, value: str) -> int | None:
        if not value or value == "•":
            return None
        value = value.lower().replace(",", "").replace(" points", "").replace(" point", "")
        multiplier = 1000 if value.endswith("k") else 1
        value = value.rstrip("k")
        try:
            return int(float(value) * multiplier)
        except ValueError:
            return None

    def _looks_like_image(self, url: str) -> bool:
        return bool(url) and (
            any(url.lower().split("?")[0].endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"))
            or "i.redd.it" in url
        )


class RedditClient:
    """Poll Reddit sources in priority order and emit deduplicated posts."""

    def __init__(
        self,
        subreddit: str,
        on_new_post: Callable[[ParsedSubmission], None],
        poll_interval: int = POLL_INTERVAL,
        client_id: str | None = None,
        client_secret: str | None = None,
        username: str | None = None,
        password: str | None = None,
        user_agent: str | None = None,
        pushshift_mirrors: str | Iterable[str] | None = None,
        poll_jitter_seconds: int = DEFAULT_POLL_JITTER_SECONDS,
    ):
        self.subreddit = subreddit
        self.on_new_post = on_new_post
        self.poll_interval = poll_interval
        self.poll_jitter_seconds = max(0, poll_jitter_seconds)
        self.session = requests.Session()
        resolved_user_agent = (user_agent or "ReddifLeadMonitor/1.0 by u/reddif_monitor").strip()
        self.session.headers.update(
            {
                "User-Agent": resolved_user_agent,
                "Accept": "application/json,text/plain,text/html,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "DNT": "1",
            }
        )
        self.session.verify = resolve_request_verify()
        mirrors = (
            [item.strip() for item in pushshift_mirrors.split(",")]
            if isinstance(pushshift_mirrors, str)
            else list(pushshift_mirrors or [])
        )
        self.sources: list[RedditSource] = [
            OAuthRedditSource(
                subreddit,
                self.session,
                client_id or "",
                client_secret or "",
                username or "",
                password or "",
            ),
            RssRedditSource(subreddit, self.session),
            PushshiftRedditSource(subreddit, self.session, mirrors),
            OldRedditHtmlSource(subreddit, self.session),
        ]
        self._source_health = {
            source.name: SourceHealth(source.name, source.priority, source.enabled)
            for source in self.sources
        }
        self._running = False
        self._seen_posts: set[str] = set()
        self._best_seen_posts: dict[str, ParsedSubmission] = {}
        self._active_source: str | None = None
        self._last_error: str | None = None
        self._active_backoff_seconds = 0

    def _parse_post(
        self, post_data: dict[str, Any], include_non_target: bool = False
    ) -> Optional[ParsedSubmission]:
        """Compatibility helper used by existing tests."""
        helper = BaseSource(self.subreddit, self.session)
        helper.name = "test"
        return helper._parse_oauth_like_post(post_data, include_non_target)

    def _extract_image_urls(self, post_data: dict[str, Any]) -> list[str]:
        """Compatibility helper used by existing tests."""
        return BaseSource(self.subreddit, self.session)._extract_image_urls(post_data)

    def _extract_budget(self, title: str) -> Optional[str]:
        """Compatibility helper used by existing tests."""
        return BaseSource(self.subreddit, self.session)._extract_budget(title)

    def _record_success(self, source: RedditSource, duration_ms: int, post_count: int) -> None:
        now = int(time.time())
        health = self._source_health[source.name]
        recovered = health.consecutive_failures > 0
        previous_active = self._active_source
        health.enabled = source.enabled
        health.last_attempt_at = now
        health.last_success_at = now
        health.last_failure_at = None
        health.failure_reason = None
        health.last_status_code = 200
        health.last_error_url = None
        health.last_error_body_snippet = None
        health.consecutive_failures = 0
        health.fetch_duration_ms = duration_ms
        health.posts_retrieved_count = post_count
        self._active_source = source.name
        self._last_error = None
        self._active_backoff_seconds = 0
        if previous_active and previous_active != source.name:
            logger.info("reddit_source_failover", from_source=previous_active, to_source=source.name)
        if recovered:
            logger.info("reddit_source_recovered", source=source.name)

    def _record_failure(
        self,
        source: RedditSource,
        error: SourceUnavailable | Exception,
        duration_ms: int,
    ) -> None:
        now = int(time.time())
        health = self._source_health[source.name]
        reason = str(error)
        body = getattr(error, "body", None)
        health.enabled = source.enabled
        health.last_attempt_at = now
        health.last_failure_at = now
        health.failure_reason = reason
        health.last_status_code = getattr(error, "status_code", None)
        health.last_error_url = getattr(error, "url", None)
        health.last_error_body_snippet = (body or "").strip()[:MAX_ERROR_SNIPPET_CHARS] or None
        health.consecutive_failures += 1
        health.fetch_duration_ms = duration_ms
        health.posts_retrieved_count = 0
        self._last_error = reason
        self._active_backoff_seconds = min(
            self.poll_interval * health.consecutive_failures,
            MAX_CONSECUTIVE_FAILURE_BACKOFF,
        )
        logger.warning(
            "reddit_source_failed",
            source=source.name,
            priority=source.priority,
            error=reason,
            status_code=health.last_status_code,
            url=health.last_error_url,
            consecutive_failures=health.consecutive_failures,
        )

    def get_runtime_status(self) -> dict[str, Any]:
        """Expose Reddit ingestion health for diagnostics endpoints."""
        active_health = self._source_health.get(self._active_source or "")
        reddit_fetch_ok = bool(active_health and active_health.last_success_at)
        return {
            "reddit_fetch_ok": reddit_fetch_ok,
            "last_error": self._last_error,
            "active_backoff_seconds": self._active_backoff_seconds,
            "current_active_source": self._active_source,
            "source_priority": active_health.priority if active_health else None,
            "sources": {
                name: asdict(health)
                for name, health in sorted(
                    self._source_health.items(), key=lambda item: item[1].priority
                )
            },
        }

    def _sleep_after_cycle(self) -> None:
        delay = max(self.poll_interval, self._active_backoff_seconds)
        if self.poll_jitter_seconds:
            delay += random.uniform(0, self.poll_jitter_seconds)
        time.sleep(delay)

    def _ordered_sources(self) -> list[RedditSource]:
        # Always probe from highest priority first so recovery is automatic.
        return sorted(self.sources, key=lambda source: source.priority)

    def fetch_new_posts(self) -> list[ParsedSubmission]:
        """Fetch new posts using automatic priority failover."""
        for source in self._ordered_sources():
            if not source.enabled:
                self._source_health[source.name].enabled = False
                continue

            start = time.monotonic()
            logger.info("reddit_source_selected", source=source.name, priority=source.priority)
            try:
                posts = source.fetch_new_posts()
                duration_ms = int((time.monotonic() - start) * 1000)
                self._record_success(source, duration_ms, len(posts))
                logger.info(
                    "reddit_source_fetch_completed",
                    source=source.name,
                    post_count=len(posts),
                    duration_ms=duration_ms,
                )
                return self._dedupe_and_filter(posts)
            except (SourceUnavailable, requests.RequestException, json.JSONDecodeError) as exc:
                duration_ms = int((time.monotonic() - start) * 1000)
                self._record_failure(source, exc, duration_ms)
                continue
            except Exception as exc:
                duration_ms = int((time.monotonic() - start) * 1000)
                self._record_failure(source, exc, duration_ms)
                continue

        logger.error("reddit_all_sources_failed", subreddit=self.subreddit)
        return []

    def _dedupe_and_filter(self, posts: list[ParsedSubmission]) -> list[ParsedSubmission]:
        new_posts: list[ParsedSubmission] = []
        for post in posts:
            if not post.post_id:
                continue

            previous = self._best_seen_posts.get(post.post_id)
            if not previous or post.richness_score() > previous.richness_score():
                self._best_seen_posts[post.post_id] = post

            if post.post_id in self._seen_posts:
                logger.info(
                    "reddit_post_deduped",
                    post_id=post.post_id,
                    source=post.source,
                    richness_score=post.richness_score(),
                )
                continue

            new_posts.append(post)
        return new_posts

    def run(self) -> None:
        """Start polling for new posts."""
        self._running = True
        logger.info(
            "reddit_client_started",
            subreddit=self.subreddit,
            interval=self.poll_interval,
            jitter_seconds=self.poll_jitter_seconds,
        )

        while self._running:
            try:
                posts = self.fetch_new_posts()
                for post in posts:
                    try:
                        self.on_new_post(post)
                        self._seen_posts.add(post.post_id)
                        logger.info(
                            "reddit_post_processed",
                            post_id=post.post_id,
                            source=post.source,
                            flair=post.flair,
                        )
                    except Exception as exc:
                        logger.error("callback_failed", post_id=post.post_id, error=str(exc))

                self._sleep_after_cycle()
            except KeyboardInterrupt:
                logger.info("reddit_client_stopped_by_user")
                break
            except Exception as exc:
                logger.error("reddit_client_error", error=str(exc))
                self._sleep_after_cycle()

    def stop(self) -> None:
        """Stop the client."""
        self._running = False
        logger.info("reddit_client_stopped")

    def fetch_single_post(self, post_id: str) -> Optional[ParsedSubmission]:
        """Fetch a specific post without using anonymous Reddit JSON."""
        for source in self._ordered_sources():
            if not source.enabled:
                continue
            try:
                parsed = source.fetch_single_post(post_id)
                if parsed:
                    return parsed
            except Exception as exc:
                logger.warning(
                    "fetch_single_post_source_failed",
                    source=source.name,
                    post_id=post_id,
                    error=str(exc),
                )
        logger.error("fetch_single_post_failed", post_id=post_id)
        return None
