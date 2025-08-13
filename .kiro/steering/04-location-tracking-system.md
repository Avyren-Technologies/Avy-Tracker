# Location Tracking & Geofencing System

## Location Tracking Architecture

### Core Components
- **Background Location Task** (`app/utils/backgroundLocationTask.ts`)
- **Location Store** (`app/store/locationStore.ts`)
- **Tracking Context** (`app/context/TrackingContext.tsx`)
- **Location Utilities** (`app/utils/locationUtils.ts`)
- **Geofence Store** (`app/store/geofenceStore.ts`)

### Location Permissions
```typescript
// Permission request flow
const requestLocationPermissions = async () => {
  // Request foreground permissions first
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  
  if (foregroundStatus !== 'granted') {
    throw new Error('Foreground location permission denied');
  }
  
  // Request background permissions for continuous tracking
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  
  if (backgroundStatus !== 'granted') {
    console.warn('Background location permission denied - limited tracking available');
  }
  
  return { foregroundStatus, backgroundStatus };
};
```

### Background Location Tracking
The app implements sophisticated background location tracking:

#### Task Registration
```typescript
// Background task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as any;
    await processLocationUpdates(locations);
  }
});
```

#### Location Processing
- **Accuracy Filtering**: Filter out low-accuracy GPS readings
- **Movement Detection**: Identify when user is stationary vs moving
- **Battery Optimization**: Adjust tracking frequency based on movement
- **Data Batching**: Batch location updates for efficient network usage

### Geofencing System

#### Geofence Creation
```typescript
interface Geofence {
  id: number;
  company_id: number;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
  created_by: number;
}
```

#### Geofence Detection
- **Entry Detection**: Trigger when employee enters geofenced area
- **Exit Detection**: Trigger when employee leaves geofenced area
- **Dwell Time**: Track time spent within geofenced areas
- **Multiple Geofences**: Handle overlapping geofence boundaries

#### Database Schema
```sql
-- Company geofences table
CREATE TABLE company_geofences (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  coordinates GEOGRAPHY(Point, 4326) NOT NULL,
  radius NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Geofence events tracking
CREATE TABLE geofence_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  geofence_id INTEGER NOT NULL REFERENCES company_geofences(id),
  shift_id INTEGER NOT NULL REFERENCES employee_shifts(id),
  event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry', 'exit')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Shift Management Integration

### Shift Lifecycle
1. **Shift Start**: Employee starts shift with location verification
2. **Active Tracking**: Continuous location tracking during shift
3. **Geofence Monitoring**: Track entry/exit from designated areas
4. **Break Management**: Handle break periods and location pausing
5. **Shift End**: End shift with final location and summary

### Location-Verified Attendance
```typescript
const startShift = async (location: LocationData) => {
  // Verify location is within acceptable range
  const isValidLocation = await validateShiftLocation(location);
  
  if (!isValidLocation) {
    throw new Error('Invalid location for shift start');
  }
  
  // Create shift record with starting location
  const shift = await createShift({
    user_id: userId,
    start_time: new Date(),
    location_start: {
      latitude: location.latitude,
      longitude: location.longitude
    },
    status: 'active'
  });
  
  // Start background location tracking
  await startLocationTracking(shift.id);
  
  return shift;
};
```

### Travel Analytics
- **Distance Calculation**: Calculate total distance traveled during shifts
- **Route Tracking**: Store GPS breadcrumbs for route analysis
- **Speed Analysis**: Monitor travel speeds and patterns
- **Efficiency Metrics**: Analyze route efficiency and optimization opportunities

## Real-Time Location Features

### Live Tracking Dashboard
Group Admins and Management can view real-time employee locations:

```typescript
// Socket.IO integration for live updates
const LocationSocketService = {
  // Emit location updates to authorized viewers
  broadcastLocationUpdate: (userId: string, location: LocationData) => {
    io.to(`company_${companyId}`).emit('location_update', {
      userId,
      location,
      timestamp: new Date()
    });
  },
  
  // Handle client connections for live tracking
  handleConnection: (socket: Socket) => {
    socket.on('join_company_room', (companyId: string) => {
      socket.join(`company_${companyId}`);
    });
  }
};
```

### Location Data Structure
```typescript
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  is_moving: boolean;
  battery_level?: number;
  is_outdoor: boolean;
}
```

## Privacy & Security

### Data Protection
- **Encryption**: Encrypt location data in transit and at rest
- **Access Control**: Strict role-based access to location data
- **Data Retention**: Implement data retention policies
- **User Consent**: Explicit consent for location tracking

### Privacy Controls
```typescript
// User privacy settings
interface LocationPrivacySettings {
  allow_tracking: boolean;
  tracking_precision: 'low' | 'medium' | 'high';
  share_with_team: boolean;
  location_history_retention_days: number;
}
```

### Compliance Features
- **GDPR Compliance**: Right to data deletion and portability
- **Location Audit Trail**: Track who accessed location data when
- **Consent Management**: Manage and track user consent
- **Data Minimization**: Only collect necessary location data

## Performance Optimization

### Battery Management
```typescript
// Adaptive tracking based on movement and battery
const optimizeTracking = (batteryLevel: number, isMoving: boolean) => {
  let interval = 30000; // Default 30 seconds
  
  if (batteryLevel < 20) {
    interval = 120000; // 2 minutes for low battery
  } else if (!isMoving) {
    interval = 60000; // 1 minute when stationary
  } else if (isMoving) {
    interval = 15000; // 15 seconds when moving
  }
  
  return interval;
};
```

### Data Efficiency
- **Location Filtering**: Remove redundant location points
- **Compression**: Compress location data for storage
- **Batch Processing**: Process locations in batches
- **Caching**: Cache frequently accessed location data

### Network Optimization
- **Offline Storage**: Store locations locally when offline
- **Sync on Connect**: Upload stored locations when connection restored
- **Compression**: Compress location payloads
- **Error Handling**: Robust error handling for network issues

This location tracking system provides comprehensive workforce monitoring while maintaining privacy and performance standards.