# Six

Your messaging services in one quiet home. Six is a small Linux desktop app that puts Discord, WhatsApp, Threads, Instagram, Teams, Telegram, YouTube Music and Duck.ai side by side as compact tabs, and keeps them light on memory and CPU.

![Six home screen](docs/screenshot.png)

*The home screen, shown with sample data. Services you have not opened yet say "Open your space".*

## Services

| Service | Address | Notes |
|---|---|---|
| WhatsApp | web.whatsapp.com | Starts with Six and never sleeps |
| Telegram | web.telegram.org | Starts with Six and never sleeps; a **Latest ↓** button jumps to the newest messages |
| Teams | teams.microsoft.com | Microphone, camera and screen sharing for calls |
| Threads | threads.com | |
| Instagram | instagram.com | |
| Discord | discord.com | |
| YouTube Music | music.youtube.com | Plays protected tracks; ads are removed |
| Duck.ai | duck.ai | DuckDuckGo's AI chat |

Each service has its own saved login, kept separate from the others.

## Light on resources

- **Starts small.** Only WhatsApp and Telegram load at startup, including when Six starts hidden in the tray. The others load when you open them.
- **Pauses what you are not using.** A service you have not used for 5 minutes is paused: its page and drafts stay in memory, but background work stops.
- **Frees memory.** After 5 more minutes (10 in total) a paused service is closed to give its memory back. It reloads when you open it again, and you stay signed in.
- **Never closed:** WhatsApp, Telegram, services you set to **Keep awake**, services with a sign-in popup open, calls, and anything playing audio.
- **Capped cache.** Each service's web cache is limited to 256 MB.
- **Quiet in the tray.** Closing the window keeps Six running in the tray. Six stops refreshing its own screen while hidden.
- **Hardware video.** Video decoding and encoding run on the graphics chip through VA-API (on Intel, install `intel-media-va-driver`). If video glitches or shows black frames, add `"_hardwareVideo":false` to `~/.config/Six/settings.json` and restart Six.
- **Self-healing.** If an always-awake, pinned or open service crashes, Six restarts it, up to 3 times in 10 minutes.

