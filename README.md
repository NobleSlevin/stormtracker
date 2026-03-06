# StormWatch PWA

Live NWS severe weather alerts, 7-day forecast, and tornado risk index — installable as an iPhone home screen app.

## Deploy to GitHub Pages (5 minutes)

1. **Create a new GitHub repo** at github.com → New repository
   - Name it `stormwatch` (or anything)
   - Set to **Public**
   - Skip the README init

2. **Upload these files** (drag & drop into the repo):
   - `index.html`
   - `app.js`
   - `sw.js`
   - `manifest.json`
   - `icon.png`

3. **Enable GitHub Pages**:
   - Go to repo **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** → **/ (root)**
   - Click **Save**

4. **Your URL** will be: `https://YOUR-USERNAME.github.io/stormwatch/`
   (takes ~1 minute to go live)

## Install on iPhone

1. Open the URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add**

The app will appear on your home screen with the StormWatch icon, launches full-screen with no browser chrome.

## Features

- 🌩 Live NWS alerts with severity filtering
- ☀️ 7-day forecast with weather icons  
- 🌪 Tornado risk radar chart (8-factor analysis)
- 📍 GPS location or search by ZIP/city
- 🔄 Auto-refreshes every 2 minutes
- 📶 Works offline (cached on first load)
