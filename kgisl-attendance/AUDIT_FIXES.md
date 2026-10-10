# Logic audit - fixes (2026-10-10)

A full read-through of the backend, web app and Android app looked for places where the system behaves wrongly even
though nothing crashes. Everything below is fixed in the code; the checks that back each item are listed at the end.

## Things that would have hurt a real class

| # | Problem | Fix |
|---|---|---|
| 1 | **Login limit of 10 per IP per 15 min** counted login, refresh and password reset together. A college shares one public IP, so the 11th student to sign in was locked out. | Limits are now per **account** (wrong passwords only), with a high per-IP flood ceiling. Refresh has its own budget. Reset-code requests are limited per mailbox. |
| 2 | **Several browser tabs signed everyone out** ("Authentication token is invalid or expired"): two tabs refreshing at once looked like token theft, and a login as another role in a second tab replaced the first tab's token. | Server keeps a 20 s grace copy of a just-rotated refresh token. Tabs follow each other's login/logout (`storage` event) and retry with the newer token. A dropped connection no longer logs the user out. |
| 3 | Live QR / scan list **froze after 15 minutes** if the socket reconnected (it re-sent the expired token). | The socket sends the current token on every reconnect and nudges a refresh. |
| 4 | **Any logged-in student could watch the live QR** from home by joining the session room. | Only the owning faculty (or an admin) can join a session room. |
| 5 | Student logins failed for `Name@x.edu` / trailing space. | E-mail lookup is case-insensitive and trimmed (login, Google, password reset). |
| 6 | Beacon stopped after **pause -> resume**, and after a Wi-Fi blip of more than 5 s. | Beacon restarts by itself on resume and keeps retrying while the class runs. |
| 7 | After a **page reload** the beacon could pick another room's beacon (`BEACON_ROOM_MISMATCH`). | Room/section are restored from the running session. |
| 8 | Android: a phone with a wrong clock silently rejected every beacon. | The app learns the server clock from every API response and judges packets on it. |

## Wrong numbers

* Student dashboard **calculator** used made-up defaults (`attended || 16`, `total || 20`) because it read a field that does not exist. It now uses the real counts.
* Student dashboard showed a **hard-coded timetable, holidays and block tests** for everybody, and fixed "7-day streak" / always-unlocked badges. All of it now comes from the server and the student's own history.
* Auto-ended classes (`EXPIRED`) were missing from the student's attendance; a class still running counted as absent in percentages. Student view, reports, analytics and the live counter now use one rule (`utils/attendanceStatus.ts`).
* Deactivated students inflated "absent" counts and class totals.
* Approved leave: it **overwrote real attendance** with LEAVE, and did not apply to classes that happen *after* the approval. Both fixed; a student on leave who turns up can still mark present.
* Admin **could not approve** correction requests (the ownership check compared the admin's id with the session's faculty). Duplicate requests crashed with a 500; students could file them for a running class.
* "Wrong class? Cancel" **ended** the session, which left a class "held" with 100 % absentees. It now removes a session nobody has marked; re-starting the same period re-opens it instead of creating a duplicate class.
* Forgetting to end period 1 blocked period 2; it is now ended automatically once its class time is over.
* Date filters used the server's UTC day; they now mean an Indian calendar day.

## Features that were fake or unsaved

* **Academic calendar / block tests** were browser-only constants and a fake "Analyze document" button that always inserted the same sample rows. They are now stored in the database (new tables), managed by admins, and imported from a real CSV with a line-numbered preview.
* Deactivated faculty vanished from the admin list and could never be re-enabled. Deactivating a faculty/student now also ends their running class and revokes their sessions.
* Student CSV import broke on names containing commas.
* Faculty could not see weekend or odd-hour classes in "My assigned timetable". The faculty dashboard now opens on today and pre-selects the period that is open.

## Deploying

* `npx prisma migrate deploy` runs automatically at container start (`Dockerfile`). The new migration only **adds** tables and one nullable column.
* New optional settings (defaults are fine): `AUTH_IP_RATE_LIMIT_MAX=300`, `REFRESH_RATE_LIMIT_MAX=1500`, `PASSWORD_RESET_RATE_LIMIT_MAX=5`.
* Rebuild the Android APK to get the clock/password-gate fixes (the old APK still works with the new server).

## Not changed

* ESP32 firmware and the smart-board helper (no logic problem found; could not be flashed or tested here).
* Passkey / Face ID rules: one account is still bound to one device. If a student marks on the website first, the app will refuse them until a faculty member resets the device.

## Checks

* Backend: `npm test` (28 tests, including a real HTTP test that 40 students can sign in from one IP while one account is locked).
* Frontend: `npx vitest run` (31 tests), `npx tsc --noEmit`, `npx vite build`.
* Android: `./gradlew --offline :app:testDebugUnitTest`.
