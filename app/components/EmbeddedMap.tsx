import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import MapView, {
  PROVIDER_GOOGLE,
  Region,
  Circle,
  Marker,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import useLocationStore from "../store/locationStore";
import useGeofenceStore from "../store/geofenceStore";
import { Geofence, Location as LocationType } from "../types/liveTracking";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface EmbeddedMapProps {
  size?: { width: number; height: number };
  currentLocation?: LocationType | null;
  geofences?: Geofence[];
  onLocationUpdate?: (location: LocationType) => void;
  onGeofenceStatusChange?: (isInside: boolean, geofenceName?: string) => void;
  showCurrentLocation?: boolean;
  showGeofences?: boolean;
  style?: any;
}

interface GeofenceArea {
  id: string | number;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  color?: string;
}

const EmbeddedMap: React.FC<EmbeddedMapProps> = ({
  size = { width: 150, height: 150 },
  currentLocation,
  geofences,
  onLocationUpdate,
  onGeofenceStatusChange,
  showCurrentLocation = true,
  showGeofences = true,
  style,
}) => {
  // Theme colors
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const borderColor = useThemeColor("#e2e8f0", "#334155");
  const cardColor = useThemeColor("#ffffff", "#1e293b");

  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  // Refs
  const mapRef = useRef<MapView>(null);
  const fullscreenMapRef = useRef<MapView>(null);

  // Store data
  const {
    currentLocation: storeLocation,
    isInGeofence,
    currentGeofenceId,
  } = useLocationStore();

  const { geofences: storeGeofences } = useGeofenceStore();

  // Use provided location or store location
  const displayLocation = currentLocation || storeLocation;

  // Use provided geofences or store geofences
  const displayGeofences = geofences || storeGeofences || [];

  // Process geofences to ensure proper format
  const processedGeofences = useMemo<GeofenceArea[]>(() => {
    return displayGeofences
      .filter((geofence) => {
        // Validate geofence data
        if (!geofence || !geofence.coordinates) return false;

        if (geofence.coordinates.type === "Point") {
          const coords = geofence.coordinates.coordinates;
          return Array.isArray(coords) && coords.length >= 2;
        }

        return false;
      })
      .map((geofence) => {
        const [longitude, latitude] = geofence.coordinates
          .coordinates as number[];
        const radius =
          typeof geofence.radius === "string"
            ? parseFloat(geofence.radius)
            : geofence.radius || 100;

        return {
          id: geofence.id,
          name: geofence.name,
          coordinates: { latitude, longitude },
          radius,
          color: currentGeofenceId === geofence.id ? "#10b981" : "#f59e0b",
        };
      });
  }, [displayGeofences, currentGeofenceId]);

  // Calculate initial region based on location and geofences
  const initialRegion = useMemo<Region>(() => {
    if (displayLocation?.latitude && displayLocation?.longitude) {
      return {
        latitude: displayLocation.latitude,
        longitude: displayLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // If no location but have geofences, center on first geofence
    if (processedGeofences.length > 0) {
      const firstGeofence = processedGeofences[0];
      return {
        latitude: firstGeofence.coordinates.latitude,
        longitude: firstGeofence.coordinates.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Default to Bangalore coordinates
    return {
      latitude: 12.9716,
      longitude: 77.5946,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [displayLocation, processedGeofences]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("Location permission not granted");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      // Update region
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setMapRegion(newRegion);

      // Animate to new location
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
      if (fullscreenMapRef.current && isFullscreen) {
        fullscreenMapRef.current.animateToRegion(newRegion, 1000);
      }

      // Call callback if provided
      if (onLocationUpdate) {
        onLocationUpdate(newLocation);
      }
    } catch (error) {
      console.error("Error getting current location:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [onLocationUpdate, isFullscreen]);

  // Handle tap to expand
  const handleMapPress = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  // Handle fullscreen close
  const handleFullscreenClose = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Handle region change
  const handleRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  // Check if location is in geofence
  const checkGeofenceStatus = useCallback(() => {
    if (
      !displayLocation?.latitude ||
      !displayLocation?.longitude ||
      processedGeofences.length === 0
    )
      return;

    const userLat = displayLocation.latitude;
    const userLng = displayLocation.longitude;

    for (const geofence of processedGeofences) {
      const distance = calculateDistance(
        userLat,
        userLng,
        geofence.coordinates.latitude,
        geofence.coordinates.longitude,
      );

      if (distance <= geofence.radius) {
        if (onGeofenceStatusChange) {
          onGeofenceStatusChange(true, geofence.name);
        }
        return;
      }
    }

    if (onGeofenceStatusChange) {
      onGeofenceStatusChange(false);
    }
  }, [displayLocation, processedGeofences, onGeofenceStatusChange]);

  // Calculate distance between two points
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // Earth radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    [],
  );

  // Check geofence status when location changes
  useEffect(() => {
    checkGeofenceStatus();
  }, [checkGeofenceStatus]);

  // Dark mode map style
  const darkMapStyle = useMemo(
    () => [
      {
        elementType: "geometry",
        stylers: [{ color: "#242f3e" }],
      },
      {
        elementType: "labels.text.stroke",
        stylers: [{ color: "#242f3e" }],
      },
      {
        elementType: "labels.text.fill",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ],
    [],
  );

  // Render map content
  const renderMapContent = useCallback(
    (mapRef: React.RefObject<MapView | null>, isFullscreenMap = false) => (
      <>
        {/* Geofence circles */}
        {showGeofences &&
          processedGeofences.map((geofence) => (
            <Circle
              key={`geofence-${geofence.id}`}
              center={geofence.coordinates}
              radius={geofence.radius}
              fillColor={
                currentGeofenceId === geofence.id
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(245, 158, 11, 0.1)"
              }
              strokeColor={geofence.color}
              strokeWidth={2}
            />
          ))}

        {/* Current location marker */}
        {showCurrentLocation &&
          displayLocation?.latitude &&
          displayLocation?.longitude && (
            <Marker
              coordinate={{
                latitude: displayLocation.latitude,
                longitude: displayLocation.longitude,
              }}
              title="Current Location"
              description={`Accuracy: ${displayLocation.accuracy ? displayLocation.accuracy.toFixed(0) : "Unknown"}m`}
            >
              <View style={styles.locationMarker}>
                <View
                  style={[
                    styles.locationDot,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <View
                  style={[styles.locationRing, { borderColor: primaryColor }]}
                />
              </View>
            </Marker>
          )}

        {/* Geofence labels */}
        {showGeofences &&
          processedGeofences.map((geofence) => (
            <Marker
              key={`label-${geofence.id}`}
              coordinate={geofence.coordinates}
              title={geofence.name}
              description={`Radius: ${geofence.radius}m`}
            >
              <View
                style={[styles.geofenceLabel, { backgroundColor: cardColor }]}
              >
                <Text style={[styles.geofenceLabelText, { color: textColor }]}>
                  {geofence.name}
                </Text>
              </View>
            </Marker>
          ))}
      </>
    ),
    [
      showGeofences,
      showCurrentLocation,
      processedGeofences,
      displayLocation,
      currentGeofenceId,
      primaryColor,
      cardColor,
      textColor,
    ],
  );

  return (
    <>
      {/* Embedded Map */}
      <TouchableOpacity
        style={[
          styles.embeddedContainer,
          {
            width: size.width,
            height: size.height,
            backgroundColor,
            borderColor,
          },
          style,
        ]}
        onPress={handleMapPress}
        activeOpacity={0.8}
      >
        <MapView
          ref={mapRef}
          style={styles.embeddedMap}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          region={mapRegion || initialRegion}
          onRegionChangeComplete={handleRegionChange}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          customMapStyle={colorScheme === "dark" ? darkMapStyle : undefined}
        >
          {renderMapContent(mapRef)}
        </MapView>

        {/* Expand indicator */}
        <View style={[styles.expandIndicator, { backgroundColor: cardColor }]}>
          <Ionicons name="expand" size={16} color={textColor} />
        </View>

        {/* Status indicator */}
        {isInGeofence && (
          <View
            style={[styles.statusIndicator, { backgroundColor: "#10b981" }]}
          >
            <Ionicons name="location" size={12} color="white" />
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleFullscreenClose}
      >
        <View style={[styles.fullscreenContainer, { backgroundColor }]}>
          {/* Header */}
          <View
            style={[
              styles.fullscreenHeader,
              { backgroundColor: cardColor, borderBottomColor: borderColor },
            ]}
          >
            <Text style={[styles.fullscreenTitle, { color: textColor }]}>
              Location Map
            </Text>
            <View style={styles.headerControls}>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: primaryColor }]}
                onPress={getCurrentLocation}
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="locate" size={20} color="white" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: "#ef4444" }]}
                onPress={handleFullscreenClose}
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fullscreen Map */}
          <MapView
            ref={fullscreenMapRef}
            style={styles.fullscreenMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion || initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            customMapStyle={colorScheme === "dark" ? darkMapStyle : undefined}
          >
            {renderMapContent(fullscreenMapRef, true)}
          </MapView>

          {/* Info panel */}
          {(displayLocation || processedGeofences.length > 0) && (
            <View
              style={[
                styles.infoPanel,
                { backgroundColor: cardColor, borderTopColor: borderColor },
              ]}
            >
              {displayLocation?.latitude && displayLocation?.longitude && (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={primaryColor}
                  />
                  <Text style={[styles.infoText, { color: textColor }]}>
                    {displayLocation.latitude.toFixed(6)},{" "}
                    {displayLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
              {displayLocation?.accuracy && (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="radio-outline"
                    size={16}
                    color={primaryColor}
                  />
                  <Text style={[styles.infoText, { color: textColor }]}>
                    Accuracy: {Math.round(displayLocation.accuracy)}m
                  </Text>
                </View>
              )}
              {isInGeofence && (
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={[styles.infoText, { color: textColor }]}>
                    Inside geofenced area
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={primaryColor}
                />
                <Text style={[styles.infoText, { color: textColor }]}>
                  {processedGeofences.length} geofence
                  {processedGeofences.length !== 1 ? "s" : ""} nearby
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  embeddedContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  embeddedMap: {
    flex: 1,
  },
  expandIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statusIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  locationMarker: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
  },
  locationRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  geofenceLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  geofenceLabelText: {
    fontSize: 10,
    fontWeight: "600",
  },
  fullscreenContainer: {
    flex: 1,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 50 : 12,
    borderBottomWidth: 1,
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerControls: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenMap: {
    flex: 1,
  },
  infoPanel: {
    padding: 16,
    borderTopWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default EmbeddedMap;
