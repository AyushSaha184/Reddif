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
| `POLL_INTERVAL` | Seconds between checks | 30 |
| `FIREBASE_PROJECT_ID` | Firebase project ID | - |
| `HMAC_SECRET` | Secret for API signing | - |
| `HOST` | Server host | 0.0.0.0 |
| `PORT` | Server port | 8000 |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | - |

## No Reddit API Keys Required

This backend uses Reddit's public JSON endpoint - no API keys needed!

## API Endpoints

- `GET /health` - Health check
- `GET /post/{post_id}` - Get post by ID
- `POST /mark-solved/{post_id}` - Mark solved (requires HMAC)

## Logs

Logs stored in `logs/reddit_monitor.log`
