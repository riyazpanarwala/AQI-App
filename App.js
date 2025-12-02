import React, { useState, useEffect } from 'react';
import {
  Text, View, StyleSheet, ActivityIndicator, Platform, TouchableOpacity,
  Alert, Share, ScrollView, Dimensions, Modal
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import AppConfig from './src/config';

const { width } = Dimensions.get('window');

export default function App() {
  const [aqi, setAqi] = useState('-');
  const [city, setCity] = useState('Getting location...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en');
  const [detailedData, setDetailedData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  // Your free waqi.info token here
  const WAQI_TOKEN = AppConfig.WAQI_TOKEN;

  const translations = {
    hi: {
      title: 'भारत AQI लाइव',
      subtitle: 'वायु गुणवत्ता सूचकांक',
      good: 'अच्छा',
      moderate: 'मध्यम',
      poor: 'खराब',
      veryPoor: 'बहुत खराब',
      severe: 'गंभीर',
      healthTip: 'स्वास्थ्य सलाह: बाहर कम समय बिताएं।',
      refresh: 'रिफ्रेश',
      share: 'शेयर करें',
      errorLocation: 'स्थान अनुमति अस्वीकार',
      errorNetwork: 'नेटवर्क त्रुटि',
      noStation: 'निकटतम स्टेशन नहीं मिला',
      details: 'विस्तृत जानकारी',
      forecast: 'पूर्वानुमान',
      close: 'बंद करें',
      pollutants: 'प्रदूषक',
      weather: 'मौसम',
      temperature: 'तापमान',
      humidity: 'आर्द्रता',
      pressure: 'दबाव',
      wind: 'हवा की गति',
      healthAdvice: 'स्वास्थ्य सलाह',
      forecastChart: '3 दिन का पूर्वानुमान',
      dailyAvg: 'दैनिक औसत',
      max: 'अधिकतम',
      min: 'न्यूनतम',
      pm25: 'पीएम 2.5',
      pm10: 'पीएम 10',
      no2: 'नाइट्रोजन डाईऑक्साइड',
      o3: 'ओज़ोन',
      co: 'कार्बन मोनोऑक्साइड',
      so2: 'सल्फर डाईऑक्साइड'
    },
    en: {
      title: 'India AQI Live',
      subtitle: 'Air Quality Index',
      good: 'Good',
      moderate: 'Moderate',
      poor: 'Poor',
      veryPoor: 'Very Poor',
      severe: 'Severe',
      healthTip: 'Health Tip: Limit outdoor time.',
      refresh: 'Refresh',
      share: 'Share',
      errorLocation: 'Location permission denied',
      errorNetwork: 'Network error',
      noStation: 'No nearby station',
      details: 'Detailed Info',
      forecast: 'Forecast',
      close: 'Close',
      pollutants: 'Pollutants',
      weather: 'Weather',
      temperature: 'Temperature',
      humidity: 'Humidity',
      pressure: 'Pressure',
      wind: 'Wind Speed',
      healthAdvice: 'Health Advice',
      forecastChart: '3-Day Forecast',
      dailyAvg: 'Daily Avg',
      max: 'Max',
      min: 'Min',
      pm25: 'PM2.5',
      pm10: 'PM10',
      no2: 'NO₂',
      o3: 'O₃',
      co: 'CO',
      so2: 'SO₂'
    }
  };

  const t = translations[language];

  const getAQI = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`
      );
      const data = response.data;

      if (data.status === 'ok') {
        const aqiData = data.data;
        setAqi(aqiData.aqi.toString());
        setCity(aqiData.city.name);
        setDetailedData(aqiData);

        // Extract forecast data
        if (aqiData.forecast && aqiData.forecast.daily) {
          const forecast = aqiData.forecast.daily;
          setForecastData(forecast);
        }

        setError('');
      } else {
        setError(t.noStation);
        setCity('Rural area – limited data');
      }
    } catch (err) {
      setError(t.errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  const getLocationAndAQI = async () => {
    setLoading(true);
    setError('');

    let location;
    try {
      if (Platform.OS === 'web') {
        location = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      } else {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError(t.errorLocation);
          setLoading(false);
          return;
        }
        location = await Location.getCurrentPositionAsync({});
      }

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      await getAQI(lat, lon);
    } catch (err) {
      setError(t.errorLocation);
    }
  };

  useEffect(() => {
    getLocationAndAQI();
  }, []);

  const getAQIColor = (value) => {
    const num = parseInt(value);
    if (num <= 50) return '#00e400'; // Green
    if (num <= 100) return '#ffff00'; // Yellow
    if (num <= 200) return '#ff7e00'; // Orange
    if (num <= 300) return '#ff0000'; // Red
    if (num <= 400) return '#99004c'; // Purple
    return '#7e0023'; // Maroon
  };

  const getAQILevel = (value) => {
    const num = parseInt(value);
    if (num <= 50) return t.good;
    if (num <= 100) return t.moderate;
    if (num <= 200) return t.poor;
    if (num <= 300) return t.veryPoor;
    return t.severe;
  };

  const getHealthAdvice = (aqiValue) => {
    const num = parseInt(aqiValue);
    if (num <= 50) return t.healthTip;
    if (num <= 100) return 'Sensitive people should limit outdoor activities';
    if (num <= 150) return 'Everyone should reduce prolonged outdoor exertion';
    if (num <= 200) return 'Avoid outdoor activities, especially for sensitive groups';
    if (num <= 300) return 'Health alert: Avoid all outdoor activities';
    return 'Emergency conditions: Remain indoors with air purifiers';
  };

  const shareAQI = async () => {
    const message = `${t.title}: ${aqi} (${getAQILevel(aqi)}) in ${city}.\n${getHealthAdvice(aqi)}\n#AQIIndia #AirQuality`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Air Quality Index',
            text: message,
          });
        } else {
          // Fallback for browsers without Web Share API
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied to clipboard!', 'Share this message with others.');
        }
      } else {
        await Share.share({
          message: message,
          title: 'Air Quality Index',
        });
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const DetailedInfoModal = () => (
    <Modal
      visible={showDetails}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDetails(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.details}</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Text style={styles.closeButton}>{t.close}</Text>
              </TouchableOpacity>
            </View>

            {/* Pollutant Levels */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.pollutants}</Text>
              {detailedData?.iaqi && Object.entries(detailedData.iaqi).map(([key, value]) => (
                <View key={key} style={styles.pollutantRow}>
                  <Text style={styles.pollutantLabel}>{t[key] || key.toUpperCase()}:</Text>
                  <Text style={[styles.pollutantValue, { color: getAQIColor(value.v) }]}>
                    {value.v.toFixed(1)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Weather Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.weather}</Text>
              {detailedData?.iaqi?.t && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.temperature}:</Text>
                  <Text style={styles.infoValue}>{detailedData.iaqi.t.v}°C</Text>
                </View>
              )}
              {detailedData?.iaqi?.h && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.humidity}:</Text>
                  <Text style={styles.infoValue}>{detailedData.iaqi.h.v.toFixed(1)}%</Text>
                </View>
              )}
              {detailedData?.iaqi?.p && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.pressure}:</Text>
                  <Text style={styles.infoValue}>{detailedData.iaqi.p.v} hPa</Text>
                </View>
              )}
              {detailedData?.iaqi?.w && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.wind}:</Text>
                  <Text style={styles.infoValue}>{detailedData.iaqi.w.v} m/s</Text>
                </View>
              )}
            </View>

            {/* Health Advice */}
            <View style={styles.healthSection}>
              <Text style={styles.sectionTitle}>{t.healthAdvice}</Text>
              <Text style={styles.healthText}>{getHealthAdvice(aqi)}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const ForecastModal = () => (
    <Modal
      visible={showForecast}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowForecast(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.forecastChart}</Text>
            <TouchableOpacity onPress={() => setShowForecast(false)}>
              <Text style={styles.closeButton}>{t.close}</Text>
            </TouchableOpacity>
          </View>

          {forecastData?.pm25 && (
            <View>
              {/* PM2.5 Forecast Chart */}
              <LineChart
                data={{
                  labels: forecastData.pm25.slice(0, 5).map(day =>
                    new Date(day.day).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
                      weekday: 'short'
                    })
                  ),
                  datasets: [{
                    data: forecastData.pm25.slice(0, 5).map(day => day.avg)
                  }]
                }}
                width={width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 126, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                    stroke: "#ff7e00"
                  }
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
              />

              {/* PM2.5 Forecast Table */}
              <View style={styles.forecastTable}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderText}>{t.dailyAvg}</Text>
                  <Text style={styles.tableHeaderText}>{t.max}</Text>
                  <Text style={styles.tableHeaderText}>{t.min}</Text>
                </View>
                {forecastData.pm25.slice(0, 5).map((day, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.tableCell}>
                      {new Date(day.day).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </Text>
                    <Text style={[styles.tableCell, { color: getAQIColor(day.avg) }]}>
                      {day.avg}
                    </Text>
                    <Text style={styles.tableCell}>{day.max}</Text>
                    <Text style={styles.tableCell}>{day.min}</Text>
                  </View>
                ))}
              </View>

              {/* PM10 Forecast Table */}
              {forecastData?.pm10 && (
                <View style={styles.forecastTable}>
                  <Text style={styles.sectionTitle}>PM10 Forecast (μg/m³)</Text>
                  {forecastData.pm10.slice(0, 5).map((day, index) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCell}>
                        {new Date(day.day).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </Text>
                      <Text style={[styles.tableCell, { color: getAQIColor(day.avg) }]}>
                        {day.avg}
                      </Text>
                      <Text style={styles.tableCell}>{day.max}</Text>
                      <Text style={styles.tableCell}>{day.min}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Language Toggle */}
      {/*
      <TouchableOpacity style={styles.langToggle} onPress={() => setLanguage(language === 'hi' ? 'en' : 'hi')}>
        <Text style={styles.langText}>{language === 'hi' ? 'EN' : 'हिं'}</Text>
      </TouchableOpacity>
      */}

      <Text style={styles.title}>{t.title}</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#ff7e00" />
      ) : (
        <>
          <Text style={styles.city}>{city}</Text>

          <View style={[styles.aqiCircle, { backgroundColor: getAQIColor(aqi) }]}>
            <Text style={styles.aqiText}>{aqi}</Text>
          </View>

          <Text style={[styles.aqiLevel, { color: getAQIColor(aqi) }]}>
            {getAQILevel(aqi)}
          </Text>

          <Text style={styles.healthTip}>{getHealthAdvice(aqi)}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={getLocationAndAQI}>
              <Text style={styles.actionButtonText}>{t.refresh}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={shareAQI}>
              <Text style={styles.actionButtonText}>{t.share}</Text>
            </TouchableOpacity>
          </View>

          {/* Info Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: '#2196F3' }]}
              onPress={() => setShowDetails(true)}
            >
              <Text style={styles.infoButtonText}>{t.details}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => setShowForecast(true)}
            >
              <Text style={styles.infoButtonText}>{t.forecast}</Text>
            </TouchableOpacity>
          </View>

          {/* Dominant Pollutant */}
          {detailedData?.dominentpol && (
            <View style={styles.dominantContainer}>
              <Text style={styles.dominantText}>
                {language === 'hi' ? 'मुख्य प्रदूषक: ' : 'Dominant Pollutant: '}
                <Text style={{ fontWeight: 'bold' }}>
                  {detailedData.dominentpol.toUpperCase()}
                </Text>
              </Text>
            </View>
          )}
        </>
      )}

      {/* Modals */}
      <DetailedInfoModal />
      <ForecastModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  langToggle: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  langText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  city: {
    fontSize: 20,
    marginBottom: 20,
    color: '#444',
    textAlign: 'center',
    fontWeight: '600',
  },
  aqiCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  aqiText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
  },
  aqiLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  healthTip: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  error: {
    color: '#ff4444',
    marginVertical: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
  },
  actionButton: {
    backgroundColor: '#ff7e00',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 8,
    elevation: 3,
    minWidth: 120,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
    elevation: 2,
    minWidth: 100,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dominantContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dominantText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 16,
    color: '#ff7e00',
    fontWeight: '600',
    padding: 5,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  pollutantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pollutantLabel: {
    fontSize: 14,
    color: '#666',
    flex: 2,
  },
  pollutantValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  healthSection: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  healthText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  forecastTable: {
    marginTop: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
    marginBottom: 10,
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    textAlign: 'center',
  },
});