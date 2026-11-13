# Nurse Field Mobile Application (`@healthcare-system/nurse-app`)

React Native `0.74.1` mobile application for CareNest home care nurses:
- 3-zone React Navigation architecture (`Auth`, `Onboarding / Pending / Locked`, `Active Tabs + Shift Flow`)
- Pre-visit clinical briefing and patient address view (US-HP-18)
- On-site geofenced check-in (`<= 200m` Haversine, Android `mocked` GPS block, live-only VisionCamera capture)
- Mandatory initial clinical assessment, vital signs, care checklist, invalid prescription rejection, extension approval, check-out report, and zero-latency SOS `115`

## Quick Start

From repository root:

```powershell
npm install
npm run build --workspace=packages/shared
npm run start --workspace=apps/nurse-app -- --reset-cache
```

In a second terminal:

```powershell
npm run android --workspace=apps/nurse-app
```

For full Android Studio SDK, JDK, AVD (API 26 / API 34), physical device USB debugging, and manual hardware verification instructions, see [`docs/development/nurse-app-android-testing.md`](../../docs/development/nurse-app-android-testing.md).
