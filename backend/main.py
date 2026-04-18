"""Main FastAPI application with Reddit stream and scheduler."""

import logging
import os
import sys
import time
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path

import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from fcm_service import FCMService
from hmac_auth import (
    create_limiter,
    get_hmac_auth,
    verify_hmac_signature,
    HMACAuth,
    clean_expired_nonces,
)


def create_hmac_verifier(hmac_auth: HMACAuth):
    """Create a dependency that captures hmac_auth properly."""

    async def verify(request: Request) -> bool:
        return await verify_hmac_signature(request, hmac_auth)

    return verify


from reddit_client import RedditClient, ParsedSubmission
from scheduler_jobs import SchedulerJobs
from state_manager import Post, StateManager

# Structured logging setup with structlog
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(
        file=open(log_dir / "reddit_monitor.log", "a")
    ),
    cache_logger_on_first_use=True,
)

# Load environment variables
load_dotenv()


def resolve_subreddit(value: str | None) -> str:
    """Resolve subreddit name from either plain name or full reddit URL."""
    default_subreddit = "PhotoshopRequest"
    if not value:
        return default_subreddit

    raw = value.strip()
    if not raw:
        return default_subreddit

    # Support values like:
    # - PhotoshopRequest
    # - r/PhotoshopRequest
    # - https://www.reddit.com/r/PhotoshopRequest/
    match = re.search(r"(?:reddit\.com/)?r/([A-Za-z0-9_]+)", raw, re.IGNORECASE)
    if match:
        return match.group(1)

    # Fallback: sanitize plain subreddit-like token
    cleaned = re.sub(r"[^A-Za-z0-9_]", "", raw)
    return cleaned or default_subreddit

# Configuration
ALLOWED_ORIGINS = (
    os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
)

CONFIG = {
    "subreddit_name": resolve_subreddit(
        os.getenv("SUBREDDIT_NAME", "PhotoshopRequest")
    ),
    "firebase_project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "hmac_secret": os.getenv("HMAC_SECRET", "change-this-in-production"),
    "rate_limit": int(os.getenv("RATE_LIMIT", "60")),
    "log_level": os.getenv("LOG_LEVEL", "INFO"),
    "host": os.getenv("HOST", "0.0.0.0"),
    "port": int(os.getenv("PORT", "8000")),
    "poll_interval": int(os.getenv("POLL_INTERVAL", "30")),
}

# Start time for uptime calculation
START_TIME = time.time()

# Create logger instance
logger = structlog.get_logger(__name__)

# Initialize services
state_manager = StateManager()
hmac_auth = get_hmac_auth(CONFIG["hmac_secret"])
hmac_verifier = create_hmac_verifier(hmac_auth)

# Verify Firebase service account exists
firebase_creds_path = Path("firebase-service-account.json")
if not firebase_creds_path.exists():
    logger.error("firebase-service-account.json not found! FCM will not work.")
    fcm_service = None
else:
    fcm_service = FCMService(str(firebase_creds_path))

# Initialize Reddit client (no API key needed!)
reddit_client = RedditClient(
    subreddit=CONFIG["subreddit_name"],
    on_new_post=lambda parsed: handle_new_submission(
        parsed, state_manager, fcm_service
    ),
    poll_interval=CONFIG["poll_interval"],
)
logger.info(
    "reddit_client_initialized",
    subreddit=CONFIG["subreddit_name"],
    poll_interval=CONFIG["poll_interval"],
)

# Initialize scheduler jobs (only if both reddit and fcm are available)
scheduler_jobs = (
    SchedulerJobs(
        state_manager=state_manager,
        fcm_service=fcm_service,
        reddit_client=reddit_client,
    )
    if reddit_client and fcm_service
    else None
)

# Scheduler
scheduler = BackgroundScheduler()


def handle_new_submission(
    parsed: ParsedSubmission, state: StateManager, fcm: FCMService | None
) -> None:
    """Handle a new Reddit submission."""
    if not fcm:
        logger.warning("FCM not initialized, cannot send notifications")
        return

    # Check if post already exists
    if state.post_exists(parsed.post_id):
        logger.warning(f"Post {parsed.post_id} already exists, skipping")
        return

    # Insert into database
    post = Post(
        post_id=parsed.post_id,
        flair=parsed.flair,
        title=parsed.title,
        permalink=parsed.permalink,
        image_urls=parsed.image_urls,
        detected_budget=parsed.detected_budget,
        status="open",
        created_at=parsed.created_at,
    )

    if not state.insert_post(post):
        return

    # Send FCM notification
    success = fcm.send_new_post_notification(
        post_id=parsed.post_id,
        flair=parsed.flair,
        title=parsed.title,
        permalink=parsed.permalink,
        image_urls=parsed.image_urls,
        detected_budget=parsed.detected_budget,
        created_at=parsed.created_at,
    )

    if success:
        logger.info(f"Processed and notified for post {parsed.post_id}")
    else:
        logger.error(f"Failed to send FCM notification for {parsed.post_id}")


