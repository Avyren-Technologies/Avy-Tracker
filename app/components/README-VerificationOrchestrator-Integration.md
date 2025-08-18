# Verification Orchestrator Integration Guide

## Overview

The `VerificationOrchestrator` component provides a comprehensive verification flow system that orchestrates location and face verification for shift start/end operations. It implements sequential verification steps with fallback logic, confidence scoring, and audit logging.

## Features

- **Sequential Verification**: Location verification followed by face verification
- **Fallback Logic**: Continue with partial verification if one step fails
- **Confidence Scoring**: Calculate overall verification confidence
- **Audit Logging**: Comprehensive logging for compliance and debugging
- **Performance Monitoring**: Track verification latency and performance metrics
- **Manager Override**: OTP-based override system for failed verifications
- **Offline Support**: Queue verification data when offline

## Integration with ShiftTracker

### 1. Import Required Components

```typescript
import VerificationOrchestrator from '../../components/VerificationOrchestrator';
import { VerificationFlowSummary } from '../../types/verification';
```

### 2. Add State Management

```typescript
const [showVerificationModal, setShowVerificationModal] = useState(false);
const [pendingShiftAction, setPendingShiftAction] = useState<'start' | 'end' | null>(null);
const [verificationConfig, setVerificationConfig] = useState({
  requireLocation: true,
  requireFace: true,
  allowLocationFallback: true,
  allowFaceFallback: true,
  maxRetries: 3,
  timeoutMs: 30000,
  confidenceThreshold: 0.7,
});
```

### 3. Create Location Verification Function

```typescript
const performLocationVerification = useCallback(async (): Promise<LocationResult> => {
  try {
    // Get current location
    const location = await getCurrentLocation();
    if (!location) {
      return { success: false, error: 'Unable to get current location' };
    }

    // Check geofence status
    const appLocation = convertToLocation(location);
    const isInside = isLocationInAnyGeofence(appLocation);
    const currentGeofence = getCurrentGeofence();
    
    return {
      success: true,
      latitude: appLocation.latitude,
      longitude: appLocation.longitude,
      accuracy: appLocation.accuracy || undefined,
      isInGeofence: isInside,
      geofenceName: currentGeofence?.name,
      confidence: isInside ? 0.9 : 0.6, // Higher confidence if in geofence
    };
  } catch (error) {
    console.error('Location verification failed:', error);
    return {
      success: false,
      error: 'Location verification failed'
    };
  }
}, [getCurrentLocation, isLocationInAnyGeofence, getCurrentGeofence]);
```

### 4. Modify Shift Start/End Functions

```typescript
const handleShiftStart = useCallback(async () => {
  // Check if verification is required
  const requiresVerification = await checkVerificationRequirements();
  
  if (requiresVerification) {
    setPendingShiftAction('start');
    setShowVerificationModal(true);
  } else {
    // Proceed with normal shift start
    await executeShiftStart();
  }
}, []);

const handleShiftEnd = useCallback(async () => {
  // Check if verification is required
  const requiresVerification = await checkVerificationRequirements();
  
  if (requiresVerification) {
    setPendingShiftAction('end');
    setShowVerificationModal(true);
  } else {
    // Proceed with normal shift end
    await executeShiftEnd();
  }
}, []);
```

### 5. Handle Verification Results

```typescript
const handleVerificationSuccess = useCallback(async (summary: VerificationFlowSummary) => {
  console.log('Verification completed successfully:', summary);
  setShowVerificationModal(false);
  
  try {
    // Execute the pending shift action with verification data
    if (pendingShiftAction === 'start') {
      await executeShiftStart(summary);
    } else if (pendingShiftAction === 'end') {
      await executeShiftEnd(summary);
    }
  } catch (error) {
    console.error('Error executing shift action after verification:', error);
    showInAppNotification('Shift action failed after verification', 'error');
  } finally {
    setPendingShiftAction(null);
  }
}, [pendingShiftAction]);

const handleVerificationCancel = useCallback(() => {
  setShowVerificationModal(false);
  setPendingShiftAction(null);
  showInAppNotification('Verification cancelled', 'info');
}, []);

const handleVerificationError = useCallback((error: string) => {
  setShowVerificationModal(false);
  setPendingShiftAction(null);
  showInAppNotification(error, 'error');
}, []);
```

### 6. Add Verification Modal to JSX

```typescript
{/* Verification Orchestrator Modal */}
<VerificationOrchestrator
  visible={showVerificationModal}
  userId={user?.id || 0}
  token={token || ''}
  shiftAction={pendingShiftAction || 'start'}
  config={verificationConfig}
  onSuccess={handleVerificationSuccess}
  onCancel={handleVerificationCancel}
  onError={handleVerificationError}
  locationVerificationFn={performLocationVerification}
  canOverrideGeofence={user?.can_override_geofence || false}
/>
```

