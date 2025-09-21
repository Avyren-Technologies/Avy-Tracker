import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Region } from "react-native-maps";

// Default map settings
const BANGALORE_REGION: Region = {
  // Default to Bangalore, Karnataka
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

// Debug logging function
const log = (action: string, data?: any) => {
  console.log(`[LocationStore] ${action}`, data || "");
};

interface LocationState {
  // Current location for any user role
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  } | null;

  // Map region for initialRegion props
  mapInitialRegion: Region;

  // Status flags
  isLoading: boolean;
  hasLoadedLocation: boolean;
  error: string | null;

  // User role for role-specific behavior
  userRole: string | null;

  // Actions
  setCurrentLocation: (location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }, role?: string) => void;
  fetchLocation: () => Promise<void>;
  resetLocationError: () => void;
  setUserRole: (role: string) => void;
}

const useUserLocationStore = create(
  persist<LocationState>(
    (set, get) => ({
      currentLocation: null,
      mapInitialRegion: BANGALORE_REGION,
      isLoading: false,
      hasLoadedLocation: false,
      error: null,
      userRole: null,

      setCurrentLocation: (location: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      }, role?: string) => {
        log("Setting location", { location, role });

        // Create the region object suitable for map initialRegion prop
        const mapRegion: Region = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01, // Zoomed in for better visibility
          longitudeDelta: 0.01,
        };

        set({
          currentLocation: {
            ...location,
            timestamp: Date.now(),
          },
          mapInitialRegion: mapRegion,
          hasLoadedLocation: true,
          isLoading: false,
          userRole: role || get().userRole,
        });
      },

      fetchLocation: async () => {
        const state = get();

        // Don't refetch if we're already loading
        if (state.isLoading) {
          log("Already fetching location, skipping");
          return;
        }

        set({ isLoading: true, error: null });
        log("Fetching location...", { role: state.userRole });

        try {
          // First check for location permissions
          const { status } = await Location.requestForegroundPermissionsAsync();

          if (status !== "granted") {
            log("Location permission denied");
            set({
              error: "Location permission denied",
              isLoading: false,
              // Keep using Bangalore as fallback
              mapInitialRegion: BANGALORE_REGION,
            });
            return;
          }

          // Get current position with high accuracy
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });

          log("Location obtained successfully", location.coords);

          // Format the location and update state
          const currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          };

          get().setCurrentLocation(currentLocation, state.userRole || undefined);
        } catch (error) {
          log("Error fetching location", error);
          set({
            error: `Location error: ${error instanceof Error ? error.message : String(error)}`,
            isLoading: false,
            // Keep using Bangalore as fallback
            mapInitialRegion: BANGALORE_REGION,
          });
        }
      },

      resetLocationError: () => set({ error: null }),
      setUserRole: (role: string) => {
        log("Setting user role", role);
        set({ userRole: role });
      },
    }),
    {
      name: "user-location-storage", // Different name to avoid conflicts
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// Export with new name to avoid conflict with existing locationStore
export default useUserLocationStore;

// Backward compatibility exports
export const useAdminLocationStore = useUserLocationStore;
export const useLocationStore = useUserLocationStore;

// Re-export types for backward compatibility
export type { LocationState };
