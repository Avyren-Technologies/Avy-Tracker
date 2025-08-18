import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import EmbeddedMap from '../components/EmbeddedMap';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import useLocationStore from '../store/locationStore';
import { useGeofencing } from '../hooks/useGeofencing';
import { Location as AppLocation } from '../types/liveTracking';

export default function ShiftTrackerEmbeddedMapTest() {
    const colorScheme = useColorScheme();
    const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
    const textColor = useThemeColor('#334155', '#e2e8f0');
    const cardColor = useThemeColor('#ffffff', '#1e293b');
    const borderColor = useThemeColor('#e2e8f0', '#334155');

    // State
    const [showEmbeddedMap, setShowEmbeddedMap] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [currentAddress, setCurrentAddress] = useState('Loading location...');

    // Store data
    const {
        currentLocation,
        isInGeofence,
        batteryLevel,
        setIsInGeofence,
    } = useLocationStore();

    const { getCurrentGeofence, isLocationInAnyGeofence } = useGeofencing();

    // Convert enhanced location to app location format
    const convertToLocation = useCallback((enhancedLocation: any): AppLocation | null => {
        if (!enhancedLocation) return null;

        // If it already has the format of our Location type
        if (typeof enhancedLocation.latitude === 'number') {
            return enhancedLocation as AppLocation;
        }

        // If it has coords structure (EnhancedLocation), extract needed properties
        if (enhancedLocation.coords) {
            return {
                latitude: enhancedLocation.coords.latitude,
                longitude: enhancedLocation.coords.longitude,
                accuracy: enhancedLocation.coords.accuracy || null,
                altitude: enhancedLocation.coords.altitude || null,
                altitudeAccuracy: enhancedLocation.coords.altitudeAccuracy || null,
                heading: enhancedLocation.coords.heading || null,
                speed: enhancedLocation.coords.speed || null,
                timestamp: enhancedLocation.timestamp || Date.now(),
                batteryLevel: enhancedLocation.batteryLevel,
                isMoving: enhancedLocation.isMoving
            };
        }

        return null;
    }, []);

    // Handler functions for embedded map integration
    const handleMapLocationUpdate = useCallback((location: AppLocation) => {
        console.log('Map location updated:', location);

        // Update the current location in the store
        if (location.latitude && location.longitude) {
            const enhancedLocation = {
                coords: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy || null,
                    altitude: location.altitude || null,
                    altitudeAccuracy: location.altitudeAccuracy || null,
                    heading: location.heading || null,
                    speed: location.speed || null,
                },
                timestamp: typeof location.timestamp === 'string'
                    ? new Date(location.timestamp).getTime()
                    : location.timestamp || Date.now(),
                batteryLevel: location.batteryLevel,
                isMoving: location.isMoving,
            };

            useLocationStore.getState().setCurrentLocation(enhancedLocation);

            // Update address (simplified for test)
            setCurrentAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        }
    }, []);

    const handleGeofenceStatusChange = useCallback((isInside: boolean, geofenceName?: string) => {
        console.log('Geofence status changed:', { isInside, geofenceName });

        // Update geofence status in store
        const currentGeofence = getCurrentGeofence();
        setIsInGeofence(isInside, currentGeofence?.id);

        // Show alert for geofence changes
        Alert.alert(
            'Geofence Status Changed',
            isInside
                ? `Entered work area: ${geofenceName || 'Unknown'}`
                : `Exited work area: ${geofenceName || 'Unknown'}`,
            [{ text: 'OK' }]
        );
    }, [getCurrentGeofence, setIsInGeofence]);

    const handleLocationRetry = useCallback(async () => {
        try {
            setLocationError(null);
            Alert.alert('Location Retry', 'Attempting to get current location...');
            // In a real implementation, this would call getCurrentLocation()
        } catch (error) {
            console.error('Location retry failed:', error);
            setLocationError(String(error));
        }
    }, []);

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Stack.Screen
                options={{
                    title: 'ShiftTracker Map Integration Test',
                    headerStyle: { backgroundColor: cardColor },
                    headerTintColor: textColor,
                }}
            />

            <ScrollView style={styles.scrollView}>
                <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: textColor }]}>
                            Location Status
                        </Text>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: isInGeofence ? '#dcfce7' : '#fef3c7' }
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: isInGeofence ? '#166534' : '#92400e' }
                            ]}>
                                {isInGeofence ? "In Work Area" : "Outside Work Area"}
                            </Text>
                        </View>
                    </View>

                    {/* Embedded Map Section */}
                    {showEmbeddedMap && (
                        <View style={styles.mapSection}>
                            <View style={styles.mapContainer}>
                                <EmbeddedMap
                                    size={{ width: 150, height: 150 }}
                                    currentLocation={convertToLocation(currentLocation)}
                                    onLocationUpdate={handleMapLocationUpdate}
                                    onGeofenceStatusChange={handleGeofenceStatusChange}
                                    showCurrentLocation={true}
                                    showGeofences={true}
                                    style={[styles.embeddedMap, { borderColor }]}
                                />
                            </View>
                            <View style={styles.locationInfo}>
                                <View style={styles.infoItem}>
                                    <Text style={[styles.infoLabel, { color: textColor }]}>
                                        Current Position
                                    </Text>
                                    <Text style={[styles.infoValue, { color: textColor }]} numberOfLines={2}>
                                        {currentAddress}
                                    </Text>
                                </View>

                                <View style={styles.infoItem}>
                                    <Text style={[styles.infoLabel, { color: textColor }]}>
                                        Battery Level
                                    </Text>
                                    <View style={styles.batteryInfo}>
                                        <Ionicons
                                            name={
                                                batteryLevel > 75
                                                    ? "battery-full"
                                                    : batteryLevel > 45
                                                        ? "battery-half"
                                                        : batteryLevel > 15
                                                            ? "battery-half"
                                                            : "battery-dead"
                                            }
                                            size={16}
                                            color={batteryLevel > 20 ? "#10B981" : "#EF4444"}
                                        />
                                        <Text style={[
                                            styles.batteryText,
                                            { color: batteryLevel > 20 ? "#10B981" : "#EF4444" }
                                        ]}>
                                            {batteryLevel}%
                                        </Text>
                                    </View>
                                </View>

                                {/* Location accuracy indicator */}
                                {currentLocation?.coords?.accuracy && (
                                    <View style={styles.infoItem}>
                                        <Text style={[styles.infoLabel, { color: textColor }]}>
                                            GPS Accuracy
                                        </Text>
                                        <View style={styles.accuracyInfo}>
                                            <Ionicons
                                                name="radio-outline"
                                                size={16}
                                                color={
                                                    currentLocation.coords.accuracy < 10
                                                        ? "#10B981"
                                                        : currentLocation.coords.accuracy < 50
                                                            ? "#F59E0B"
                                                            : "#EF4444"
                                                }
                                            />
                                            <Text style={[
                                                styles.accuracyText,
                                                {
                                                    color: currentLocation.coords.accuracy < 10
                                                        ? "#10B981"
                                                        : currentLocation.coords.accuracy < 50
                                                            ? "#F59E0B"
                                                            : "#EF4444"
                                                }
                                            ]}>
                                                ±{Math.round(currentLocation.coords.accuracy)}m
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Geofence status indicators */}
                    <View style={styles.statusRow}>
                        <View style={styles.geofenceStatus}>
                            <Ionicons
                                name={isInGeofence ? "location" : "location-outline"}
                                size={16}
                                color={isInGeofence ? "#10B981" : "#F59E0B"}
                            />
                            <Text style={[styles.geofenceText, { color: textColor }]}>
                                {isInGeofence
                                    ? `Inside: ${getCurrentGeofence()?.name || 'Work Area'}`
                                    : 'Outside work areas'
                                }
                            </Text>
                        </View>

                        {/* Map toggle button */}
                        <TouchableOpacity
                            onPress={() => setShowEmbeddedMap(!showEmbeddedMap)}
                            style={[styles.toggleButton, { backgroundColor: borderColor }]}
                        >
                            <Text style={[styles.toggleText, { color: textColor }]}>
                                {showEmbeddedMap ? "Hide Map" : "Show Map"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Location error handling */}
                    {locationError && (
                        <View style={styles.errorContainer}>
                            <View style={styles.errorHeader}>
                                <Ionicons name="warning" size={16} color="#EF4444" />
                                <Text style={styles.errorTitle}>Location Error</Text>
                            </View>
                            <Text style={styles.errorMessage}>{locationError}</Text>
                            <TouchableOpacity
                                onPress={handleLocationRetry}
                                style={styles.retryButton}
                            >
                                <Text style={styles.retryText}>Retry Location</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Test Controls */}
                <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                    <Text style={[styles.title, { color: textColor }]}>Test Controls</Text>

                    <TouchableOpacity
                        onPress={() => {
                            // Simulate geofence entry
                            handleGeofenceStatusChange(true, 'Test Work Area');
                        }}
                        style={[styles.testButton, { backgroundColor: '#10B981' }]}
                    >
                        <Text style={styles.testButtonText}>Simulate Geofence Entry</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            // Simulate geofence exit
                            handleGeofenceStatusChange(false, 'Test Work Area');
                        }}
                        style={[styles.testButton, { backgroundColor: '#F59E0B' }]}
                    >
                        <Text style={styles.testButtonText}>Simulate Geofence Exit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            // Simulate location error
                            setLocationError('GPS signal lost. Please check your location settings.');
                        }}
                        style={[styles.testButton, { backgroundColor: '#EF4444' }]}
                    >
                        <Text style={styles.testButtonText}>Simulate Location Error</Text>
                    </TouchableOpacity>
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
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    mapSection: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    mapContainer: {
        marginRight: 16,
    },
    embeddedMap: {
        borderRadius: 12,
        borderWidth: 1,
    },
    locationInfo: {
        flex: 1,
        justifyContent: 'space-around',
    },
    infoItem: {
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 12,
        opacity: 0.7,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
    },
    batteryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    batteryText: {
        marginLeft: 4,
        fontSize: 14,
    },
    accuracyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accuracyText: {
        marginLeft: 4,
        fontSize: 14,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    geofenceStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    geofenceText: {
        marginLeft: 6,
        fontSize: 14,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    errorContainer: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
    },
    errorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    errorTitle: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#dc2626',
    },
    errorMessage: {
        fontSize: 12,
        color: '#b91c1c',
        marginBottom: 8,
    },
    retryButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#dc2626',
        borderRadius: 6,
    },
    retryText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    testButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: 'center',
    },
    testButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});