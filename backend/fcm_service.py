"""Firebase Cloud Messaging service for sending notifications."""

import json
import logging
import re
from typing import Any

import structlog
from firebase_admin import credentials, initialize_app, messaging

logger = structlog.get_logger(__name__)

MAX_BODY_CHARS = 220

# Flair to FCM topic mapping
FLAIR_TO_TOPIC = {
    "Paid - No AI": "paid_no_ai",
    "Paid - AI OK": "paid_ai_ok",
    "Free": "free_posts",
}

# Backward-compatible topic aliases for older mobile app builds.
TOPIC_ALIASES = {
    "paid_no_ai": ["paid_no_ai", "paid_noai"],
    "paid_ai_ok": ["paid_ai_ok", "paid_ai"],
    "free_posts": ["free_posts", "free"],
}


def normalize_flair(flair: str | None) -> str:
    """Normalize flair text for resilient topic lookup."""
    if not flair:
        return ""

    normalized = flair.strip().lower()
    # Remove Reddit emoji tokens like :no-ai: / :snoo:
    normalized = re.sub(r":[a-z0-9_+-]+:", " ", normalized)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized


def canonicalize_flair(flair: str | None) -> str | None:
    """Map flair variants to canonical labels used across backend and mobile."""
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


NORMALIZED_FLAIR_TO_TOPIC = {
    normalize_flair(key): value for key, value in FLAIR_TO_TOPIC.items()
}


