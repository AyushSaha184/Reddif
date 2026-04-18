<p align="center">
  <img src="./mobile/assets/Reddif_Banner.png" alt="Reddif Banner" width="100%" />
</p>

## What is Reddif?

Reddif is a Reddit lead-monitoring app for Android. It watches a target subreddit, sends push notifications for matching posts, and lets you open or save those posts from the mobile app.

## How to install

### 1. Install the prerequisites

- Git: https://git-scm.com/install/windows.html
- Python for Windows: https://www.python.org/downloads/windows/
- Node.js LTS: https://nodejs.org/en/download/
- Android Studio: https://developer.android.com/studio
- React Native Android environment setup guide: https://reactnative.dev/docs/0.78/set-up-your-environment
- Firebase Console: https://console.firebase.google.com/
- Firebase Cloud Messaging for Android: https://firebase.google.com/docs/cloud-messaging/android/get-started
- Firebase Admin SDK setup for the backend key: https://firebase.google.com/docs/admin/setup

Recommended versions for this repo:

- Python 3.9 or newer
- Node.js 18 or newer
- Android Studio with Android SDK installed
- The build apk is provided in the releases section, so you can skip the Android Studio setup if you just want to install the app without modifying the code.

### 2. Clone the project

```bash
git clone https://github.com/AyushSaha184/Reddif.git
cd Reddif
```

### 3. Set up the backend

Start the backend:
```bat
server.bat deps
server.bat start
```

The backend health URL is:

```text
http://localhost:8000/health
```

Important: the backend must stay running at all times(on a computer preferably), otherwise the app will stop receiving fresh post updates and notifications.

### 4. Fill the required backend details

First, create your own Firebase project and get your project ID:

- Open Firebase Console: https://console.firebase.google.com/
- Click `Create a project`.
- Enter a project name and complete the setup wizard.
- After project creation, open `Project settings`.
- In the `General` tab, copy your `Project ID`.
- Put this value in `backend/.env` as `FIREBASE_PROJECT_ID`.

Open `backend/.env.example` and copy its values into your real `backend/.env` setup. The required values are:

- `SUBREDDIT_NAME`: subreddit to monitor, for example `PhotoshopRequest`
- `POLL_INTERVAL`: how often the backend checks Reddit
- `FIREBASE_PROJECT_ID`: your Firebase project ID
- `HMAC_SECRET`: your own secret string used to sign requests
- `HOST`: usually `0.0.0.0`
- `PORT`: usually `8000`
- `ALLOWED_ORIGINS`: your backend or app origin if needed

You also need the Firebase server key file:

- In Firebase Console, open your project.
- Go to `Project settings` -> `Service accounts`.
- Click `Generate new private key`.
- Save the downloaded JSON file as:

```text
backend/firebase-service-account.json
```

Source:

- https://firebase.google.com/docs/admin/setup

For `HMAC_SECRET`, create your own long random string and use the exact same value in both the backend and the app settings.

### 5. Set up the Android app

Install mobile dependencies:

```bash
cd mobile
npm install
```

You also need the Firebase Android client config file:

- In Firebase Console, add or open an Android app in your Firebase project.
- Use this Android package name:

```text
com.reddifleadmonitor
```

- Download `google-services.json`.
- Place it here:

```text
mobile/android/app/google-services.json
```

Source:

- https://firebase.google.com/docs/cloud-messaging/android/get-started

### 6. Build and install the APK(only if you want to modify your own version of the app)

No manual Gradle commands are needed. Just run:

```bat
generate.bat
```

It will build the APK files and copy them to:

```text
C:\Apk-release
```

Expected files:

- `Reddif_v1.0.0_debug.apk`
- `Reddif_v1.0.0.apk`

Install the APK on your Android phone (Android 13+ supported).

### 7. Fill the required app details after installing

Open the Reddif app on your phone and go to `Settings`.

Fill these values:

- `Server URL`: the backend URL the phone can actually reach
- `HMAC Secret`: the same value you used in `backend/.env`

