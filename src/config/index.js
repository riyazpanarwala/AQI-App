import { Platform } from 'react-native';

// For React Native, we need to handle environment variables differently
const AppConfig = {
    WAQI_TOKEN: "YOUR_API_KEY_HERE", // Replace with your actual token

    // Platform-specific configurations
    IS_IOS: Platform.OS === 'ios',
    IS_ANDROID: Platform.OS === 'android',
    IS_WEB: Platform.OS === 'web',
};


export default AppConfig;