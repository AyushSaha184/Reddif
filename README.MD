# Reddif

A Reddit lead monitoring application that tracks posts from subreddits like r/PhotoshopRequest and delivers push notifications to your mobile device.

## Installation Guide

### Prerequisites

- Python 3.10+
- Node.js 18+
- Firebase project (for push notifications)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` with your settings:

| Variable | Description | Required |
|----------|-------------|----------|
| `SUBREDDIT_NAME` | PhotoshopRequest | Yes |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | Yes |
| `HMAC_SECRET` | Secret for API signing | Yes |
| `ALLOWED_ORIGINS` | Mobile app URLs (comma-separated) | Yes |

Add your Firebase service account:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Save as `firebase-service-account.json` in the backend folder

**Run the backend:**

```bash
python main.py
```

The server runs on `http://localhost:8000` by default.

---

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:
- `API_URL` - Your backend URL (e.g., `http://192.168.1.x:8000`)
- `HMAC_SECRET` - Must match backend configuration

## Troubleshooting

### Backend Issues

**"firebase-service-account.json not found"**
- Download from Firebase Console → Project Settings → Service Accounts
- Place in `backend/` folder

**Connection refused errors**
- Ensure backend is running: `curl http://localhost:8000/health`
- Check firewall settings
- Verify `HOST` in `.env` is set to `0.0.0.0` for network access

**No notifications received**
- Verify Firebase project ID matches your Firebase project
- Check Firebase service account has Cloud Messaging enabled
- Review logs in `backend/logs/reddit_monitor.log`

**Rate limiting errors**
- Reddit may be throttling requests
- Increase `POLL_INTERVAL` in `.env` (default: 30 seconds)

---

### Mobile App Issues

**"Unable to connect to server"**
- Ensure backend is accessible from mobile device
- Use local network IP (not localhost)
- Check `ALLOWED_ORIGINS` includes your mobile app URL
- Verify HMAC secrets match between backend and mobile

**Build errors on iOS**
```bash
cd ios
pod deintegrate
pod install
cd ..
npx react-native run-ios
```

**Android APK won't install**
- Enable "Install unknown apps" in Android settings
- Uninstall previous version before installing new APK

**FCM notifications not working**
- Verify `firebase-project-id` in mobile `.env`
- Check Google Services JSON is properly configured in `android/app/`

---

### Getting Help

- Check backend logs: `tail -f backend/logs/reddit_monitor.log`
- Health check: `curl http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`