class FCMService:
    """Handles Firebase Cloud Messaging operations."""

    def __init__(self, service_account_path: str):
        self._initialized = False
        self.service_account_path = service_account_path
        self._init_firebase()

    def _init_firebase(self) -> None:
        """Initialize Firebase Admin SDK."""
        try:
            cred = credentials.Certificate(self.service_account_path)
            try:
                initialize_app(cred)
            except ValueError as e:
                if "default Firebase app already exists" in str(e):
                    logger.warning("firebase_app_already_initialized")
                else:
                    raise
            self._initialized = True
            logger.info(
                "firebase_initialized", service_account=self.service_account_path
            )
        except Exception as e:
            logger.error("firebase_init_failed", error=str(e))
            raise

    def _get_topic(self, flair: str) -> str | None:
        """Get FCM topic for a flair."""
        canonical_flair = canonicalize_flair(flair)
        if not canonical_flair:
            return None
        return NORMALIZED_FLAIR_TO_TOPIC.get(normalize_flair(canonical_flair))

    def _get_topics(self, flair: str) -> list[str]:
        """Get canonical + legacy topics for a flair."""
        topic = self._get_topic(flair)
        if not topic:
            return []

        aliases = TOPIC_ALIASES.get(topic, [topic])
        deduped = list(dict.fromkeys(aliases))
        return deduped

    def send_new_post_notification(
        self,
        post_id: str,
        flair: str,
        title: str,
        body: str,
        permalink: str,
        image_urls: list[str],
        detected_budget: str | None,
        created_at: int,
    ) -> bool:
        """Send notification for new post with notification + data payload."""
        canonical_flair = canonicalize_flair(flair) or flair
        topics = self._get_topics(canonical_flair)
        if not topics:
            logger.warning("no_topic_mapping", flair=flair, post_id=post_id)
            return False

        try:
            # Build notification body
            notification_preview = (
                f"💰 {detected_budget}" if detected_budget else "New request"
            )
            truncated_title = title[:50] + "..." if len(title) > 50 else title
            truncated_body = (body or "")[:MAX_BODY_CHARS]

            # Build data payload
            data_payload = {
                "type": "NEW_POST",
                "postId": post_id,
                "flair": canonical_flair,
                "title": title,
                "body": truncated_body,
                "permalink": permalink,
                "imageUrls": json.dumps(image_urls),
                "detectedBudget": detected_budget or "",
                "createdAt": str(created_at),
            }

            delivered = False

            for topic in topics:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=f"[{canonical_flair}] {truncated_title}",
                        body=notification_preview,
                    ),
                    data=data_payload,
                    android=messaging.AndroidConfig(
                        priority="high",
                        ttl=172800,  # 48 hours
                        direct_boot_ok=True,
                    ),
                    topic=topic,
                )

                response = messaging.send(message)
                logger.info(
                    "fcm_notification_sent",
                    post_id=post_id,
                    flair=canonical_flair,
                    topic=topic,
                    notification_id=response,
                )
                delivered = True

            return delivered

        except Exception as e:
            logger.error(
                "fcm_notification_failed", post_id=post_id, flair=flair, error=str(e)
            )
            return False

    def send_flair_update(
        self, post_id: str, new_flair: str, old_flair: str | None = None
    ) -> bool:
        """Send data-only notification for flair update."""
        canonical_new_flair = canonicalize_flair(new_flair) or new_flair
        canonical_old_flair = canonicalize_flair(old_flair) if old_flair else None

        # Determine topic based on new flair or old flair
        topics = self._get_topics(canonical_new_flair)
        if not topics and canonical_old_flair:
            topics = self._get_topics(canonical_old_flair)

        if not topics:
            logger.warning(
                "no_topic_for_flair_update", new_flair=new_flair, post_id=post_id
            )
            return False

        try:
            delivered = False
            for topic in topics:
                message = messaging.Message(
                    data={
                        "type": "FLAIR_UPDATE",
                        "postId": post_id,
                        "newFlair": canonical_new_flair,
                    },
                    android=messaging.AndroidConfig(priority="high", direct_boot_ok=True),
                    topic=topic,
                )

                response = messaging.send(message)
                logger.info(
                    "fcm_flair_update_sent",
                    post_id=post_id,
                    old_flair=canonical_old_flair,
                    new_flair=canonical_new_flair,
                    topic=topic,
                    notification_id=response,
                )
                delivered = True

            return delivered

        except Exception as e:
            logger.error(
                "fcm_flair_update_failed",
                post_id=post_id,
                new_flair=new_flair,
                error=str(e),
            )
            return False

    def send_expired_notification(self, post_id: str) -> bool:
        """Send data-only notification for expired post."""
        try:
            # Broadcast to all topics
            topics = list(FLAIR_TO_TOPIC.values())

            for topic in topics:
                message = messaging.Message(
                    data={"type": "EXPIRED", "postId": post_id},
                    android=messaging.AndroidConfig(
                        priority="high", direct_boot_ok=True
                    ),
                    topic=topic,
                )

                try:
                    response = messaging.send(message)
                    logger.info(
                        "fcm_expired_sent",
                        post_id=post_id,
                        topic=topic,
                        notification_id=response,
                    )
                except Exception as e:
                    logger.error(
                        "fcm_expired_failed", post_id=post_id, topic=topic, error=str(e)
                    )
                    continue

            return True

        except Exception as e:
            logger.error(
                "fcm_expired_notification_failed", post_id=post_id, error=str(e)
            )
            return False

    def send_solved_notification(self, post_id: str, flair: str) -> bool:
        """Send data-only notification when post is marked as solved."""
        canonical_flair = canonicalize_flair(flair) or flair
        topics = self._get_topics(canonical_flair)
        if not topics:
            topics = TOPIC_ALIASES.get("free_posts", ["free_posts"])  # Fallback topics

        try:
            delivered = False
            for topic in topics:
                message = messaging.Message(
                    data={"type": "SOLVED", "postId": post_id, "status": "solved"},
                    android=messaging.AndroidConfig(priority="high", direct_boot_ok=True),
                    topic=topic,
                )

                response = messaging.send(message)
                logger.info(
                    "fcm_solved_sent",
                    post_id=post_id,
                    flair=canonical_flair,
                    topic=topic,
                    notification_id=response,
                )
                delivered = True

            return delivered

        except Exception as e:
            logger.error(
                "fcm_solved_failed", post_id=post_id, flair=flair, error=str(e)
            )
            return False
