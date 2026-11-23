# __TITLE__ — on a phone

The same app as the website, drawn **natively** on Android and iOS: every form
added to the menu in Configure UI, its list, add and edit, its buttons, and the
journeys designed in Configure UI → Flows. Nothing here is a screen — the
screens are read from the server and drawn by `@xeplr/ui-factory/native`, and
signing in is `@xeplr/ui-account/native`'s, the same as the website's.

So **design in the browser, use it on the phone**: add a form to the menu in
Configure UI and it is on the phone too, with no change here and no new build.
Designing (Configure UI) and the admin screens stay on a computer.

## Try it on your phone (Expo Go)

1. Install **Expo Go** on the phone (Play Store / App Store).
2. Start the app's services as usual, and let the website be reached from the
   phone — same Wi-Fi as this computer:
   ```bash
   cd ../api && npm run start-auth
   cd ../api && npm run start-api
   cd ../ui  && npm run dev -- --host       # --host: the phone can reach it
   ```
3. Start the phone app and scan the QR code it prints with the phone's camera
   (Android: from Expo Go):
   ```bash
   npm install          # once
   npm start
   ```
4. Sign in. The server address starts as this computer's own
   (`http://<this computer>:__UI_PORT__`).

`npm run web` opens the same app in a browser — handy for a quick look.

## An installable app (APK)

1. In `eas.json`, set `EXPO_PUBLIC_SERVER_URL` to the app's real address
   (`https://rentals.example.com`) — a build made for one server asks for no
   address at all.
2. In `app.json`, give it an id of your own instead of `__APP_ID__`
   (`android.package`, `ios.bundleIdentifier`).
3. `npm run build:apk` — built by Expo's servers (an Expo account, free); it
   prints a link to the APK.

## What is on the phone

| | |
|---|---|
| **The menu** | every form added to the menu in Configure UI, in its order and under its names, and **Journeys** — only what this person's roles allow (from the server, read again when the app opens) |
| **A form's list** | its records as cards, with search, filter chips, KPI cards and a date range when the list has them; a tap opens one, **+ New** adds one |
| **A record** | its form, one field under another; Save and Cancel; its buttons (with their ask-first questions) |
| **Pictures and files** | the camera or the gallery; documents from the phone's files |
| **Dates** | the phone's own date picker |
| **Journeys** | Start, then each screen with **Next**, as on the website |

Every control a form can hold is on the phone — a `table` as a card per row
with a tick, a `subform` drawn inside its form. When the app's data is split by
company, the first page after signing in is choosing it (and the workspace),
as on the website; **Switch company** is on the menu. Designing (Configure UI)
and the admin screens are for a computer.

## Layout

```
mobile/
├─ app.json, eas.json      the app's name and id; the server a build is for
├─ metro.config.js         react-router-dom → ui-factory's stand-in (a phone has no URL)
└─ src/
   ├─ lib/app.js           the app's name, the server, the calls every page makes
   └─ app/                 the pages (expo-router): sign-in, the menu,
                           forms/<form>, forms/<form>/<id>, flows, journey/<flow>
```
