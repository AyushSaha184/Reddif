"""HMAC authentication and signing utilities with replay protection."""

import hmac
import hashlib
import logging
import time
import secrets
from typing import Set

from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Store used nonces in memory (in production, use Redis)
_used_nonces: Set[str] = set()
NONCE_EXPIRY_SECONDS = 300  # 5 minutes


class HMACAuth:
    """HMAC-SHA256 request signing verification with replay protection."""

    def __init__(self, secret: str):
        self.secret = secret.encode("utf-8")

    def generate_signature(self, message: str) -> str:
        """Generate HMAC-SHA256 signature for a message."""
        return hmac.new(
            self.secret, message.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    def verify_signature(self, message: str, signature: str) -> bool:
        """Verify HMAC-SHA256 signature."""
        expected = self.generate_signature(message)
        return hmac.compare_digest(expected, signature)


def clean_expired_nonces():
    """Clean up expired nonces periodically."""
    current_time = time.time()
    global _used_nonces
    _used_nonces = {
        nonce
        for nonce in _used_nonces
        if getattr(nonce, "expiry", current_time + 1) > current_time
    }


async def verify_hmac_signature(request: Request, hmac_auth: HMACAuth) -> bool:
    """
    Dependency to verify HMAC signature in X-Signature header.
    Includes timestamp and nonce validation to prevent replay attacks.

    Required Headers:
    - X-Signature: HMAC-SHA256 signature
    - X-Timestamp: Unix timestamp (valid within 5 minutes)
    - X-Nonce: Unique random string (prevent replay)

    Message format: "METHOD:/path/{post_id}:timestamp:nonce"
    """
    signature = request.headers.get("X-Signature")
    timestamp = request.headers.get("X-Timestamp")
    nonce = request.headers.get("X-Nonce")

    logger.info(
        "hmac_verification_attempt",
        path=request.url.path,
        method=request.method,
        has_signature=bool(signature),
        has_timestamp=bool(timestamp),
        has_nonce=bool(nonce),
    )

    if not signature:
        logger.warning("hmac_verification_failed", reason="missing_signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Signature header",
        )

    # Validate timestamp
    request_time = None
    if timestamp:
        try:
            request_time = int(timestamp)
            time_diff = abs(time.time() - request_time)

            if time_diff > NONCE_EXPIRY_SECONDS:
                logger.warning(
                    "hmac_verification_failed",
                    reason="timestamp_expired",
                    time_diff=time_diff,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Request timestamp expired. Maximum allowed: 5 minutes",
                )
        except ValueError:
            logger.warning(
                "hmac_verification_failed",
                reason="invalid_timestamp",
                timestamp=timestamp,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format",
            )
    else:
        logger.warning("hmac_verification_failed", reason="missing_timestamp")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Timestamp header",
        )

    # Validate nonce
    if nonce:
        if nonce in _used_nonces:
            logger.warning(
                "hmac_verification_failed",
                reason="nonce_reused",
                nonce=nonce[:8] + "...",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nonce already used (replay attack detected)",
            )
        # Add nonce with expiry
        _used_nonces.add(nonce)
        logger.debug("nonce_added", nonce=nonce[:8] + "...")
    else:
        logger.warning("hmac_verification_failed", reason="missing_nonce")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Nonce header",
        )

    # Build the message to verify including timestamp and nonce
    # Format: "METHOD:/path/{post_id}:timestamp:nonce"
    path = request.url.path
    method = request.method
    message = f"{method}:{path}:{timestamp}:{nonce}"

    logger.debug("hmac_message_verifying", message=message)

    if not hmac_auth.verify_signature(message, signature):
        logger.warning("hmac_verification_failed", reason="invalid_signature")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature",
        )

    logger.info("hmac_verification_success", path=request.url.path, method=method)
    return True


def get_hmac_auth(secret: str) -> HMACAuth:
    """Factory function to create HMACAuth instance."""
    return HMACAuth(secret)


# Rate limiter setup
def create_limiter() -> Limiter:
    """Create rate limiter with default key function."""
    return Limiter(key_func=get_remote_address)
