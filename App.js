import React, { useState, useEffect, useRef } from 'react';
import {
  Text, View, ActivityIndicator, Platform, TouchableOpacity,
  Alert, Share, ScrollView, Dimensions, Modal, FlatList, TextInput,
  RefreshControl
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppConfig from './src/config';
import styles from './src/styles';
import translations from './src/translations';
import colors from './src/colors';
import {
  calculateDistance,
  getAQIColor,
  getAQILevel,
  getHealthAdvice,
  hexToRgba
} from './src/utils';

const { width } = Dimensions.get('window');

export default function App() {
  const hasMounted = useRef(false);
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
  const [displayedLocation, setDisplayedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Saved Locations states
  const [savedLocations, setSavedLocations] = useState([]);
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  const [isCurrentSaved, setIsCurrentSaved] = useState(false);

  const t = translations[language];

  const loadSavedLocationFromStorage = async () => {
    try {
      const locationsData = await AsyncStorage.getItem('aqi_locations');
      if (locationsData) {
        try {
          const parsed = JSON.parse(locationsData);
          if (Array.isArray(parsed)) {
            setSavedLocations(parsed);
          }
        } catch (parseError) {
          console.error('Error parsing locations data:', parseError);
          // Optionally clear corrupted data
          await AsyncStorage.removeItem('aqi_locations');
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  // Save Locations to storage whenever they change
  useEffect(() => {
    const saveLocationsToStorage = async () => {
      try {
        await AsyncStorage.setItem('aqi_locations', JSON.stringify(savedLocations));
      } catch (error) {
        console.error('Error saving locations:', error);
      }
    };

    if (hasMounted.current) {
      saveLocationsToStorage();
    } else {
      hasMounted.current = true;
    }
  }, [savedLocations]);

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
        setDisplayedLocation({ lat, lon });

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
    setSearchQuery('');

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

  const restoreMyLocation = async () => {
    if (!userLocation) return;
    const { lat, lon } = userLocation;
    setLoading(true);
    setSearchQuery('');
    // re-fetch AQI for saved coordinates
    await getAQI(lat, lon);
  };

  const searchByCity = async () => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      Alert.alert('Enter a city', 'Please type a city name to search.');
      return;
    }

    setSearchLoading(true);
    setError('');

    try {
      // Use WAQI search endpoint
      const url = AppConfig.buildApiUrl('/search/', { keyword: searchQuery });
      const resp = await axios.get(url);

      if (resp.data && resp.data.status === 'ok' && Array.isArray(resp.data.data) && resp.data.data.length > 0) {
        // Pick the first match and fetch its feed
        const first = resp.data.data[0];
        // If uid available, fetch full feed
        if (first.uid) {
          const feedUrl = AppConfig.buildApiUrl(`/feed/@${first.uid}`);
          const feedResp = await axios.get(feedUrl);
          if (feedResp.data && feedResp.data.status === 'ok') {
            const aqiData = feedResp.data.data;
            setAqi(String(aqiData.aqi ?? '-'));
            setCity(aqiData.city?.name || first.station?.name || searchQuery);
            setDetailedData(aqiData);
            // attempt to set forecast if present
            if (aqiData.forecast && aqiData.forecast.daily) setForecastData(aqiData.forecast.daily);
            // optionally fetch nearby for that location
            if (aqiData.city && aqiData.city.geo && Array.isArray(aqiData.city.geo) && aqiData.city.geo.length >= 2) {
              const [lat, lon] = aqiData.city.geo;
              setDisplayedLocation({ lat, lon });
              getNearbyStations(lat, lon);
            }
            setError('');
            setSearchQuery('');
          } else {
            setError(t.errorNetwork);
          }
        } else {
          // Fallback: use the search result aqi and station name
          setAqi(String(first.aqi ?? '-'));
          const cityName = first.station?.name || searchQuery;
          setCity(cityName);
          setDetailedData(null);
          setNearbyStations([]);
        }
      } else {
        setError(t.noStation);
        setCity(searchQuery);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(t.errorNetwork);
    } finally {
      setSearchLoading(false);
    }
  };

  const saveLocation = () => {
    if (!city || !displayedLocation || !displayedLocation.lat || !displayedLocation.lon) {
      Alert.alert('Cannot add to locations', 'Location data is not available.');
      return;
    }

    const newLocation = {
      id: Date.now().toString(),
      city,
      aqi,
      lat: displayedLocation.lat,
      lon: displayedLocation.lon,
      timestamp: new Date().toISOString(),
      level: getAQILevel(aqi, t)
    };

    setSavedLocations(prev => {
      // Check if already exists
      const exists = prev.some(loc => loc.city === city);
      if (exists) {
        Alert.alert('Already in saved locations', `${city} is already in your locations.`);
        return prev;
      }

      Alert.alert('Added to saved locations', `${city} has been added to your locations.`);
      setIsCurrentSaved(true);
      return [newLocation, ...prev];
    });
  };

  const removeSavedLocation = () => {
    setSavedLocations(prev => prev.filter(fav => fav.city !== city));
    setIsCurrentSaved(false);
    Alert.alert('Removed', `${city} removed from saved locations.`);
  };

  const loadSavedLocation = async (favorite) => {
    setShowSavedLocations(false);
    setSearchQuery('');
    setLoading(true);
    setAqi('-');
    setDetailedData(null);
    setNearbyStations([]);
    await getAQI(favorite.lat, favorite.lon);
  };

  const removeSavedLocationItem = (locationId) => {
    setSavedLocations(prev => prev.filter(loc => loc.id !== locationId));
  };

  useEffect(() => {
    // Check if current city is in locations
    const isExist = savedLocations.some(loc => loc.city === city);
    setIsCurrentSaved(isExist);
  }, [savedLocations, city]);

  useEffect(() => {
    loadSavedLocationFromStorage();
    getLocationAndAQI();
  }, []);

  const shareAQI = async () => {
    const message = `${t.title}: ${aqi} (${getAQILevel(aqi, t)}) in ${city}.\n${getHealthAdvice(aqi, t)}\n#AQIIndia #AirQuality`;

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

  const SavedLocationsModal = () => (
    <Modal
      visible={showSavedLocations}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSavedLocations(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>&#x1F4CC; My Saved Locations ({savedLocations.length})</Text>
            <TouchableOpacity onPress={() => setShowSavedLocations(false)}>
              <Text style={styles.closeButton}>{t.close}</Text>
            </TouchableOpacity>
          </View>

          {savedLocations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No saved locations yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the heart icon to save cities to track
              </Text>
            </View>
          ) : (
            <FlatList
              data={savedLocations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.savedLocationsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.savedLocationItem}
                  onPress={() => loadSavedLocation(item)}
                >
                  <View style={styles.savedLocationContent}>
                    <Text style={styles.savedLocationCity}>{item.city}</Text>
                    <View style={styles.savedLocationDetails}>
                      <View style={[
                        styles.savedLocationAqiBadge,
                        { backgroundColor: getAQIColor(item.aqi) }
                      ]}>
                        <Text style={styles.savedLocationAqiText}>AQI: {item.aqi}</Text>
                      </View>
                      <Text style={styles.savedLocationLevel}>{item.level}</Text>
                    </View>
                    <Text style={styles.savedLocationTime}>
                      Saved: {new Date(item.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeSavedLocationButton}
                    onPress={() => removeSavedLocationItem(item.id)}
                  >
                    <Text style={styles.removeSavedLocationText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const DetailedInfoModal = () => (
    <Modal
      visible={showDetails}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDetails(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.details}</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Text style={styles.closeButton}>{t.close}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
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
              <Text style={styles.healthText}>{getHealthAdvice(aqi, t)}</Text>
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
          <ScrollView>
            {forecastData?.pm25 && (
              <View>
                {/* PM2.5 Forecast Chart */}
                <LineChart
                  data={{
                    labels: forecastData.pm25.slice(0, 7).map(day =>
                      new Date(day.day).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
                        month: 'short',
                        day: 'numeric'
                      })
                    ),
                    datasets: [{
                      data: forecastData.pm25.slice(0, 7).map(day => day.avg)
                    }]
                  }}
                  width={width - 60}
                  height={220}
                  chartConfig={{
                    backgroundColor: colors.white,
                    backgroundGradientFrom: colors.white,
                    backgroundGradientTo: colors.white,
                    decimalPlaces: 0,
                    color: (opacity = 1) => hexToRgba(colors.primary, opacity),
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16
                    },
                    propsForDots: {
                      r: "6",
                      strokeWidth: "2",
                      stroke: colors.primary
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
                  <Text style={styles.sectionTitle}>PM2.5 Forecast</Text>
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
                    <View style={styles.tableHeader}>
                      <Text style={styles.tableHeaderText}>{t.dailyAvg}</Text>
                      <Text style={styles.tableHeaderText}>{t.max}</Text>
                      <Text style={styles.tableHeaderText}>{t.min}</Text>
                    </View>
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
          </ScrollView>
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
              <Text style={styles.currentAQILevel}>{getAQILevel(aqi, t)}</Text>
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
                        &#x1F4CD; {item.distance} {t.distanceKm} away
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stationAQISection}>
                    <View style={[styles.aqiBadge, { backgroundColor: getAQIColor(item.aqi) }]}>
                      <Text style={styles.aqiValue}>{item.aqi}</Text>
                    </View>
                    <Text style={styles.aqiLevelText}>{getAQILevel(item.aqi, t)}</Text>
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                if (displayedLocation) {
                  await getAQI(displayedLocation.lat, displayedLocation.lon);
                } else {
                  await getLocationAndAQI();
                }
                setRefreshing(false);
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Language Toggle */}
            {/*
            <TouchableOpacity style={styles.langToggle} onPress={() => setLanguage(language === 'hi' ? 'en' : 'hi')}>
              <Text style={styles.langText}>{language === 'hi' ? 'EN' : 'हिं'}</Text>
            </TouchableOpacity>
            */}

            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.subtitle}>{t.subtitle}</Text>

            {/* Search by city */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={t.enterCityname}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={searchByCity}
                editable={!loading}
                accessible
                accessibilityLabel="city-search-input"
              />
              <TouchableOpacity
                disabled={searchLoading || loading}
                style={[styles.actionButton, (searchLoading || loading) && { opacity: 0.5 }]}
                onPress={searchByCity}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>{t.search}</Text>
                )}
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <View style={styles.cityHeader}>
                  <Text style={styles.city}>{city}</Text>
                  <TouchableOpacity
                    style={styles.locationsButton}
                    onPress={isCurrentSaved ? removeSavedLocation : saveLocation}
                    accessibilityLabel={isCurrentSaved ? 'Remove from saved locations' : 'Save location'}
                    accessibilityRole="button"
                  >
                    <Text style={styles.locationIcon}>
                      {isCurrentSaved ? '\u2764\uFE0F' : '\u{1F90D}'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.aqiCircle, { backgroundColor: getAQIColor(aqi) }]}>
                  <Text style={styles.aqiText}>{aqi}</Text>
                </View>

                <Text style={[styles.aqiLevel, { color: getAQIColor(aqi) }]}>
                  {getAQILevel(aqi, t)}
                </Text>

                <Text style={styles.healthTip}>{getHealthAdvice(aqi, t)}</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, loading && { opacity: 0.5 }]}
                    onPress={getLocationAndAQI}>
                    <Text style={styles.actionButtonText}>{t.refresh}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, loading && { opacity: 0.5 }]}
                    onPress={shareAQI}>
                    <Text style={styles.actionButtonText}>{t.share}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, loading && { opacity: 0.5 }]}
                    onPress={restoreMyLocation}
                    disabled={!userLocation}
                  >
                    <Text style={styles.actionButtonText}>{t.myLocation}</Text>
                  </TouchableOpacity>
                </View>

                {/* Info Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    disabled={!detailedData}
                    style={[styles.infoButton, { backgroundColor: colors.secondary }]}
                    onPress={() => setShowDetails(true)}
                  >
                    <Text style={styles.infoButtonText}>{t.details}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!forecastData}
                    style={[styles.infoButton, { backgroundColor: colors.success }]}
                    onPress={() => setShowForecast(true)}
                  >
                    <Text style={styles.infoButtonText}>{t.forecast}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.infoButton, { backgroundColor: colors.info }]}
                    onPress={() => setShowNearby(true)}
                    disabled={nearbyStations.length === 0}
                  >
                    <Text style={styles.infoButtonText}>
                      {t.nearby} ({nearbyStations.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.infoButton, { backgroundColor: colors.warning }]}
                    onPress={() => setShowSavedLocations(true)}
                  >
                    <Text style={styles.infoButtonText}>
                      ⭐ ({savedLocations.length})
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

                {/* Scrollable Stations Preview */}
                {nearbyStations.length > 0 && (
                  <View style={styles.stationsPreviewContainer}>
                    <View style={styles.stationsPreviewHeader}>
                      <Text style={styles.stationsPreviewTitle}>
                        {nearbyStations.length} {t.nearby} {t.found}
                      </Text>
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => setShowNearby(true)}
                      >
                        <Text style={styles.viewAllText}>{t.viewAll}</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={Platform.OS === 'web'}
                      style={styles.stationsHorizontalScroll}
                      contentContainerStyle={styles.stationsScrollContent}
                    >
                      {nearbyStations.map((station, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.stationPreviewCard}
                          onPress={() => {
                            Alert.alert(
                              station.station.name,
                              `AQI: ${station.aqi}\n${t.stationDistance}: ${station.distance} ${t.distanceKm}\n${t.lastUpdated}: Recent`
                            );
                          }}
                        >
                          <View style={styles.stationCardHeader}>
                            <View style={styles.stationNumberBadge}>
                              <Text style={styles.stationNumberText}>{index + 1}</Text>
                            </View>
                            <View style={[styles.aqiIndicator, { backgroundColor: getAQIColor(station.aqi) }]} />
                          </View>

                          <Text style={styles.stationNamePreview} numberOfLines={2}>
                            {station.station.name}
                          </Text>

                          <View style={styles.stationInfoPreview}>
                            <Text style={styles.stationDistancePreview}>
                              {station.distance} {t.distanceKm}
                            </Text>
                            <View style={[styles.aqiBadgePreview, { backgroundColor: getAQIColor(station.aqi) }]}>
                              <Text style={styles.aqiValuePreview}>{station.aqi}</Text>
                            </View>
                          </View>

                          <Text style={styles.stationLevelPreview}>
                            {getAQILevel(station.aqi, t)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* All Modals */}
        <SavedLocationsModal />
        <NearbyStationsModal />
        <DetailedInfoModal />
        <ForecastModal />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}