import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import EmbeddedMap from "../components/EmbeddedMap";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import { Location as LocationType, Geofence } from "../types/liveTracking";

export default function EmbeddedMapTest() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");
  const borderColor = useThemeColor("#e2e8f0", "#334155");

  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(
    null,
  );
  const [isInGeofence, setIsInGeofence] = useState(false);
  const [currentGeofenceName, setCurrentGeofenceName] = useState<string>("");
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");

  // Mock geofences for testing
  const mockGeofences: Geofence[] = [
    {
      id: 1,
      name: "Office Area",
      coordinates: {
        type: "Point",
        coordinates: [77.5946, 12.9716], // Bangalore coordinates
      },
      radius: 200,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyId: 1,
      createdBy: 1,
    },
    {
      id: 2,
      name: "Warehouse",
      coordinates: {
        type: "Point",
        coordinates: [77.6, 12.98], // Slightly different coordinates
      },
      radius: 150,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyId: 1,
      createdBy: 1,
    },
  ];

  // Request location permissions and get current location
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const locationData: LocationType = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        };

        setCurrentLocation(locationData);
      } else {
        Alert.alert(
          "Permission Required",
          "Location permission is required to test the embedded map.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      Alert.alert("Error", "Failed to get location permission");
    }
  };

  // Handle location updates from the map
  const handleLocationUpdate = (location: LocationType) => {
    console.log("Location updated:", location);
    setCurrentLocation(location);
  };

  // Handle geofence status changes
  const handleGeofenceStatusChange = (
    isInside: boolean,
    geofenceName?: string,
  ) => {
    console.log("Geofence status changed:", { isInside, geofenceName });
    setIsInGeofence(isInside);
    setCurrentGeofenceName(geofenceName || "");
  };

  // Initialize location on component mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "Embedded Map Test",
          headerStyle: { backgroundColor: cardColor },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View
          style={[styles.header, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.headerTitle, { color: textColor }]}>
            EmbeddedMap Component Test
          </Text>
          <Text style={[styles.headerSubtitle, { color: textColor }]}>
            Testing 150x150px embedded map with geofences
          </Text>
        </View>

        {/* Permission Status */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Permission Status
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={
                permissionStatus === "granted"
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={20}
              color={permissionStatus === "granted" ? "#10b981" : "#ef4444"}
            />
            <Text style={[styles.statusText, { color: textColor }]}>
              Location: {permissionStatus}
            </Text>
          </View>
        </View>

        {/* Current Location Info */}
        {currentLocation && (
          <View
            style={[styles.card, { backgroundColor: cardColor, borderColor }]}
          >
            <Text style={[styles.cardTitle, { color: textColor }]}>
              Current Location
            </Text>
            <Text style={[styles.locationText, { color: textColor }]}>
              Lat: {currentLocation.latitude?.toFixed(6) || "N/A"}
            </Text>
            <Text style={[styles.locationText, { color: textColor }]}>
              Lng: {currentLocation.longitude?.toFixed(6) || "N/A"}
            </Text>
            <Text style={[styles.locationText, { color: textColor }]}>
              Accuracy:{" "}
              {currentLocation.accuracy
                ? `${Math.round(currentLocation.accuracy)}m`
                : "N/A"}
            </Text>
          </View>
        )}

        {/* Geofence Status */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Geofence Status
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={isInGeofence ? "location" : "location-outline"}
              size={20}
              color={isInGeofence ? "#10b981" : "#6b7280"}
            />
            <Text style={[styles.statusText, { color: textColor }]}>
              {isInGeofence
                ? `Inside: ${currentGeofenceName}`
                : "Outside all geofences"}
            </Text>
          </View>
        </View>

        {/* Embedded Map - Default Size (150x150) */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Default Size (150x150px)
          </Text>
          <View style={styles.mapContainer}>
            <EmbeddedMap
              currentLocation={currentLocation}
              geofences={mockGeofences}
              onLocationUpdate={handleLocationUpdate}
              onGeofenceStatusChange={handleGeofenceStatusChange}
              showCurrentLocation={true}
              showGeofences={true}
            />
          </View>
          <Text style={[styles.mapDescription, { color: textColor }]}>
            Tap the map to expand to fullscreen view
          </Text>
        </View>

        {/* Embedded Map - Custom Size */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Custom Size (200x120px)
          </Text>
          <View style={styles.mapContainer}>
            <EmbeddedMap
              size={{ width: 200, height: 120 }}
              currentLocation={currentLocation}
              geofences={mockGeofences}
              onLocationUpdate={handleLocationUpdate}
              onGeofenceStatusChange={handleGeofenceStatusChange}
              showCurrentLocation={true}
              showGeofences={true}
            />
          </View>
          <Text style={[styles.mapDescription, { color: textColor }]}>
            Custom sized embedded map
          </Text>
        </View>

        {/* Embedded Map - No Geofences */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Location Only (No Geofences)
          </Text>
          <View style={styles.mapContainer}>
            <EmbeddedMap
              currentLocation={currentLocation}
              onLocationUpdate={handleLocationUpdate}
              showCurrentLocation={true}
              showGeofences={false}
            />
          </View>
          <Text style={[styles.mapDescription, { color: textColor }]}>
            Map showing only current location
          </Text>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: "#3b82f6" }]}
          onPress={requestLocationPermission}
        >
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.refreshButtonText}>Refresh Location</Text>
        </TouchableOpacity>

        {/* Mock Geofences Info */}
        <View
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.cardTitle, { color: textColor }]}>
            Mock Geofences
          </Text>
          {mockGeofences.map((geofence, index) => (
            <View key={geofence.id} style={styles.geofenceItem}>
              <Text style={[styles.geofenceName, { color: textColor }]}>
                {geofence.name}
              </Text>
              <Text style={[styles.geofenceDetails, { color: textColor }]}>
                Radius: {geofence.radius}m
              </Text>
              <Text style={[styles.geofenceDetails, { color: textColor }]}>
                Coords:{" "}
                {Array.isArray(geofence.coordinates.coordinates) &&
                geofence.coordinates.coordinates.length >= 2
                  ? `${(geofence.coordinates.coordinates[1] as number).toFixed(4)}, ${(geofence.coordinates.coordinates[0] as number).toFixed(4)}`
                  : "Invalid coordinates"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  locationText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  mapContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  mapDescription: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.7,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  refreshButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  geofenceItem: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  geofenceName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  geofenceDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
});
