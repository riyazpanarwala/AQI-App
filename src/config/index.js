import { Platform } from 'react-native';
import Constants from "expo-constants";

const { waqiToken } = Constants.expoConfig.extra;

// For React Native, we need to handle environment variables differently
const AppConfig = {
    WAQI_TOKEN: waqiToken, // Replace with your actual token

    // Platform-specific configurations
    IS_IOS: Platform.OS === 'ios',
    IS_ANDROID: Platform.OS === 'android',
    IS_WEB: Platform.OS === 'web',
};


export default AppConfig;