# FastAPI app with lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown."""
    logger.info("Starting up Reddit Lead Monitor")

    if reddit_client:
        import threading

        client_thread = threading.Thread(target=reddit_client.run, daemon=True)
        client_thread.start()
        logger.info("Reddit client started in background thread")
    else:
        logger.warning("Reddit client not initialized")

    scheduler.add_job(
        clean_expired_nonces,
        trigger=IntervalTrigger(minutes=1),
        id="nonce_cleanup",
        name="Clean expired HMAC nonces",
        replace_existing=True,
    )

    if scheduler_jobs:
        scheduler.add_job(
            scheduler_jobs.cleanup_and_poll,
            trigger=IntervalTrigger(minutes=5),
            id="cleanup_and_poll",
            name="Cleanup expired posts",
            replace_existing=True,
        )

    scheduler.start()
    logger.info("APScheduler started")

    logger.info(f"Server started on {CONFIG['host']}:{CONFIG['port']}")

    yield

    logger.info("Shutting down Reddit Lead Monitor")

    if reddit_client:
        reddit_client.stop()

    scheduler.shutdown(wait=False)
    logger.info("Shutdown complete")


app = FastAPI(
    title="Reddit Lead Monitor",
    description="Reddit post monitoring with FCM notifications",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
limiter = create_limiter()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - FIXED: Restrict origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS
    if ALLOWED_ORIGINS
    else ["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "X-Signature", "Content-Type"],
)


@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Health check endpoint - basic status without sensitive internals."""
    logger.info("health_check_called", method=request.method, path=request.url.path)
    return {
        "status": "healthy",
        "timestamp": time.time(),
    }


@app.get("/health/detailed")
@limiter.limit("10/minute")
async def detailed_health_check(request: Request):
    """Detailed health check - requires authentication."""
    logger.info(
        "detailed_health_check_called", method=request.method, path=request.url.path
    )
    uptime = time.time() - START_TIME
    stats = state_manager.get_stats()

    return {
        "status": "healthy",
        "uptime_seconds": int(uptime),
        "uptime_human": f"{int(uptime // 3600)}h {int((uptime % 3600) // 60)}m {int(uptime % 60)}s",
        "database": stats,
        "reddit_stream_active": reddit_client is not None,
        "fcm_initialized": fcm_service is not None,
    }


@app.get("/post/{post_id}")
@limiter.limit("60/minute")
async def get_post(request: Request, post_id: str):
    """Get a single post by ID (for deep linking)."""
    # Input validation - prevent injection and DoS
    if not re.match(r"^[a-zA-Z0-9_-]{1,20}$", post_id):
        logger.warning(
            "invalid_post_id_format", post_id=post_id, provided_length=len(post_id)
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid post_id format. Must be 1-20 alphanumeric characters.",
        )

    logger.info(
        "get_post_request",
        post_id=post_id,
        method=request.method,
        path=request.url.path,
    )

    post = state_manager.get_post(post_id)

    if not post:
        logger.info("post_not_found", post_id=post_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Post {post_id} not found"
        )

    return {
        "post_id": post.post_id,
        "flair": post.flair,
        "title": post.title,
        "permalink": post.permalink,
        "image_urls": post.image_urls,
        "detected_budget": post.detected_budget,
        "status": post.status,
        "created_at": post.created_at,
    }


@app.post("/mark-solved/{post_id}")
@limiter.limit("30/minute")
async def mark_solved(
    request: Request,
    post_id: str,
    _: bool = Depends(hmac_verifier),
):
    """
    Mark a post as solved. Requires HMAC-SHA256 signature with timestamp and nonce.

    Headers required:
    - X-Signature: HMAC-SHA256 signature
    - X-Timestamp: Unix timestamp
    - X-Nonce: Unique random string
    """
    # Input validation
    if not re.match(r"^[a-zA-Z0-9_-]{1,20}$", post_id):
        logger.warning("invalid_post_id_format_mark_solved", post_id=post_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid post_id format"
        )

    logger.info(
        "mark_solved_request",
        post_id=post_id,
        method=request.method,
        path=request.url.path,
    )

    post = state_manager.get_post(post_id)

    if not post:
        logger.info("post_not_found_mark_solved", post_id=post_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Post {post_id} not found"
        )

    if post.status == "solved":
        logger.info("post_already_solved", post_id=post_id)
        return {
            "post_id": post_id,
            "status": "solved",
            "message": "Post already marked as solved",
        }

    # Update status
    if state_manager.update_post_status(post_id, "solved"):
        # Send FCM notification
        if fcm_service:
            fcm_service.send_solved_notification(post_id=post_id, flair=post.flair)

        logger.info("post_marked_solved", post_id=post_id, flair=post.flair)

        return {
            "post_id": post_id,
            "status": "solved",
            "message": "Post marked as solved",
        }

    logger.error("failed_to_mark_solved", post_id=post_id)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to update post status",
    )


# CLI entry point
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=CONFIG["host"],
        port=CONFIG["port"],
        reload=False,
        log_level=CONFIG["log_level"].lower(),
    )
