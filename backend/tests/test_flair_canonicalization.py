from reddit_client import canonicalize_flair, RedditClient


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