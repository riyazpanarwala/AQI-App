# AQI India Live – Real-Time Air Quality App

**Breathe better. Know your air. Instantly.**

A beautiful, lightning-fast, completely **free & open-source** Air Quality app specially built for India — works even in villages.

Live • Accurate • Made in India

### Features

- Real-time AQI from **500+ monitoring stations** (best rural coverage via waqi.info)
- Works in remote villages — shows nearest station with distance
- Current location with blue dot
- Color-coded AQI circle + health advice
- Nearest 20 stations with distance
- 7-day AQI forecast (PM2.5 & PM10)
- Full pollutant breakdown: PM2.5, PM10, NO₂, CO, O₃, SO₂
- Weather: temperature, humidity, wind, pressure
- Save unlimited favorite cities (heart)
- Pull-to-refresh anywhere
- Share via WhatsApp, Telegram, etc.
- Hindi + English support
- Works as **Android, iOS & Web App** from single codebase
- Zero ads • Zero tracking • Zero login

### How to Run Locally (5 Minutes)

```bash
git clone https://github.com/riyazpanarwala/AQI-App.git
cd aqi-india-live
npm install
npx expo start
npm run web (To run in web)
```

### Techstacks
- React Native + Expo (EAS Build)
- waqi.info API (free)
- AsyncStorage for saved locations
- React Native Chart Kit