"""Firebase Cloud Messaging service for sending notifications."""

import json
import logging
from typing import Any

import structlog
from firebase_admin import credentials, initialize_app, messaging

logger = structlog.get_logger(__name__)

# Flair to FCM topic mapping
FLAIR_TO_TOPIC = {
    "Paid - No AI": "paid_no_ai",
    "Paid - AI OK": "paid_ai_ok",
    "Free": "free_posts",
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
        return FLAIR_TO_TOPIC.get(flair)

    def send_new_post_notification(
        self,
        post_id: str,
        flair: str,
        title: str,
        permalink: str,
        image_urls: list[str],
        detected_budget: str | None,
        created_at: int,
    ) -> bool:
        """Send notification for new post with notification + data payload."""
        topic = self._get_topic(flair)
        if not topic:
            logger.warning("no_topic_mapping", flair=flair, post_id=post_id)
            return False

        try:
            # Build notification body
            body = f"💰 {detected_budget}" if detected_budget else "New request"
            truncated_title = title[:50] + "..." if len(title) > 50 else title

            # Build data payload
            data_payload = {
                "type": "NEW_POST",
                "postId": post_id,
                "flair": flair,
                "title": title,
                "permalink": permalink,
                "imageUrls": json.dumps(image_urls),
                "detectedBudget": detected_budget or "",
                "createdAt": str(created_at),
            }

            message = messaging.Message(
                notification=messaging.Notification(
                    title=f"[{flair}] {truncated_title}",
                    body=body,
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
                flair=flair,
                topic=topic,
                notification_id=response,
            )
            return True

        except Exception as e:
            logger.error(
                "fcm_notification_failed", post_id=post_id, flair=flair, error=str(e)
            )
            return False

    def send_flair_update(
        self, post_id: str, new_flair: str, old_flair: str | None = None
    ) -> bool:
        """Send data-only notification for flair update."""
        # Determine topic based on new flair or old flair
        topic = self._get_topic(new_flair) or (
            self._get_topic(old_flair) if old_flair else None
        )
        if not topic:
            logger.warning(
                "no_topic_for_flair_update", new_flair=new_flair, post_id=post_id
            )
            return False

        try:
            message = messaging.Message(
                data={
                    "type": "FLAIR_UPDATE",
                    "postId": post_id,
                    "newFlair": new_flair,
                },
                android=messaging.AndroidConfig(priority="high", direct_boot_ok=True),
                topic=topic,
            )

            response = messaging.send(message)
            logger.info(
                "fcm_flair_update_sent",
                post_id=post_id,
                old_flair=old_flair,
                new_flair=new_flair,
                topic=topic,
                notification_id=response,
            )
            return True

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
        topic = self._get_topic(flair)
        if not topic:
            topic = "free_posts"  # Fallback topic

        try:
            message = messaging.Message(
                data={"type": "SOLVED", "postId": post_id, "status": "solved"},
                android=messaging.AndroidConfig(priority="high", direct_boot_ok=True),
                topic=topic,
            )

            response = messaging.send(message)
            logger.info(
                "fcm_solved_sent",
                post_id=post_id,
                flair=flair,
                topic=topic,
                notification_id=response,
            )
            return True

        except Exception as e:
            logger.error(
                "fcm_solved_failed", post_id=post_id, flair=flair, error=str(e)
            )
            return False
