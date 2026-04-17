"""APScheduler jobs for expiry cleanup and flair polling."""

import logging
import time
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from state_manager import StateManager
    from fcm_service import FCMService
    from reddit_client import RedditClient

logger = structlog.get_logger(__name__)


class SchedulerJobs:
    """Background jobs for the scheduler."""

    def __init__(
        self,
        state_manager: "StateManager",
        fcm_service: "FCMService | None",
        reddit_client: "RedditClient",
    ):
        self.state_manager = state_manager
        self.fcm_service = fcm_service
        self.reddit_client = reddit_client

    def cleanup_and_poll(self) -> None:
        """
        Combined job that runs every 5 minutes:
        1. Deletes expired posts (>48 hours) and sends EXPIRED notifications
        2. Polls active posts for flair updates
        """
        logger.info("scheduler_job_started", job="cleanup_and_poll")

        try:
            self._cleanup_expired()
            self._poll_flair_updates()
            logger.info("scheduler_job_completed", job="cleanup_and_poll")
        except Exception as e:
            logger.error("scheduler_job_failed", job="cleanup_and_poll", error=str(e))

    def _cleanup_expired(self) -> None:
        """Delete expired posts and notify clients."""
        try:
            expired_ids = self.state_manager.delete_expired_posts(expiry_seconds=172800)

            if expired_ids:
                logger.info(
                    "expired_posts_cleanup",
                    count=len(expired_ids),
                    post_ids=expired_ids[:5],
                )

                # Send EXPIRED notification for each
                for post_id in expired_ids:
                    try:
                        if self.fcm_service:
                            self.fcm_service.send_expired_notification(post_id)
                    except Exception as e:
                        logger.error(
                            "expired_notification_failed", post_id=post_id, error=str(e)
                        )
            else:
                logger.debug("no_expired_posts_found")

        except Exception as e:
            logger.error("cleanup_job_failed", error=str(e))

    def _poll_flair_updates(self) -> None:
        """Poll active posts for flair changes."""
        try:
            active_posts = self.state_manager.get_active_posts()

            if not active_posts:
                logger.debug("no_active_posts_to_poll")
                return

            logger.info("flair_polling_started", active_count=len(active_posts))

            for post in active_posts:
                try:
                    # Fetch current state from Reddit
                    current_submission = self.reddit_client.fetch_single_post(
                        post.post_id
                    )

                    if not current_submission:
                        logger.warning("flair_poll_fetch_failed", post_id=post.post_id)
                        continue

                    # Check if flair changed
                    if current_submission.flair != post.flair:
                        old_flair = post.flair
                        new_flair = current_submission.flair

                        logger.info(
                            "flair_change_detected",
                            post_id=post.post_id,
                            old_flair=old_flair,
                            new_flair=new_flair,
                        )

                        # Update database
                        self.state_manager.update_post_flair(post.post_id, new_flair)

                        # Send FCM notification
                        if self.fcm_service:
                            self.fcm_service.send_flair_update(
                                post_id=post.post_id,
                                new_flair=new_flair,
                                old_flair=old_flair,
                            )

                        # If new flair is "Solved" or similar, update status
                        if "solved" in new_flair.lower():
                            self.state_manager.update_post_status(
                                post.post_id, "solved"
                            )
                            if self.fcm_service:
                                self.fcm_service.send_solved_notification(
                                    post_id=post.post_id, flair=new_flair
                                )

                        logger.info(
                            "flair_updated_successfully",
                            post_id=post.post_id,
                            old_flair=old_flair,
                            new_flair=new_flair,
                        )

                except Exception as e:
                    logger.error(
                        "flair_poll_individual_failed",
                        post_id=post.post_id,
                        error=str(e),
                    )
                    continue

            logger.info("flair_polling_completed", checked_count=len(active_posts))

        except Exception as e:
            logger.error("flair_polling_job_failed", error=str(e))