How to find your computer IP address (Windows):

- Press `Win + R`, type `cmd`, and press Enter.
- Run:

```bat
ipconfig
```

- Look for your active adapter (usually `Wi-Fi` or `Ethernet`).
- Copy the `IPv4 Address` value (example: `192.168.1.100`).

Server URL example:

- If the backend and phone are on the same Wi-Fi, use your computer's local IP, for example:

```text
http://192.168.1.100:8000
```

- Do not use `localhost` on the phone unless the backend is running on that same phone.

End result example in app settings:

- `Server URL`: `http://192.168.1.100:8000`
- `HMAC Secret`: `your_exact_backend_hmac_secret`

After changing these values in the app, tap `Save Settings`.

## Troubleshooting

- `server.bat` says Python is missing:
  Install Python from https://www.python.org/downloads/windows/ and reopen the terminal.

- `server.bat deps` fails:
  Make sure Python is installed correctly, then run:

```bat
server.bat deps
```

- Backend starts but notifications do not work:
  Check that `backend/firebase-service-account.json` exists and belongs to the same Firebase project as the Android app.

- Android build fails with a Firebase error:
  Make sure `mobile/android/app/google-services.json` exists and uses package name `com.reddifleadmonitor`.

- App opens but cannot reach the backend:
  Use your computer's LAN IP in the app settings, not `localhost`, then tap `Save Settings`.

- App settings keep failing:
  Make sure the `HMAC Secret` in the app exactly matches `HMAC_SECRET` in `backend/.env`.

- App stops receiving new posts:
  The backend is not running anymore. Start it again and keep it running:

```bat
server.bat start
```

- The Reddit app button does not open Reddit:
  Install the official Reddit app from Google Play, or let Reddif redirect you to the Play Store.

- `FIREBASE_PROJECT_ID` is wrong or empty:
  Open Firebase Console -> `Project settings` -> `General`, copy the exact `Project ID`, and update `backend/.env`.

- `backend/.env` file is missing:
  Copy `backend/.env.example` to `backend/.env`, then fill all required values.

- Backend fails with `.env` or config error:
  Check that `SUBREDDIT_NAME`, `POLL_INTERVAL`, `FIREBASE_PROJECT_ID`, and `HMAC_SECRET` are all present in `backend/.env`.

- `HMAC_SECRET` mismatch error:
  Use the exact same value in both places:
  1) `backend/.env` (`HMAC_SECRET`)
  2) App `Settings` -> `HMAC Secret`

- `google-services.json` missing:
  Download it from Firebase Console for Android app package `com.reddifleadmonitor` and place it in `mobile/android/app/google-services.json`.

- `firebase-service-account.json` missing:
  Generate a new private key from Firebase Console -> `Project settings` -> `Service accounts`, then save it as `backend/firebase-service-account.json`.

- App installs but notifications never arrive:
  Make sure notification permission is allowed on the phone, and verify phone internet is active.

- App cannot save settings:
  Confirm Server URL includes `http://` and port, for example `http://192.168.1.100:8000`.

- App shows network timeout:
  Ensure phone and backend computer are on the same Wi-Fi network and backend is still running.

- Firewall blocks connection:
  Allow Python or the backend process through Windows Firewall for private networks.

- Health endpoint does not open:
  Check backend terminal logs, then open `http://localhost:8000/health` on the backend machine.

- `generate.bat` fails:
  Ensure Android Studio SDK, Java, Node.js, and npm dependencies are installed, then run `npm install` inside `mobile` and retry `generate.bat`.

- APK not found in `C:\Apk-release`:
  Wait for build completion and check terminal output for build errors. If build failed, fix the first reported error and rerun `generate.bat`.

- `server.bat start` exits immediately:
  Run `server.bat deps` first, then start again, and read the first error in terminal output.

- Reddit posts are not matching expected results:
  Verify `SUBREDDIT_NAME` and any app-side filter/query values are correct.
