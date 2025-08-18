# EmbeddedMap Component

## Overview

The `EmbeddedMap` component is a compact, embedded map display designed for the Enhanced ShiftTracker feature. It provides a 150x150px (default) map view with current location and geofence visualization, along with tap-to-expand functionality for a full-screen map experience.

## Features

### Core Features
- **Fixed-size display**: Default 150x150px, customizable size
- **Current location marker**: Custom location marker with accuracy ring
- **Geofence overlays**: Circle overlays for geofenced areas
- **Dynamic geofence labels**: Labels showing geofence names
- **Tap-to-expand**: Tap the embedded map to open full-screen view
- **Dark mode support**: Automatic dark/light theme switching

### Full-screen Features
- **Full-screen map view**: Expanded map with controls
- **Location refresh**: Manual location update button
- **Close control**: Easy exit from full-screen mode
- **Info panel**: Location details and geofence status
- **Map controls**: Compass, scale, and zoom controls

## Props

```typescript
interface EmbeddedMapProps {
  size?: { width: number; height: number };           // Default: { width: 150, height: 150 }
  currentLocation?: LocationType | null;              // Current location data
  geofences?: Geofence[];                            // Array of geofences to display
  onLocationUpdate?: (location: LocationType) => void; // Callback for location updates
  onGeofenceStatusChange?: (isInside: boolean, geofenceName?: string) => void; // Geofence status callback
  showCurrentLocation?: boolean;                      // Default: true
  showGeofences?: boolean;                           // Default: true
  style?: any;                                       // Additional styling
}
```

## Usage Examples

### Basic Usage
```typescript
import EmbeddedMap from '../components/EmbeddedMap';

// Basic embedded map with default size
<EmbeddedMap
  currentLocation={currentLocation}
  geofences={geofences}
  onLocationUpdate={handleLocationUpdate}
  onGeofenceStatusChange={handleGeofenceStatusChange}
/>
```

### Custom Size
```typescript
// Custom sized embedded map
<EmbeddedMap
  size={{ width: 200, height: 120 }}
  currentLocation={currentLocation}
  geofences={geofences}
  showCurrentLocation={true}
  showGeofences={true}
/>
```

### Location Only (No Geofences)
```typescript
// Map showing only current location
<EmbeddedMap
  currentLocation={currentLocation}
  showCurrentLocation={true}
  showGeofences={false}
/>
```

### With Callbacks
```typescript
const handleLocationUpdate = (location: LocationType) => {
  console.log('Location updated:', location);
  // Handle location update
};

const handleGeofenceStatusChange = (isInside: boolean, geofenceName?: string) => {
  console.log('Geofence status:', { isInside, geofenceName });
  // Handle geofence status change
};

<EmbeddedMap
  currentLocation={currentLocation}
  geofences={geofences}
  onLocationUpdate={handleLocationUpdate}
  onGeofenceStatusChange={handleGeofenceStatusChange}
/>
```

## Integration with ShiftTracker

The component is designed to integrate seamlessly with the ShiftTracker component:

```typescript
// In ShiftTracker component
import EmbeddedMap from '../components/EmbeddedMap';

const ShiftTracker = () => {
  const { currentLocation, isInGeofence } = useLocationStore();
  const { geofences } = useGeofenceStore();

  return (
    <View style={styles.container}>
      {/* Other ShiftTracker content */}
      
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>Current Location</Text>
        <EmbeddedMap
          currentLocation={currentLocation}
          geofences={geofences}
          onLocationUpdate={handleLocationUpdate}
          onGeofenceStatusChange={handleGeofenceStatusChange}
        />
      </View>
      
      {/* Other ShiftTracker content */}
    </View>
  );
};
```

## Store Integration

The component automatically integrates with the following stores:

- **useLocationStore**: For current location and geofence status
- **useGeofenceStore**: For geofence data
- **Theme system**: For dark/light mode support

## Visual Indicators

### Embedded Map Indicators
- **Expand indicator**: Top-right corner expand icon
- **Status indicator**: Top-left corner geofence status (when inside geofence)
- **Location marker**: Custom blue dot with accuracy ring
- **Geofence circles**: Colored circles with different colors for current/other geofences

### Full-screen Map Features
- **Header controls**: Location refresh and close buttons
- **Info panel**: Location coordinates, accuracy, and geofence status
- **Map controls**: Standard map controls (compass, scale, zoom)

## Styling

The component supports both light and dark themes:

### Light Theme
- White background with subtle borders
- Blue primary colors
- Light gray secondary colors

### Dark Theme
- Dark background with light borders
- Light blue primary colors
- Custom dark map style

## Requirements Fulfilled

This component fulfills the following requirements from the Enhanced ShiftTracker specification:

- **3.1**: 150x150px fixed-size map display ✅
- **3.2**: Custom current location marker ✅
- **3.3**: Geofence polygon overlays ✅
- **3.4**: Dynamic geofence labels ✅
- **3.5**: Tap-to-expand functionality ✅
- **3.7**: Full-screen map view with controls ✅
- **Dark mode support**: Custom dark map styling ✅

## Testing

A test component is available at `app/(testing)/embedded-map-test.tsx` which demonstrates:

- Different map sizes
- Location permission handling
- Geofence status monitoring
- Mock geofence data
- Full-screen functionality

## Dependencies

- `react-native-maps`: For map display and overlays
- `expo-location`: For location services
- `@expo/vector-icons`: For icons
- Store integration: `useLocationStore`, `useGeofenceStore`
- Theme system: `useColorScheme`, `useThemeColor`

## Performance Considerations

- Memoized map content rendering to prevent unnecessary re-renders
- Efficient geofence processing with validation
- Optimized location updates with distance-based filtering
- Lazy loading of full-screen map components