The memory figure on the home screen is Six's real footprint: it uses the kernel's PSS numbers, which count memory shared between processes once. (A system monitor that adds up each process's resident memory shows a much bigger total, around 50% more.) Each open service's card also shows how much its page uses, and the same breakdown is written to `~/.config/Six/diagnostics.log` every 10 minutes, so you can see which service is growing.

## Notifications and sound

- With a service open, **Alerts on/off** controls its desktop notifications, and **Sound on / Muted** controls all of its audio, including call audio.
- The tray menu has **Pause all notifications**, **Mute all audio** and **Block ads and trackers**. A global setting overrides the per-service one.
- A paused or closed service cannot deliver notifications. Set a service to **Keep awake** if you need its alerts or calls.
- Some sites ask for a notification to stay on screen until you click it. Six removes that request and also closes such a notification after 5 seconds. Ordinary notifications are not touched.

## Ads, scrollbars and menus

- **Ad and tracker blocking.** Requests to known ad and tracking servers are blocked using [Peter Lowe's list](https://pgl.yoyo.org/adservers/) (bundled in `adblock-hosts.txt`, about 3,500 hosts). Pages you open are never blocked, only what they load. Switch it off from the tray menu. The hosts blocked for each service are written to `~/.config/Six/adblock-blocked.txt`; if a page breaks, find its host there and remove it from `adblock-hosts.txt`.
- **YouTube Music ads.** While blocking is on, the YouTube Music tab strips ad slots from YouTube's player data before playback. An ad that still gets through is muted, run to its end and skipped. YouTube changes its player often, so this can stop working until it is updated. Ads that a site serves from its own servers, such as sponsored posts in Threads, are not removed.
- **Hidden scrollbars.** Scrollbars are hidden everywhere; scrolling with the wheel, touchpad and keyboard still works.
- **Right-click menu.** Spelling suggestions, open or copy a link, copy an image, and undo, redo, cut, copy, paste, paste as plain text and select all.

## Teams calls

Teams microphone, camera and speaker-selection permissions are allowed automatically on official Teams HTTPS addresses. Teams audio starts unmuted unless global mute is on. Nothing joins a call or switches on your camera by itself.

Screen sharing opens a chooser for the screen or window, with an **Include system audio** option. Linux audio capture and publishing into a Teams meeting still need a full test in a real meeting.

To avoid dropping a call, Six watches only whether a call is active (a yes or no from WebRTC and live media tracks, including muted ones). It does not read, record or send call contents. Teams stays awake during calls and sharing, and for 5 idle minutes after they end.

## YouTube Music and sign-in

Six runs on [castlabs' Electron build](https://github.com/castlabs/electron-releases) (the `+wvcus` releases), which includes Widevine, so YouTube Music can play protected tracks. Widevine is only granted to YouTube's HTTPS pages for that tab, and it downloads the first time Six starts.

If music stops by itself, Six keeps a small local log in `~/.config/Six/diagnostics.log`: when a service was paused or closed for being idle, which YouTube requests were blocked, and, for YouTube Music, each pause with the state of the player and whether you, a media key or YouTube caused it. A service that played sound in the last 3 minutes is never paused for being idle, so the silent gap between songs cannot freeze it. Six also answers YouTube Music's "Continue watching?" prompt for you. The log stays on your laptop and is trimmed at 200 KB.

Google rejects sign-in from many embedded apps. On `accounts.google.com` and `accounts.youtube.com` Six presents a plain browser identity so the sign-in goes through.

## Install

Requires Linux (built and used on Ubuntu with GNOME and Wayland) and Node 22.12 or newer.

**For daily use (recommended).** This puts Six in your home folder, where it can update its own Electron:

```bash
npm install
node node_modules/electron/install.js
sudo ./setup-apparmor.sh      # one time: lets Six's Electron use Chromium's sandbox (see "Electron updates")
./install-user.sh --switch    # copies Six, Electron and the launcher, and adds or updates the app-menu entry
```

Then start Six from the app menu. Quit it from the tray first if an older copy is running, because two copies cannot share the same settings. `./install-user.sh` without `--switch` installs but leaves the menu alone, and `./install-user.sh --revert` points the menu and autostart back at a `/opt` copy.

**System-wide instead.** `install-update.sh` copies the app into `/opt/six-messenger` and keeps a small rollback copy of the previous files in a `.rollback-<date>` folder. Run it as your normal user; it asks for your password. This copy cannot update its own Electron without your password (see below).

**For development.** `npm test` runs the tests and `npm start` starts Six straight from this folder.

## Electron updates

Six runs on Electron, which is also the browser engine, so it needs regular security updates. Six checks castlabs' releases a minute after it starts, and then once a day. Only stable builds in the same major version (for example 44.x) are ever installed; a new major version is never installed automatically.

**User install (recommended): fully automatic.** Six lives in `~/.local/share/six`, which it can write to.

- A newer build is downloaded, checked against the SHA-256 that GitHub publishes for it, unpacked and test-run, all in the background with no prompt.
- It is used the next time Six starts. A notification says so, and the tray menu has **Restart Six to use Electron X** if you want it now.
- If the new Electron crashes before Six has been running for 20 seconds, the launcher puts the previous one back, starts that instead, and remembers the bad version so it is not tried again.
- The build in use and the one before it are kept; older ones are removed.

Set it up as described under **Install** above. The AppArmor rule it asks for is the same kind Ubuntu ships for Discord, Chrome and Brave: it only lets Electron under `~/.local/share/six/electron/` use user namespaces, which Chromium's sandbox needs, and restricts nothing else.

**System-wide (`/opt`) install: one click.** The root-owned copy cannot update itself. Six shows a dialog (or a notification and tray item when hidden); **Update now** asks for your password and `update-electron.sh` downloads, verifies and swaps in the build, keeping the previous one in `/opt/six-messenger/.electron-previous` (undo with `pkexec /opt/six-messenger/update-electron.sh rollback`).

To turn the check off, add `"_electronUpdateCheck":false` to `~/.config/Six/settings.json`. The check sends one request to GitHub's public API and nothing else.

## Security

- Service pages run in sandboxed renderers with context isolation and web security on, and have no Node access.
- Each service has its own stored session. Six never handles your passwords itself.
- Camera and microphone requests ask for approval (except on Teams addresses, above). Other device permissions are denied.
- Sign-in popups from trusted domains open inside Six, in a sandbox that shares the service's session. Other links open in your system browser.
- Teams and YouTube Music add small page scripts for call status and ad removal, and every service gets one for notifications. They do nothing else.

## What is where

| File | Purpose |
|---|---|
| `main.js` | App window, tray, service views, sleeping and closing, permissions |
| `policy.js` | The service list and the sleep and close rules |
| `adblock.js`, `adblock-hosts.txt` | Ad and tracker blocking |
| `notification-policy.js` | Notification, audio and popup rules, Google sign-in identity |
| `notification-preload.js`, `notification-sw-preload.js` | Auto-hide for notifications that stay on screen |
| `teams-call-preload.js`, `screen-sharing.js`, `media-policy.js` | Teams calls and screen sharing, Widevine for YouTube |
| `ytmusic-preload.js` | YouTube Music ad removal |
| `electron-update.js`, `self-update.js`, `six-launcher.sh` | Finds newer Electron builds, stages them silently, switches at start-up and rolls back on a crash |
| `install-user.sh`, `setup-apparmor.sh` | User install and its one-time AppArmor rule |
| `update-electron.sh`, `install-update.sh` | The `/opt` install: one-click Electron update, and the copy-into-`/opt` installer |
| `context-menu.js`, `content-style.js` | Right-click menu and page styling |
| `index.html`, `renderer.js`, `preload.js`, `style.css` | Six's own window: the tab bar and home screen |
| `memory.js` | Memory figures (PSS) for the home screen and the log |
| `service-views.js`, `rendering-priority.js`, `telegram-latest.js` | Showing and hiding service pages, background throttling, the Telegram **Latest** button |
| `*.test.js` | Tests, run with `npm test` |
