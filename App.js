import React, { useState, useEffect } from 'react';
import {
  Text, View, StyleSheet, ActivityIndicator, Platform, TouchableOpacity,
  Alert, Share, ScrollView, Dimensions, Modal, FlatList, Image
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import AppConfig from './src/config';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [aqi, setAqi] = useState('-');
  const [city, setCity] = useState('Getting location...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('en');
  const [detailedData, setDetailedData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

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
      nearby: 'नजदीकी स्टेशन',
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
      so2: 'सल्फर डाईऑक्साइड',
      stationName: 'स्टेशन नाम',
      stationDistance: 'दूरी',
      stationAQI: 'AQI स्तर',
      loadingStations: 'स्टेशन लोड हो रहे हैं...',
      noNearbyStations: 'कोई नजदीकी स्टेशन नहीं मिला',
      stationList: 'नजदीकी वायु गुणवत्ता स्टेशन',
      back: 'वापस',
      distanceKm: 'किमी',
      airQuality: 'वायु गुणवत्ता',
      lastUpdated: 'अंतिम अपडेट'
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
      nearby: 'Nearby Stations',
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
      so2: 'SO₂',
      stationName: 'Station Name',
      stationDistance: 'Distance',
      stationAQI: 'AQI Level',
      loadingStations: 'Loading stations...',
      noNearbyStations: 'No nearby stations found',
      stationList: 'Nearby Air Quality Stations',
      back: 'Back',
      distanceKm: 'km',
      airQuality: 'Air Quality',
      lastUpdated: 'Last Updated'
    }
  };

  const t = translations[language];

  // Function to calculate distance between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
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

  // Function to get nearby stations
  const getNearbyStations = async (lat, lon) => {
    try {
      const url = AppConfig.buildNearbyStationsUrl(lat, lon, 50); // 50km radius
      const response = await axios.get(url);

      if (response.data.status === 'ok') {
        // Filter and sort stations
        let stations = response.data.data
          .filter(station => station.aqi !== '-' && station.aqi !== undefined)
          .map(station => {
            const distance = calculateDistance(lat, lon, station.lat, station.lon);
            return {
              ...station,
              distance: parseFloat(distance.toFixed(1)),
              station: station.station || { name: 'Unknown Station' }
            };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 20); // Limit to 20 nearest stations

        setNearbyStations(stations);
      } else {
        setNearbyStations([]);
      }
    } catch (err) {
      console.error('Error fetching nearby stations:', err);
      setNearbyStations([]);
    }
  };

  const getAQI = async (lat, lon) => {
    try {
      const apiUrl = AppConfig.buildApiUrl(`/feed/geo:${lat};${lon}`);
      const response = await axios.get(apiUrl);
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

        // Get nearby stations
        await getNearbyStations(lat, lon);

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
    setNearbyStations([]);

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
      setUserLocation({ lat, lon });
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

  // Nearby Stations Component
  const NearbyStationsModal = () => (
    <Modal
      visible={showNearby}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowNearby(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.stationList}</Text>
            <TouchableOpacity onPress={() => setShowNearby(false)}>
              <Text style={styles.closeButton}>{t.close}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.currentLocationCard}>
            <Text style={styles.currentLocationTitle}>{t.airQuality} - {city}</Text>
            <View style={[styles.currentAQIBadge, { backgroundColor: getAQIColor(aqi) }]}>
              <Text style={styles.currentAQIText}>AQI: {aqi}</Text>
              <Text style={styles.currentAQILevel}>{getAQILevel(aqi)}</Text>
            </View>
          </View>

          {nearbyStations.length === 0 ? (
            <View style={styles.noStationsContainer}>
              <Text style={styles.noStationsText}>{t.noNearbyStations}</Text>
            </View>
          ) : (
            <FlatList
              data={nearbyStations}
              keyExtractor={(item, index) => index.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.stationsList}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.stationCard}
                  onPress={() => {
                    // You can implement station details here
                    Alert.alert(
                      item.station.name,
                      `AQI: ${item.aqi}\n${t.stationDistance}: ${item.distance} ${t.distanceKm}\n${t.lastUpdated}: Recent`
                    );
                  }}
                >
                  <View style={styles.stationHeader}>
                    <View style={styles.stationIndex}>
                      <Text style={styles.stationIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stationInfo}>
                      <Text style={styles.stationName} numberOfLines={2}>
                        {item.station.name}
                      </Text>
                      <Text style={styles.stationDistance}>
                        📍 {item.distance} {t.distanceKm} away
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stationAQISection}>
                    <View style={[styles.aqiBadge, { backgroundColor: getAQIColor(item.aqi) }]}>
                      <Text style={styles.aqiValue}>{item.aqi}</Text>
                    </View>
                    <Text style={styles.aqiLevelText}>{getAQILevel(item.aqi)}</Text>
                  </View>

                  <View style={styles.stationFooter}>
                    <Text style={styles.stationCoordinates}>
                      Lat: {item.lat.toFixed(4)}, Lon: {item.lon.toFixed(4)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListHeaderComponent={() => (
                <Text style={styles.stationsCount}>
                  {nearbyStations.length} {t.nearby.toLowerCase()} {t.found}
                </Text>
              )}
            />
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowNearby(false)}
          >
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );


  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      showsHorizontalScrollIndicator={false}>
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

              <TouchableOpacity
                style={[styles.infoButton, { backgroundColor: '#9C27B0' }]}
                onPress={() => setShowNearby(true)}
                disabled={nearbyStations.length === 0}
              >
                <Text style={styles.infoButtonText}>
                  {t.nearby} ({nearbyStations.length})
                </Text>
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

            {/* Quick Stations Preview */}
            {nearbyStations.length > 0 && (
              <TouchableOpacity
                style={styles.stationsPreview}
                onPress={() => setShowNearby(true)}
              >
                <Text style={styles.stationsPreviewTitle}>
                  {nearbyStations.length} {t.nearby} {t.found}
                </Text>
                <View style={styles.previewStations}>
                  {nearbyStations.map((station, index) => (
                    <View key={index} style={styles.previewStation}>
                      <View style={[styles.previewDot, { backgroundColor: getAQIColor(station.aqi) }]} />
                      <Text style={styles.previewText} numberOfLines={1}>
                        {station.station.name}
                      </Text>
                      <Text style={styles.previewAQI}>{station.aqi}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Modals */}
        <NearbyStationsModal />
        <DetailedInfoModal />
        <ForecastModal />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40, // Add padding at bottom
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  envBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#ff4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1000,
  },
  envBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
    flexWrap: 'wrap',
  },
  actionButton: {
    backgroundColor: '#ff7e00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    margin: 5,
    elevation: 3,
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 5,
    elevation: 2,
    minWidth: 90,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  // Stations Preview
  stationsPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stationsPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  previewStations: {
    marginTop: 5,
  },
  previewStation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  previewAQI: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
    minWidth: 30,
    textAlign: 'right',
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
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 18,
    color: '#ff7e00',
    fontWeight: 'bold',
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
  // Current Location Card in Modal
  currentLocationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  currentAQIBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    minWidth: 150,
    justifyContent: 'center',
  },
  currentAQIText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  currentAQILevel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Stations List
  stationsList: {
    paddingBottom: 20,
  },
  stationsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stationIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stationIndexText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stationDistance: {
    fontSize: 12,
    color: '#666',
  },
  stationAQISection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aqiBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  aqiValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  aqiLevelText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  stationFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    paddingTop: 10,
  },
  stationCoordinates: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  noStationsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noStationsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});