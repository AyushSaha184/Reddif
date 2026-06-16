# Reddit Lead Monitor Backend

## Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Add Firebase service account:**
- Download Firebase service account JSON from Firebase Console
- Save as `firebase-service-account.json` in backend folder

4. **Run:**
```bash
python main.py
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUBREDDIT_NAME` | Subreddit to monitor | PhotoshopRequest |
| `REDDIT_CLIENT_ID` | Reddit app client ID for OAuth polling | - |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret for OAuth polling | - |
| `REDDIT_USER_AGENT` | Descriptive Reddit API user agent | ReddifLeadMonitor/1.0 by u/reddif_monitor |
| `REDDIT_USERNAME` | Optional Reddit username for password-grant auth | - |
| `REDDIT_PASSWORD` | Optional Reddit password for password-grant auth | - |
| `POLL_INTERVAL` | Seconds between checks | 30 |
| `POLL_JITTER_SECONDS` | Random 0..N seconds added to each poll delay | 5 |
| `PUSHSHIFT_MIRRORS` | Comma-separated Pushshift-compatible base URLs | - |
| `FIREBASE_PROJECT_ID` | Firebase project ID | - |
| `HMAC_SECRET` | Secret for API signing | - |
| `HOST` | Server host | 0.0.0.0 |
| `PORT` | Server port | 8000 |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | - |

## Reddit API Access

Set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and a descriptive `REDDIT_USER_AGENT`.
The backend uses Reddit OAuth when those values are present. Anonymous Reddit JSON
listing endpoints are no longer used.

## Reddit Source Priority

The backend normalizes every source into the same internal post model and tries:

1. Reddit OAuth API
2. Subreddit RSS feed
3. Pushshift-compatible mirrors from `PUSHSHIFT_MIRRORS`
4. `old.reddit.com` HTML scraping

If a source fails, the next source is tried automatically. Each poll starts again
from the highest-priority healthy source so OAuth recovers automatically after an
outage or credential fix. Missing metadata is tolerated and never stops a poll
cycle.

OAuth provides the richest metadata. RSS and HTML generally provide fewer fields,
so optional metadata fields may be empty. Existing Android notification fields
remain unchanged.

## API Endpoints

- `GET /health` - Health check
- `GET /health/detailed` - Detailed runtime status, including Reddit fetch health
- `GET /post/{post_id}` - Get post by ID
- `POST /mark-solved/{post_id}` - Mark solved (requires HMAC)

## Logs

Logs stored in `logs/reddit_monitor.log`

## Diagnosing "No New Posts"

- `GET /health` now reports whether the backend is reachable, whether FCM is initialized, and whether Reddit polling is currently healthy.
- `GET /health/detailed` includes `reddit_status`, which exposes per-source fetch health, current active source, failures, durations, post counts, and current backoff.
- If `reddit_fetch_ok` is `false` but the server is otherwise healthy, the phone can still reach the backend even though fresh Reddit posts are not being ingested.
- If OAuth is unhealthy, check credentials and `REDDIT_USER_AGENT`. The backend should continue through lower-priority fallbacks when available.
