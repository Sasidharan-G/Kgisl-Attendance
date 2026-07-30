# Play Store release checklist

Before uploading an Android App Bundle, complete each item with the college data owner.

- Host the in-app `/privacy` policy at a public HTTPS URL; put that exact URL in Play Console.
- Complete Data Safety with: account identifiers, precise location, device identifiers, camera and microphone access, plus attendance records. State collection is for attendance/security and not advertising.
- Do not request `ACCESS_BACKGROUND_LOCATION`; camera, microphone and location must be requested only after a student action.
- Set a real support/privacy email and document the institution's data-retention period and deletion-contact process.
- Run an internal test on physical Android phones for QR, acoustic, location denial, device reset, leave, correction and logout.
- Upload only a signed AAB, set content rating, provide store listing screenshots, and declare the demo/test account path required by Play review.

## Parent portal and SMS/WhatsApp

Do not enable these until the college approves guardian consent, guardian identity verification, opt-in/opt-out rules, and an approved sender/provider account. A parent portal must be read-only and reveal only the linked student's attendance. SMS/WhatsApp notification credentials must be stored only as deployment secrets, never in this repository or the mobile app.
