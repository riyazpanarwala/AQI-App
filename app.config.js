import 'dotenv/config';

export default ({ config }) => ({
  ...config,

  name: "aqi-app",
  slug: "aqi-app",
  version: "1.0.0",

  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,

  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },

  ios: {
    supportsTablet: true,
  },

  android: {
    package: "com.riyazpanarwala.aqiapp",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
  },

  web: {
    favicon: "./assets/favicon.png",
  },

  extra: {
    waqiToken: process.env.WAQI_TOKEN,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },

  cli: {
    appVersionSource: "remote",
  }
});
