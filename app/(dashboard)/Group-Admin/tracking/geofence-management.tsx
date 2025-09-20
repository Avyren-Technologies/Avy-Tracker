import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import * as Location from "expo-location";
import Constants from "expo-constants";

import { useAuth } from "../../../context/AuthContext";
import { useColorScheme, useThemeColor } from "../../../hooks/useColorScheme";
import useGeofenceStore from "../../../store/geofenceStore";
import useMapStore from "../../../store/useMapStore";
import {
  Geofence,
  GeoCoordinates,
  GeofenceType,
} from "../../../types/liveTracking";

// Define a type for map press event
type MapPressEvent = {
  nativeEvent: {
    coordinate: {
      latitude: number;
      longitude: number;
    };
    position?: {
      x: number;
      y: number;
    };
  };
};

// Google Places API types
interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

// Google Places API service functions using backend proxy
const searchPlaces = async (query: string): Promise<PlacePrediction[]> => {
  if (!query.trim()) return [];
  
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/places/autocomplete?input=${encodeURIComponent(query)}&types=establishment|geocode`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.predictions || [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
};

const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  if (!placeId) return null;
  
  try {
    console.log('Fetching place details for:', placeId);
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/places/details?place_id=${placeId}&fields=place_id,name,formatted_address,geometry`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Place details API response:', data);
    return data.result || null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};

// Enhance the coordinate validation function with better error messages
const validateAndFormatPointCoordinates = (
  longitude: number | string | null | undefined,
  latitude: number | string | null | undefined,
): GeoJSON.Point | null => {
  console.log(`Validating coords: long=${longitude}, lat=${latitude}`);

  // Convert to numbers and validate
  const numLongitude =
    longitude !== null && longitude !== undefined ? Number(longitude) : NaN;
  const numLatitude =
    latitude !== null && latitude !== undefined ? Number(latitude) : NaN;

  // Check if both values are valid numbers
  if (isNaN(numLongitude) || isNaN(numLatitude)) {
    console.error(
      `Invalid coordinates: longitude=${longitude}(${isNaN(numLongitude) ? "NaN" : numLongitude}), latitude=${latitude}(${isNaN(numLatitude) ? "NaN" : numLatitude})`,
    );
    return null;
  }

  // Validate coordinate ranges
  if (numLongitude < -180 || numLongitude > 180) {
    console.error(`Longitude out of range: ${numLongitude}`);
    return null;
  }

  if (numLatitude < -90 || numLatitude > 90) {
    console.error(`Latitude out of range: ${numLatitude}`);
    return null;
  }

  // Return GeoJSON Point format
  return {
    type: "Point",
    coordinates: [numLongitude, numLatitude],
  };
};

