// src/utils/index.js
import { Platform, Dimensions } from 'react-native';
import colors from '../colors';

const { width, height } = Dimensions.get('window');

// Convert hex to rgba
export const hexToRgba = (hex, opacity = 1) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Function to calculate distance between two coordinates
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

// Get AQI color
export const getAQIColor = (value) => {
    const num = parseInt(value) || 0;
    if (num <= 50) return colors.aqi.good;
    if (num <= 100) return colors.aqi.moderate;
    if (num <= 200) return colors.aqi.poor;
    if (num <= 300) return colors.aqi.veryPoor;
    if (num <= 400) return colors.aqi.severe;
    return colors.aqi.maroon;
};

// Get AQI level text
export const getAQILevel = (value, t) => {
    const num = parseInt(value) || 0;
    if (num <= 50) return t.good;
    if (num <= 100) return t.moderate;
    if (num <= 200) return t.poor;
    if (num <= 300) return t.veryPoor;
    return t.severe;
};

// Get health advice
export const getHealthAdvice = (aqiValue, t) => {
    const num = parseInt(aqiValue) || 0;
    if (num <= 50) return t.healthTip;
    if (num <= 100) return 'Sensitive people should limit outdoor activities';
    if (num <= 150) return 'Everyone should reduce prolonged outdoor exertion';
    if (num <= 200) return 'Avoid outdoor activities, especially for sensitive groups';
    if (num <= 300) return 'Health alert: Avoid all outdoor activities';
    return 'Emergency conditions: Remain indoors with air purifiers';
};

// Responsive dimensions
export const responsiveWidth = (percentage) => (width * percentage) / 100;
export const responsiveHeight = (percentage) => (height * percentage) / 100;

// Format date
export const formatDate = (dateString, language = 'en') => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

// Format time
export const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};