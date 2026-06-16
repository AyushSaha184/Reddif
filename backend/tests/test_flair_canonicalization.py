from pathlib import Path

from reddit_client import (
    ParsedSubmission,
    RedditClient,
    SourceUnavailable,
    canonicalize_flair,
    resolve_request_verify,
)


def make_post(post_id: str, source: str = "test") -> ParsedSubmission:
    return ParsedSubmission(
        post_id=post_id,
        flair="Free",
        title=f"Sample {post_id}",
        permalink=f"https://reddit.com/r/PhotoshopRequest/comments/{post_id}/sample/",
        image_urls=[],
        detected_budget=None,
        created_at=1713500000,
        author="tester",
        source=source,
    )


def test_canonicalize_live_photoshoprequest_flairs() -> None:
    assert canonicalize_flair("Paid - NO AI :no-ai:") == "Paid - No AI"
    assert canonicalize_flair("Paid - AI OK :yes-ai:") == "Paid - AI OK"
    assert canonicalize_flair("Free :snoo:") == "Free"
    assert canonicalize_flair("Solved ✅") == "Solved"
    assert canonicalize_flair("Unsolved") is None
    assert canonicalize_flair("Not Solved Yet") is None
    assert canonicalize_flair("Unpaid - No AI") is None
    assert canonicalize_flair("Freelancer") is None
    assert canonicalize_flair("Mod Announcement :king:") is None


def test_parse_post_accepts_target_variants() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)

    paid_no_ai = client._parse_post(
        {
            "id": "abc123",
            "link_flair_text": "Paid - NO AI :no-ai:",
            "title": "Need help with edit $15",
            "permalink": "/r/PhotoshopRequest/comments/abc123/sample/",
            "created_utc": 1713500000,
            "author": "tester",
        }
    )
    assert paid_no_ai is not None
    assert paid_no_ai.flair == "Paid - No AI"


def test_parse_post_can_include_solved_for_polling() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)

    solved = client._parse_post(
        {
            "id": "def456",
            "link_flair_text": "Solved ✅",
            "title": "Thanks everyone",
            "permalink": "/r/PhotoshopRequest/comments/def456/sample/",
            "created_utc": 1713500001,
            "author": "tester",
        },
        include_non_target=True,
    )
    assert solved is not None
    assert solved.flair == "Solved"


def test_resolve_request_verify_ignores_invalid_env(monkeypatch) -> None:
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", r"C:\missing\cacert.pem")
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)

    resolved = resolve_request_verify()

    assert isinstance(resolved, str)
    assert Path(resolved).is_file()
    assert "cacert.pem" in resolved


def test_reddit_client_pins_valid_verify_path(monkeypatch) -> None:
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", r"C:\missing\cacert.pem")
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)

    client = RedditClient("PhotoshopRequest", lambda _: None)

    assert isinstance(client.session.verify, str)
    assert Path(client.session.verify).is_file()


def test_fetch_new_posts_records_success_status(monkeypatch) -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)

    class FakeSource:
        name = "rss"
        priority = 2
        enabled = True

        def fetch_new_posts(self, include_non_target=False):
            return []

        def fetch_single_post(self, post_id):
            return None

    client.sources = [FakeSource()]
    posts = client.fetch_new_posts()
    status = client.get_runtime_status()

    assert posts == []
    assert status["reddit_fetch_ok"] is True
    assert status["last_error"] is None
    assert status["current_active_source"] == "rss"
    assert status["sources"]["rss"]["last_status_code"] == 200
    assert status["sources"]["rss"]["consecutive_failures"] == 0


def test_fetch_new_posts_records_source_error_status(monkeypatch) -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None, poll_interval=30)

    class FakeSource:
        name = "rss"
        priority = 2
        enabled = True

        def fetch_new_posts(self, include_non_target=False):
            raise SourceUnavailable(
                "403 Client Error: Blocked",
                status_code=403,
                url="https://www.reddit.com/r/PhotoshopRequest/.rss",
                body="<html>blocked by reddit</html>",
            )

        def fetch_single_post(self, post_id):
            return None

    client.sources = [FakeSource()]
    posts = client.fetch_new_posts()
    status = client.get_runtime_status()

    assert posts == []
    assert status["reddit_fetch_ok"] is False
    assert status["last_error"] == "403 Client Error: Blocked"
    assert status["sources"]["rss"]["last_status_code"] == 403
    assert status["sources"]["rss"]["last_error_url"] == "https://www.reddit.com/r/PhotoshopRequest/.rss"
    assert status["sources"]["rss"]["last_error_body_snippet"] == "<html>blocked by reddit</html>"
    assert status["sources"]["rss"]["consecutive_failures"] == 1
    assert status["active_backoff_seconds"] == 30