export default function GeofenceManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");
  const inputBgColor = useThemeColor("#f1f5f9", "#1e293b");
  const inputColor = useThemeColor("#0f172a", "#f8fafc");
  const borderColor = useThemeColor(
    "rgba(0, 0, 0, 0.1)",
    "rgba(255, 255, 255, 0.1)",
  );

  // Map reference
  const mapRef = useRef<MapView>(null);

  // Geofence store
  const {
    geofences,
    selectedGeofence,
    isEditing,
    isCreating,
    error,
    isLoading,
    editName,
    editType,
    editCoordinates,
    editRadius,
    fetchGeofences,
    selectGeofence,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    startEditing,
    startCreating,
    cancelEdit,
    updateEditName,
    updateEditType,
    updateEditCoordinates,
    updateEditRadius,
  } = useGeofenceStore();

  // Map store
  const { currentRegion, mapType, setCurrentRegion, setMapType } =
    useMapStore();

  // Local state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingGeofence, setIsAddingGeofence] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Place search state
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch geofences on mount
  useEffect(() => {
    fetchGeofences();
  }, []);

  // Debounced place search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (placeSearchQuery.trim().length > 2) {
        setIsSearchingPlaces(true);
        setSearchError(null);
        try {
          const predictions = await searchPlaces(placeSearchQuery);
          setPlacePredictions(predictions);
          if (predictions.length === 0) {
            setSearchError("No places found. Try a different search term.");
          }
        } catch (error) {
          console.error('Error searching places:', error);
          setPlacePredictions([]);
          setSearchError("Failed to search places. Please check your connection and try again.");
        } finally {
          setIsSearchingPlaces(false);
        }
      } else {
        setPlacePredictions([]);
        setSearchError(null);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [placeSearchQuery]);

  // Filter geofences by search query
  const filteredGeofences = React.useMemo(() => {
    if (!searchQuery.trim()) return geofences;

    const lowerQuery = searchQuery.toLowerCase();
    return geofences.filter((g) => g.name.toLowerCase().includes(lowerQuery));
  }, [geofences, searchQuery]);

  // Handle map press
  const handleMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;

    if (isCreating || isEditing) {
      // Use the validation helper function
      const pointCoordinates = validateAndFormatPointCoordinates(
        coordinate.longitude,
        coordinate.latitude,
      );

      if (pointCoordinates) {
        updateEditCoordinates(pointCoordinates);
        console.log("Updated coordinates to:", pointCoordinates.coordinates);
      } else {
        console.error("Invalid coordinates from map press:", coordinate);
      }
    }
  };

  // Handle geofence selection
  const handleSelectGeofence = (geofence: Geofence) => {
    selectGeofence(geofence.id);

    // Center map on the selected geofence
    if (mapRef.current && geofence.coordinates.type === "Point") {
      const [longitude, latitude] = geofence.coordinates
        .coordinates as number[];

      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Handle place selection
  const handlePlaceSelect = async (place: PlacePrediction) => {
    setIsSearchingPlaces(true);
    setSearchError(null);
    setShowPlaceSearch(false);
    setPlaceSearchQuery(place.description);
    
    try {
      console.log('Selected place:', place);
      
      let coordinates = null;
      
      // Check if coordinates are directly available in the place object (OpenStreetMap)
      if (place.geometry && place.geometry.location) {
        coordinates = place.geometry.location;
        console.log('Using coordinates from place object:', coordinates);
      } else {
        // Fallback to fetching place details (Google Places)
        const placeDetails = await getPlaceDetails(place.place_id);
        console.log('Place details received:', placeDetails);
        
        if (placeDetails && placeDetails.geometry) {
          coordinates = placeDetails.geometry.location;
          console.log('Coordinates from place details:', coordinates);
        }
      }
      
      if (coordinates) {
        const { lat, lng } = coordinates;
        
        // Update coordinates
        const pointCoordinates = validateAndFormatPointCoordinates(lng, lat);
        console.log('Validated coordinates:', pointCoordinates);
        
        if (pointCoordinates) {
          updateEditCoordinates(pointCoordinates);
          
          // Center map on selected place with a slight delay to ensure map is ready
          setTimeout(() => {
            if (mapRef.current) {
              console.log('Animating map to:', { latitude: lat, longitude: lng });
              mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000); // 1 second animation
            } else {
              console.error('Map ref is null');
            }
          }, 100);
          
          // Clear any previous errors
          setSearchError(null);
        } else {
          setSearchError("Invalid coordinates received for this place. Please try another location.");
        }
      } else {
        setSearchError("Could not get coordinates for this place. Please try another location.");
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      setSearchError("Failed to get place details. Please check your connection and try again.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // Handle new geofence creation
  const handleAddGeofence = async () => {
    setIsAddingGeofence(true);

    try {
      // Show modal immediately with a loading state
      startCreating("circle");
      setIsModalVisible(true);
      setShowPlaceSearch(true);

      // Get current location as fallback
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Set initial coordinates to current location using validation helper
        const pointCoordinates = validateAndFormatPointCoordinates(
          location.coords.longitude,
          location.coords.latitude,
        );

        if (pointCoordinates) {
          updateEditCoordinates(pointCoordinates);
        }

        // Center map on location
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
      // Don't show error for location, just continue with manual placement
    } finally {
      setIsAddingGeofence(false);
    }
  };

  // Handle edit geofence
  const handleEditGeofence = () => {
    if (selectedGeofence) {
      startEditing(selectedGeofence);
      setIsModalVisible(true);
      setShowPlaceSearch(true);
    }
  };

  // Handle save geofence (create or update)
  const handleSaveGeofence = async () => {
    // Check if coordinates are set
    if (!editCoordinates) {
      Alert.alert("Error", "Please select a location for the geofence");
      return;
    }

    if (!editName.trim()) {
      Alert.alert("Error", "Please enter a name for the geofence");
      return;
    }

    // Validate coordinates format
    if (
      editCoordinates.type !== "Point" ||
      !Array.isArray(editCoordinates.coordinates) ||
      editCoordinates.coordinates.length !== 2
    ) {
      Alert.alert("Error", "Invalid coordinate format. Please try again.");
      console.error("Invalid coordinates format:", editCoordinates);
      return;
    }

    setIsSaving(true);

    try {
      if (isCreating) {
        // Create new geofence with validated Point geometry
        await createGeofence(
          editName,
          editCoordinates,
          Number(editRadius), // Ensure radius is a number
        );

        // Only show success if no error was set by the store
        if (!error) {
          Alert.alert("Success", "Geofence created successfully");
        }
      } else if (isEditing && selectedGeofence) {
        // Update existing geofence with explicit number conversion for radius
        await updateGeofence(selectedGeofence.id, {
          name: editName,
          coordinates: editCoordinates,
          radius: Number(editRadius), // Ensure radius is a number
        });

        // Only show success if no error was set by the store
        if (!error) {
          Alert.alert("Success", "Geofence updated successfully");
        }
      }

      // Close modal and reset edit state if no error
      if (!error) {
        setIsModalVisible(false);
        setShowPlaceSearch(false);
        setPlaceSearchQuery("");
        setPlacePredictions([]);
        cancelEdit();

        // Refresh geofences to ensure we have fresh data
        await fetchGeofences();
        console.log("Refreshed geofences after save");
      }
    } catch (error) {
      console.error("Error saving geofence:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to save geofence",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete geofence
  const handleDeleteGeofence = async () => {
    if (selectedGeofence) {
      if (!confirmDelete) {
        setConfirmDelete(true);
        Alert.alert(
          "Confirm Delete",
          `Are you sure you want to delete the geofence "${selectedGeofence.name}"?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setConfirmDelete(false),
            },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  await deleteGeofence(selectedGeofence.id);

                  // Only show success if no error was set by the store
                  if (!error) {
                    Alert.alert("Success", "Geofence deleted successfully");
                  }
                  selectGeofence(null);
                } catch (error) {
                  console.error("Error deleting geofence:", error);
                  Alert.alert(
                    "Error",
                    error instanceof Error
                      ? error.message
                      : "Failed to delete geofence",
                  );
                } finally {
                  setConfirmDelete(false);
                }
              },
            },
          ],
        );
      }
    }
  };

  // Get coordinates for map and circle display
  const getCoordinates = (
    geofence: Geofence | null,
  ): { latitude: number; longitude: number } | null => {
    if (!geofence || !geofence.coordinates) return null;

    try {
      console.log(
        `Parsing coordinates for geofence ${geofence.id}:`,
        geofence.coordinates,
      );

      // Handle case when coordinates is already a GeoJSON Point object
      if (
        typeof geofence.coordinates === "object" &&
        "type" in geofence.coordinates &&
        geofence.coordinates.type === "Point" &&
        "coordinates" in geofence.coordinates &&
        Array.isArray(geofence.coordinates.coordinates) &&
        geofence.coordinates.coordinates.length === 2
      ) {
        const [longitude, latitude] = geofence.coordinates.coordinates;

        // Additional validation and explicit conversion to numbers
        const lat = Number(latitude);
        const lng = Number(longitude);

        console.log(
          `Converted coordinates for geofence ${geofence.id}: [${lng}, ${lat}]`,
        );

        if (!isNaN(lat) && !isNaN(lng)) {
          return { latitude: lat, longitude: lng };
        }
      }

      // Handle case when coordinates is a string (WKB format)
      if (typeof geofence.coordinates === "string") {
        try {
          // Try parsing as JSON first in case it's a stringified GeoJSON
          const parsed = JSON.parse(geofence.coordinates);
          if (
            parsed &&
            typeof parsed === "object" &&
            "type" in parsed &&
            parsed.type === "Point" &&
            "coordinates" in parsed &&
            Array.isArray(parsed.coordinates) &&
            parsed.coordinates.length === 2
          ) {
            const [longitude, latitude] = parsed.coordinates.map(Number);

            if (!isNaN(latitude) && !isNaN(longitude)) {
              console.log(
                `Parsed coordinates from JSON string: [${longitude}, ${latitude}]`,
              );
              return { latitude, longitude };
            }
          }
        } catch (jsonError) {
          // If it's not JSON, it might be WKB - we'll need to request fresh data
          console.log("Coordinates in WKB format, refreshing data...");
          fetchGeofences();
          return null;
        }
      }

      console.warn("Invalid coordinates format in geofence:", geofence.id);
      return null;
    } catch (error) {
      console.error("Error parsing geofence coordinates:", error);
      return null;
    }
  };

  // Get edit coordinates for map display
  const getEditCoordinates = (): {
    latitude: number;
    longitude: number;
  } | null => {
    if (!editCoordinates) return null;

    // Ensure we have a valid Point with coordinates array
    if (
      editCoordinates.type === "Point" &&
      Array.isArray(editCoordinates.coordinates) &&
      editCoordinates.coordinates.length === 2
    ) {
      const [longitude, latitude] = editCoordinates.coordinates as number[];

      // Additional validation for numeric values
      if (
        typeof latitude === "number" &&
        !isNaN(latitude) &&
        typeof longitude === "number" &&
        !isNaN(longitude)
      ) {
        return { latitude, longitude };
      }
    }

    console.warn("Invalid edit coordinates format:", editCoordinates);
    return null;
  };

  // Toggle map type between standard and satellite
  const toggleMapType = () => {
    setMapType(mapType === "standard" ? "satellite" : "standard");
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "Geofence Management",
          headerStyle: {
            backgroundColor: cardColor,
          },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={currentRegion}
          mapType={mapType}
          onPress={handleMapPress}
          onRegionChangeComplete={setCurrentRegion}
        >
          {/* Existing Geofences */}
          {filteredGeofences.map((geofence) => {
            console.log(`Rendering geofence ${geofence.id}:`, geofence);

            const coordinates = getCoordinates(geofence);
            if (!coordinates) {
              console.warn(
                `Failed to get valid coordinates for geofence ${geofence.id}`,
              );
              return null;
            }

            // Ensure radius is a number
            const radius = Number(geofence.radius);
            console.log(`Using radius for geofence ${geofence.id}: ${radius}`);

            return (
              <React.Fragment key={geofence.id}>
                <Marker
                  coordinate={coordinates}
                  title={geofence.name}
                  pinColor={
                    selectedGeofence?.id === geofence.id ? "#3b82f6" : "#f59e0b"
                  }
                  onPress={() => handleSelectGeofence(geofence)}
                />
                <Circle
                  center={coordinates}
                  radius={radius}
                  strokeWidth={2}
                  strokeColor={
                    selectedGeofence?.id === geofence.id ? "#3b82f6" : "#f59e0b"
                  }
                  fillColor={
                    selectedGeofence?.id === geofence.id
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(245, 158, 11, 0.1)"
                  }
                />
              </React.Fragment>
            );
          })}

          {/* Editing or Creating Geofence */}
          {(isEditing || isCreating) && (
            <>
              {getEditCoordinates() && (
                <>
                  <Marker
                    coordinate={getEditCoordinates()!}
                    pinColor="#ef4444"
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;

                      // Use the validation helper function with correct parameter order
                      const pointCoordinates =
                        validateAndFormatPointCoordinates(longitude, latitude);

                      if (pointCoordinates) {
                        updateEditCoordinates(pointCoordinates);
                        console.log(
                          "Updated marker position:",
                          pointCoordinates.coordinates,
                        );
                      } else {
                        console.error(
                          "Invalid coordinates from marker drag:",
                          e.nativeEvent.coordinate,
                        );
                      }
                    }}
                  />
                  <Circle
                    center={getEditCoordinates()!}
                    radius={Number(editRadius)}
                    strokeWidth={2}
                    strokeColor="#ef4444"
                    fillColor="rgba(239, 68, 68, 0.2)"
                  />
                </>
              )}
            </>
          )}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: cardColor }]}
            onPress={toggleMapType}
          >
            <Ionicons
              name={mapType === "standard" ? "map" : "globe"}
              size={22}
              color={textColor}
            />
          </TouchableOpacity>

          {(isEditing || isCreating) && (
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: cardColor }]}
              onPress={() => {
                setIsModalVisible(true);
              }}
            >
              <Ionicons name="create" size={22} color="#3b82f6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Geofence List */}
      <View style={[styles.listSection, { backgroundColor: cardColor }]}>
        {/* Search and Controls */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: inputBgColor, borderColor },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={textColor}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: inputColor }]}
              placeholder="Search geofences..."
              placeholderTextColor="gray"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="gray" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: "#3b82f6" }]}
            onPress={handleAddGeofence}
            disabled={isAddingGeofence}
          >
            {isAddingGeofence ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="add" size={22} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* List of Geofences */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, { color: textColor }]}>
              Loading geofences...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list}>
            {filteredGeofences.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: textColor }]}>
                  {searchQuery
                    ? "No geofences match your search"
                    : "No geofences yet. Tap the + button to create one."}
                </Text>
              </View>
            ) : (
              filteredGeofences.map((geofence) => (
                <TouchableOpacity
                  key={geofence.id}
                  style={[
                    styles.geofenceItem,
                    selectedGeofence?.id === geofence.id &&
                      styles.selectedGeofenceItem,
                    { borderColor },
                  ]}
                  onPress={() => handleSelectGeofence(geofence)}
                >
                  <View style={styles.geofenceInfo}>
                    <Text style={[styles.geofenceName, { color: textColor }]}>
                      {geofence.name}
                    </Text>
                    <Text
                      style={[styles.geofenceDetails, { color: textColor }]}
                    >
                      Radius: {geofence.radius}m
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={textColor}
                  />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* Selected Geofence Actions */}
        {selectedGeofence && (
          <View style={[styles.actionsBar, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEditGeofence}
            >
              <Ionicons name="create" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeleteGeofence}
              disabled={confirmDelete}
            >
              <Ionicons name="trash" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsModalVisible(false);
          setShowPlaceSearch(false);
          setPlaceSearchQuery("");
          setPlacePredictions([]);
          setSearchError(null);
          if (!selectedGeofence) {
            cancelEdit();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {isCreating ? "New Geofence" : "Edit Geofence"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsModalVisible(false);
                  setShowPlaceSearch(false);
                  setPlaceSearchQuery("");
                  setPlacePredictions([]);
                  setSearchError(null);
                  if (!selectedGeofence) {
                    cancelEdit();
                  }
                }}
              >
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {/* Name Input */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: textColor }]}>
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: inputBgColor,
                      color: inputColor,
                      borderColor,
                    },
                  ]}
                  value={editName}
                  onChangeText={updateEditName}
                  placeholder="Enter geofence name"
                  placeholderTextColor="gray"
                />
              </View>

              {/* Place Search */}
              {showPlaceSearch && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textColor }]}>
                    Search Location
                  </Text>
                  <View style={styles.placeSearchContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: inputBgColor,
                          color: inputColor,
                          borderColor,
                          flex: 1,
                        },
                      ]}
                      value={placeSearchQuery}
                      onChangeText={setPlaceSearchQuery}
                      placeholder="Search for a place..."
                      placeholderTextColor="gray"
                    />
                    {isSearchingPlaces && (
                      <ActivityIndicator 
                        size="small" 
                        color="#3b82f6" 
                        style={styles.searchLoader}
                      />
                    )}
                  </View>
                  
                  {/* Place Predictions */}
                  {placePredictions.length > 0 && (
                    <View style={[styles.predictionsContainer, { backgroundColor: inputBgColor, borderColor }]}>
                      <ScrollView 
                        style={styles.predictionsList}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                        {placePredictions.map((item) => (
                          <TouchableOpacity
                            key={item.place_id}
                            style={[styles.predictionItem, { borderBottomColor: borderColor }]}
                            onPress={() => handlePlaceSelect(item)}
                          >
                            <Ionicons name="location-outline" size={16} color={textColor} />
                            <View style={styles.predictionText}>
                              <Text style={[styles.predictionMainText, { color: textColor }]}>
                                {item.structured_formatting.main_text}
                              </Text>
                              <Text style={[styles.predictionSecondaryText, { color: textColor }]}>
                                {item.structured_formatting.secondary_text}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Search Error */}
                  {searchError && (
                    <View style={[styles.errorContainer, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <Ionicons name="alert-circle" size={16} color="#DC2626" />
                      <Text style={[styles.searchErrorText, { color: '#DC2626' }]}>
                        {searchError}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Radius Slider */}
              <View style={styles.formGroup}>
                <View style={styles.formLabelRow}>
                  <Text style={[styles.formLabel, { color: textColor }]}>
                    Radius (meters)
                  </Text>
                  <Text style={[styles.radiusValue, { color: textColor }]}>
                    {editRadius}m
                  </Text>
                </View>

                <View style={styles.radiusControls}>
                  <TouchableOpacity
                    style={[
                      styles.radiusButton,
                      { backgroundColor: "#3b82f6" },
                    ]}
                    onPress={() =>
                      updateEditRadius(Math.max(50, editRadius - 50))
                    }
                  >
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.radiusSlider,
                      { backgroundColor: inputBgColor },
                    ]}
                  >
                    <View
                      style={[
                        styles.radiusSliderFill,
                        {
                          width: `${Math.min(100, (editRadius / 1000) * 100)}%`,
                          backgroundColor: "#3b82f6",
                        },
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.radiusButton,
                      { backgroundColor: "#3b82f6" },
                    ]}
                    onPress={() =>
                      updateEditRadius(Math.min(5000, editRadius + 50))
                    }
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.radiusHint, { color: textColor }]}>
                  {showPlaceSearch 
                    ? "Search for a location above, then tap +/- buttons or drag marker on map to adjust geofence"
                    : "Tap +/- buttons or drag marker on map to adjust geofence"
                  }
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setIsModalVisible(false);
                    setShowPlaceSearch(false);
                    setPlaceSearchQuery("");
                    setPlacePredictions([]);
                    setSearchError(null);
                    if (!selectedGeofence) {
                      cancelEdit();
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveGeofence}
                  disabled={isSaving || isLoading}
                >
                  {isSaving || isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Geofence</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Error Toast */}
      {error && (
        <View style={styles.errorToast}>
          <Ionicons name="alert-circle" size={20} color="#ffffff" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => useGeofenceStore.getState().setError(null)}
          >
            <Ionicons name="close" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 2,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: "absolute",
    top: 50,
    right: 16,
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  listSection: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    overflow: "hidden",
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  geofenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedGeofenceItem: {
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  geofenceInfo: {
    flex: 1,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  geofenceDetails: {
    fontSize: 14,
    opacity: 0.8,
  },
  actionsBar: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: "#3b82f6",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalForm: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  formLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  radiusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  radiusControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radiusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  radiusSlider: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  radiusSliderFill: {
    height: "100%",
  },
  radiusHint: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
    fontStyle: "italic",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  cancelButtonText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorToast: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  errorText: {
    color: "#ffffff",
    flex: 1,
    marginHorizontal: 8,
    fontSize: 14,
  },
  placeSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchLoader: {
    marginLeft: 8,
  },
  predictionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    overflow: "hidden",
  },
  predictionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  predictionText: {
    flex: 1,
    marginLeft: 12,
  },
  predictionMainText: {
    fontSize: 14,
    fontWeight: "500",
  },
  predictionSecondaryText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  searchErrorText: {
    fontSize: 12,
    flex: 1,
  },
});