## Configuration Options

### VerificationConfig

```typescript
interface VerificationConfig {
  requireLocation: boolean;        // Require location verification
  requireFace: boolean;           // Require face verification
  allowLocationFallback: boolean; // Allow face-only if location fails
  allowFaceFallback: boolean;     // Allow location-only if face fails
  maxRetries: number;             // Maximum retry attempts per step
  timeoutMs: number;              // Timeout for each verification step
  confidenceThreshold: number;    // Minimum confidence score required
}
```

### Role-Based Configuration

```typescript
const getVerificationConfig = (userRole: string): Partial<VerificationConfig> => {
  switch (userRole) {
    case 'employee':
      return {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: false,
        allowFaceFallback: true,
        maxRetries: 3,
      };
    case 'group-admin':
      return {
        requireLocation: true,
        requireFace: false, // Optional for admins
        allowLocationFallback: true,
        allowFaceFallback: true,
        maxRetries: 2,
      };
    case 'management':
      return {
        requireLocation: false, // Optional for management
        requireFace: false,
        allowLocationFallback: true,
        allowFaceFallback: true,
        maxRetries: 1,
      };
    default:
      return {};
  }
};
```

## Performance Monitoring

The verification orchestrator automatically monitors performance metrics:

- **Total Latency**: Time from start to completion
- **Step Latency**: Time for each verification step
- **Retry Count**: Number of retry attempts
- **Confidence Score**: Overall verification confidence
- **Fallback Mode**: Whether fallback logic was used

### Performance Thresholds

- **Warning**: Total latency > 30 seconds
- **Error**: Total latency > 60 seconds
- **Low Confidence**: Confidence score < 50%
- **High Retry**: More than 2 retries per step

## Error Handling

### Common Error Scenarios

1. **Location Service Disabled**: Show settings prompt
2. **Camera Permission Denied**: Request permission
3. **Network Timeout**: Queue for offline sync
4. **Face Not Detected**: Provide positioning guidance
5. **Low Confidence**: Allow retry or override

### Fallback Strategies

1. **Location Fails + Face Succeeds**: Continue with face verification
2. **Face Fails + Location Succeeds**: Continue with location verification
3. **Both Fail**: Offer manager override option
4. **Timeout**: Allow manual retry or skip

## Security Considerations

- **Audit Logging**: All verification attempts are logged
- **Encryption**: Biometric data is encrypted at rest
- **Rate Limiting**: Prevent brute force attempts
- **Device Fingerprinting**: Track device characteristics
- **Manager Override**: Requires OTP verification

## Testing

### Unit Tests

```typescript
// Test verification flow initialization
test('should initialize verification flow correctly', async () => {
  const flow = await initializeVerificationFlow(123, 'start');
  expect(flow.sessionId).toBeDefined();
  expect(flow.steps).toHaveLength(2);
});

// Test fallback logic
test('should enable fallback mode when location fails', async () => {
  const flow = await initializeVerificationFlow(123, 'start');
  // Simulate location failure
  const updatedFlow = await executeNextVerificationStep(
    flow,
    async () => ({ success: false, error: 'Location failed' })
  );
  expect(updatedFlow.fallbackMode).toBe(true);
});
```

### Integration Tests

```typescript
// Test complete verification flow
test('should complete verification flow successfully', async () => {
  const mockLocationFn = jest.fn().mockResolvedValue({
    success: true,
    latitude: 12.9716,
    longitude: 77.5946,
    isInGeofence: true,
  });
  
  const mockFaceFn = jest.fn().mockResolvedValue({
    success: true,
    confidence: 0.85,
    livenessDetected: true,
  });
  
  const flow = await initializeVerificationFlow(123, 'start');
  const result = await executeNextVerificationStep(flow, mockLocationFn, mockFaceFn);
  
  expect(result.overallStatus).toBe('completed');
  expect(result.confidenceScore).toBeGreaterThan(0.7);
});
```

## Troubleshooting

### Common Issues

1. **Verification Stuck**: Check network connectivity and permissions
2. **Low Performance**: Reduce verification timeout or steps
3. **High Failure Rate**: Adjust confidence thresholds
4. **Audit Log Missing**: Verify database connection and permissions

### Debug Mode

Enable debug logging by setting:

```typescript
const DEBUG_VERIFICATION = __DEV__ || process.env.DEBUG_VERIFICATION === 'true';
```

This will provide detailed console logs for troubleshooting verification issues.