def test_fetch_new_posts_fails_over_to_next_source() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)

    class FailingSource:
        name = "oauth"
        priority = 1
        enabled = True

        def fetch_new_posts(self, include_non_target=False):
            raise SourceUnavailable("oauth_down")

        def fetch_single_post(self, post_id):
            return None

    class WorkingSource:
        name = "rss"
        priority = 2
        enabled = True

        def fetch_new_posts(self, include_non_target=False):
            return [make_post("abc123", source="rss")]

        def fetch_single_post(self, post_id):
            return None

    client.sources = [FailingSource(), WorkingSource()]
    posts = client.fetch_new_posts()
    status = client.get_runtime_status()

    assert [post.post_id for post in posts] == ["abc123"]
    assert status["current_active_source"] == "rss"
    assert status["sources"]["oauth"]["consecutive_failures"] == 1
    assert status["sources"]["rss"]["posts_retrieved_count"] == 1


def test_fetch_new_posts_deduplicates_submission_ids() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)

    class WorkingSource:
        name = "rss"
        priority = 2
        enabled = True

        def fetch_new_posts(self, include_non_target=False):
            return [make_post("abc123", source="rss")]

        def fetch_single_post(self, post_id):
            return None

    client.sources = [WorkingSource()]

    assert [post.post_id for post in client.fetch_new_posts()] == ["abc123"]
    client._seen_posts.add("abc123")
    assert client.fetch_new_posts() == []


def test_fetch_new_posts_uses_reddit_oauth_when_configured(monkeypatch) -> None:
    client = RedditClient(
        "PhotoshopRequest",
        lambda _: None,
        client_id="client-id",
        client_secret="client-secret",
        user_agent="ReddifTest/1.0",
    )
    requests_seen = {"post_url": None, "get_url": None, "get_headers": None}

    class TokenResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"access_token": "test-token", "expires_in": 3600}

    class ListingResponse:
        status_code = 200
        url = "https://oauth.reddit.com/r/PhotoshopRequest/new.json?limit=100"

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"data": {"children": []}}

    def fake_post(url, **kwargs):
        requests_seen["post_url"] = url
        assert kwargs["data"] == {"grant_type": "client_credentials"}
        return TokenResponse()

    def fake_get(url, **kwargs):
        requests_seen["get_url"] = url
        requests_seen["get_headers"] = kwargs.get("headers")
        assert kwargs["params"] == {"limit": 100, "raw_json": 1}
        return ListingResponse()

    monkeypatch.setattr(client.session, "post", fake_post)
    monkeypatch.setattr(client.session, "get", fake_get)

    posts = client.fetch_new_posts()

    assert posts == []
    assert requests_seen["post_url"] == "https://www.reddit.com/api/v1/access_token"
    assert requests_seen["get_url"] == "https://oauth.reddit.com/r/PhotoshopRequest/new.json"
    assert requests_seen["get_headers"] == {"Authorization": "Bearer test-token"}
    assert client.get_runtime_status()["reddit_fetch_ok"] is True
    assert client.get_runtime_status()["current_active_source"] == "oauth"


def test_pushshift_record_normalizes_missing_metadata() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)
    pushshift = next(source for source in client.sources if source.name == "pushshift")

    parsed = pushshift._parse_record(
        {
            "id": "ps123",
            "title": "Free edit request",
            "link_flair_text": "Free :snoo:",
            "created_utc": 1713500010,
            "permalink": "/r/PhotoshopRequest/comments/ps123/sample/",
        },
        include_non_target=False,
    )

    assert parsed is not None
    assert parsed.post_id == "ps123"
    assert parsed.flair == "Free"
    assert parsed.author == "[deleted]"
    assert parsed.source == "pushshift"


def test_old_reddit_html_parser_is_defensive() -> None:
    client = RedditClient("PhotoshopRequest", lambda _: None)
    old_reddit = next(source for source in client.sources if source.name == "old_reddit")

    html = """
    <div class="thing link" data-fullname="t3_html123" data-author="tester"
         data-permalink="/r/PhotoshopRequest/comments/html123/sample/"
         data-url="https://i.redd.it/html123.jpg">
      <a class="title">Need a quick edit $20</a>
      <span class="linkflairlabel">Paid - NO AI :no-ai:</span>
      <div class="score unvoted">12 points</div>
    </div>
    <div class="thing link"></div>
    """

    posts = old_reddit._parse_html(html, include_non_target=False)

    assert len(posts) == 1
    assert posts[0].post_id == "html123"
    assert posts[0].flair == "Paid - No AI"
    assert posts[0].image_urls == ["https://i.redd.it/html123.jpg"]
