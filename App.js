import React, { useState, useEffect } from 'react';
import {
  Text, View, ActivityIndicator, Platform, TouchableOpacity,
  Alert, Share, ScrollView, Dimensions, Modal, FlatList
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import AppConfig from './src/config';
import styles from './src/styles';
import translations from './src/translations';

const { width } = Dimensions.get('window');

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

// styles moved to `src/styles.js`