import { Platform } from 'react-native';
import Constants from "expo-constants";

const { waqiToken } = Constants.expoConfig.extra;

const API_BASE_URL = 'https://api.waqi.info';

// For React Native, we need to handle environment variables differently
const AppConfig = {
    API_BASE_URL: API_BASE_URL,
    WAQI_TOKEN: waqiToken, // Replace with your actual token

    // Platform-specific configurations
    IS_IOS: Platform.OS === 'ios',
    IS_ANDROID: Platform.OS === 'android',
    IS_WEB: Platform.OS === 'web',

    // Build API URLs
    buildApiUrl: (endpoint, params = {}) => {
        let url = `${API_BASE_URL}${endpoint}?token=${waqiToken}`;

        Object.keys(params).forEach((key, index) => {
            if (params[key] !== undefined && params[key] !== null) {
                url += `&${key}=${encodeURIComponent(params[key])}`;
            }
        });

        return url;
    },

    // Build map bounds URL for nearby stations
    buildNearbyStationsUrl: (lat, lon, radiusKm = 50) => {
        // Calculate bounding box (approximate)
        const degreePerKm = 0.009; // Roughly 1km in degrees
        const delta = radiusKm * degreePerKm;

        const lat1 = lat - delta;
        const lon1 = lon - delta;
        const lat2 = lat + delta;
        const lon2 = lon + delta;

        return AppConfig.buildApiUrl('/map/bounds/', {
            latlng: `${lat1},${lon1},${lat2},${lon2}`
        });
    }
};


export default AppConfig;