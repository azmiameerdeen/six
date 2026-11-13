# Six
A small Ubuntu desktop home for Discord, WhatsApp, Threads, Teams, Telegram, and YouTube Music.

## Resource behavior
- Loads all six services at startup in staggered intervals, including when starting in the tray.
- Services use separate persistent sessions and compact tabs across the top.
- Switching services preserves the existing page; no two-service limit.
- WhatsApp and Telegram never hibernate.
- Pauses inactive pages after 5 minutes, preserving the renderer, page state, and drafts for fast resume. This retains more memory than closing the page; the main saving is reduced background CPU work.
- Services paused for a further 30 minutes are closed to return their memory; they reload (with saved login) when opened again. WhatsApp, Telegram, pinned services, open sign-in popups, calls and audio are never closed.
- Each service's HTTP disk cache is capped at 256 MB.
- A crashed always-awake, pinned or open service restarts automatically (up to 3 times in 10 minutes).
- Keep awake opts a service out of sleeping, for notifications and calls.
- Services playing audio are not put to sleep.
- Closing the window keeps Six in the tray. Choose Quit Six to exit fully.
- The memory figure sums Electron process working sets. Shared memory can be counted more than once; it is an estimate, not a guaranteed system footprint.

Sleeping services cannot deliver notifications. Pin services before making calls: silent calls and screen sharing may not register as audio playback. Voice/video, screen sharing, sign-in providers, and unread behavior depend on each service; account-based validation is still required. Teams screen/window sharing opens a source chooser. The confirmation offers Include system audio. Linux output capture and Teams publishing still need an end-to-end meeting test.

## Security
Remote service pages use sandboxed renderers, context isolation, web security, and no Node access. Each service has its own stored session. Desktop notifications can be disabled per service or paused globally from the tray; microphone/camera requests ask for approval; other device permissions are denied. Supported authentication domains may open a secure popup. Other HTTP(S) popup links open in the system browser. No credentials are handled by Six itself.

## Development
Use Node 22.12 or newer. Run `npm install`, `node node_modules/electron/install.js`, `npm test`, then `npm start`.
Source and installed application are separate. Keep source for further development.

## Notification and sound controls
With a service open, use Alerts on/off to enable or disable its desktop notifications, and Sound on/Muted to control all audio from it, including call audio. The tray menu offers Pause all notifications and Mute all audio. Settings persist across restarts. Global settings override individual ones. Sleeping services do not deliver notifications. Authentication popups share the service session and remain sandboxed; a service does not hibernate while its authentication popup remains open.

Teams microphone, camera, and speaker-selection permissions are allowed automatically on official Teams HTTPS origins. Teams audio starts unmuted unless global mute is enabled or you subsequently mute it. Device access is allowed when Teams requests it; this does not automatically join calls or switch on your camera in a meeting. Other services retain their existing prompts.

Teams call protection monitors only boolean WebRTC and live media-track activity, including muted tracks. It does not read, record, or transmit call contents. Teams stays awake during calls or sharing and waits five idle minutes after activity ends. If the activity monitor is unavailable, Teams stays awake as a precaution. 

## YouTube Music
Six runs on castlabs' Electron build (`44.9.3+wvcus`), which includes Widevine for YouTube Music tracks that need protected playback. Widevine is only granted to YouTube's HTTPS pages. Sign in with your Google account in the tab; Google sign-in popups stay inside Six. YouTube Music pauses after 5 idle minutes like other services, but never while music is playing.

## Scrollbars and ad blocking
Scrollbars are hidden in every service and in Six itself; scrolling with the wheel, touchpad and keyboard still works.
Requests to known ad and tracking servers are blocked using Peter Lowe's list (bundled as `adblock-hosts.txt`, ~3,500 hosts). Pages you open are never blocked, only what they load. Toggle it from the tray menu with **Block ads and trackers**; when off, no request passes through Six's filter at all. This is network blocking only: ads a site serves from its own servers (for example sponsored posts in Threads or YouTube's own video and audio ads) are not removed.
Hosts blocked for each service are recorded in `~/.config/Six/adblock-blocked.txt`; if a page breaks, check there and remove the host from `adblock-hosts.txt`.

## Right-click menu
Service pages have a right-click menu: spelling suggestions, open/copy link, copy image, and undo/redo, cut, copy, paste, paste as plain text and select all. Ctrl+C / Ctrl+V / Ctrl+A keep working as usual.

## Hardware video
Six asks Chromium to decode and encode video on the GPU through VA-API (needs `intel-media-va-driver` on Intel). If calls or videos show glitches or black frames, add `"_hardwareVideo":false` to `~/.config/Six/settings.json` and restart Six.
