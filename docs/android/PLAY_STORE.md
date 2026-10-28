# MONSTER MASH on Google Play: build and release checklist

Branch: `android`. App ID: `com.godspeedsamarth.monstermash` (permanent after the first upload).
The app is the same game wrapped with Capacitor. It runs offline. RUN-only features (Global Arena, Global Challenges,
online leaderboards, RUN share links, the jam Vote button) are switched off in `config.json` `targets.android`.

## 1. Build

Needs Android Studio's SDK (with Android 16 / API 36; the app targets API 36 as Play requires from 31 August
2026) and JDK 21 (`JAVA_HOME`, e.g. `C:\Program Files\Eclipse Adoptium\jdk-21.0.7.6-hotspot`).
`game/android/local.properties` (git-ignored) says where the SDK is, with forward slashes:
`sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` (a single backslash is an escape character in that file).

From `game/` on the `android` branch:

```
npm ci
npm run build:android      # checks, vite build --mode android, then copies the web build into android/
npm run apk:debug          # a test APK: android/app/build/outputs/apk/debug/app-debug.apk
npm run aab:release        # the Play Store bundle: android/app/build/outputs/bundle/release/app-release.aab
```

`aab:release` needs your upload key (step 2). Before every release, raise `versionCode` (by 1) and `versionName`
in `android/app/build.gradle`.

## 2. Your upload key (do this once, keep it safe)

Google Play signs the final app; you sign uploads with your own key. Create it yourself (it asks you for passwords;
nobody else should type them):

```
keytool -genkeypair -v -keystore monstermash-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.jks` file and both passwords somewhere safe (a password manager). If you lose them you cannot update the
app. Then create `game/android/keystore.properties` (it is git-ignored, never commit it):

```
storeFile=C:/path/to/monstermash-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

## 3. Ads (AdMob)

- App ID `ca-app-pub-3304363858852502~8464170068` is in `capacitor.config.json` and the Android manifest.
- Ad units in `config.json` `targets.android.admob`: rewarded `Coin_n_others` (extra shots, free coins, double
  coins) and interstitial `between_levels` (every 3 finished battles, never before level 4; numbers in
  `content.json` `economy.ads`).
- `testing` is `true` while you develop: the app then shows Google test ads even with your real IDs. **Never tap
  real ads on your own phone**; AdMob can ban the account for invalid traffic. Set `testing` to `false` only for the
  release build you upload.
- Audience 10+: the first launch asks the player's birth year on a neutral screen. Under 13 gets child-directed,
  "General"-rated ads; 13 and up gets "Parental Guidance"-rated ads. The EU/UK consent form (Google UMP) appears
  where required; set up the consent message in AdMob → Privacy & messaging.
- After the app is live, link it to its Play listing in AdMob (Apps → App settings) and publish an `app-ads.txt`
  file on your developer website (AdMob → Apps → app-ads.txt shows the exact line).

## 4. Play Console listing

- **App name** (store): MONSTER MASH: Slingshot Siege. (The AdMob app is named "MONSTER SMASH - Siege
  Slingshot"; that name is only a label inside AdMob, but keep the store name consistent everywhere players see it.)
- **Short description** (80 chars) and **full description** (4000 chars).
- **Icon** 512x512 PNG, **feature graphic** 1024x500, **phone screenshots** (at least 2, landscape is fine),
  optionally 7" and 10" tablet screenshots.
- **Category**: Games → Casual (or Action). **Contact email**.

## 5. Policy forms (required)

- **Privacy policy URL**: required because the app shows ads and is played by children. It must say that AdMob
  collects device identifiers for ads (non-personalised for under-13 players), that saves stay on the phone, and how
  to contact you.
- **Ads**: "Yes, my app contains ads".
- **Target audience and content**: age groups 10-12 and 13+ (13-15, 16-17, 18+). Because 10-12 is included, the
  app falls under the **Families policy**: AdMob is a Families self-certified ad network; the neutral age screen is
  the mixed-audience method Google accepts. Do not choose "appeals to children" marketing that contradicts this.
- **Content rating** questionnaire: cartoon/fantasy violence against fantasy monsters, no blood, no gambling (Arena
  coin wagers are off in this build), no user chat. Expect about PEGI 7 / ESRB Everyone 10+.
- **Data safety**: data collected by the AdMob SDK: device or other IDs (advertising), app interactions and
  diagnostics; shared with Google for advertising; encrypted in transit; users cannot delete it from inside the app
  (they can reset the advertising ID on the phone). The game itself collects nothing else (saves stay on the phone).
- **App access**: all features available without login.
- **Government apps / news / health**: no.

## 6. Release path

1. Upload `app-release.aab` to **Internal testing**, add your own email as a tester, install from the Play link and
   play through: age screen, consent form (use a VPN to an EU country to see it), a rewarded ad, an interstitial
   after 3 battles, pause and resume, the back button.
2. **Closed testing** with a few friends (new personal developer accounts must run a closed test with at least
   12 testers for 14 days before production).
3. **Production**, with a staged rollout (for example 20 percent first).

## What is not in the app (yet)

Online leaderboards, Global Challenges and the Global Arena need RUN's servers. A later version could add Google
Play Games leaderboards or our own backend; see `docs/handoff/ROADMAP_FUN_2026-10-28.md` for the friend modes that
work without servers (party mode on one phone, share-a-fort links).
