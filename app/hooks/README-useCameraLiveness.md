# useCameraLiveness Hook

## Overview

The `useCameraLiveness` hook implements sophisticated eye blink detection and liveness scoring for biometric verification. It analyzes face detection data in real-time to determine if a user is live (not a photo or video) by detecting natural eye movements and blinks.

## Features

- **Eye Blink Detection**: Detects valid eye blinks based on duration and eye state changes
- **Liveness Scoring**: Calculates a comprehensive liveness score based on multiple factors
- **Real-time Processing**: Optimized for real-time performance with frame rate control
- **Auto-capture Trigger**: Provides signals for automatic photo capture on blink detection
- **Performance Optimization**: Includes throttling and app state management for battery efficiency

## Requirements Addressed

- **1.3**: Eye blink detection for liveness verification
- **1.4**: Liveness scoring based on eye movement
- **6.1**: Performance optimization for real-time processing
- **6.4**: Auto-capture trigger on blink detection

## Usage

```typescript
import { useCameraLiveness } from '../hooks/useCameraLiveness';
import { useFaceDetection } from '../hooks/useFaceDetection';

function FaceVerificationComponent() {
  // First, get face detection data
  const { faceData, startDetection } = useFaceDetection();
  
  // Then use liveness detection
  const {
    isLivenessActive,
    blinkDetected,
    livenessScore,
    isLive,
    blinkCount,
    startLivenessDetection,
    stopLivenessDetection,
    resetLivenessState,
  } = useCameraLiveness(faceData);

  const handleStartVerification = async () => {
    await startDetection();
    startLivenessDetection();
  };

  const handleStopVerification = () => {
    stopLivenessDetection();
  };

  return (
    <View>
      <Text>Liveness Score: {(livenessScore * 100).toFixed(1)}%</Text>
      <Text>Blinks Detected: {blinkCount}</Text>
      <Text>Status: {isLive ? 'Live' : 'Not Live'}</Text>
      
      {blinkDetected && (
        <Text style={{ color: 'green' }}>Blink Detected! ✓</Text>
      )}
      
      <Button 
        title="Start Liveness Detection" 
        onPress={handleStartVerification} 
      />
      <Button 
        title="Stop Detection" 
        onPress={handleStopVerification} 
      />
      <Button 
        title="Reset" 
        onPress={resetLivenessState} 
      />
    </View>
  );
}
```

## Custom Thresholds

You can customize the liveness detection thresholds:

```typescript
const customThresholds = {
  minBlinkDuration: 80,     // Minimum blink duration in ms
  maxBlinkDuration: 600,    // Maximum blink duration in ms
  eyeClosedThreshold: 0.25, // Eye closed probability threshold
  eyeOpenThreshold: 0.75,   // Eye open probability threshold
  minLivenessScore: 0.7,    // Minimum liveness score (0-1)
  blinkTimeoutMs: 8000,     // Timeout for detection in ms
};

const liveness = useCameraLiveness(faceData, customThresholds);
```

## Return Values

### State Values
- `isLivenessActive: boolean` - Whether liveness detection is currently active
- `blinkDetected: boolean` - Whether a blink was just detected (resets after 200ms)
- `livenessScore: number` - Overall liveness score (0-1)
- `isLive: boolean` - Whether the user is considered live based on the score
- `blinkCount: number` - Total number of valid blinks detected
- `eyeMovementScore: number` - Score based on natural eye movement (0-1)
- `livenessData: LivenessDetectionData | null` - Complete liveness data object

### Control Functions
- `startLivenessDetection()` - Start liveness detection
- `stopLivenessDetection()` - Stop liveness detection
- `resetLivenessState()` - Reset all liveness state and counters

## Algorithm Details

### Blink Detection
1. **Eye State Determination**: Uses hysteresis to determine if eyes are open/closed
2. **Blink Event Detection**: Tracks eye state changes to identify complete blinks
3. **Duration Validation**: Validates blink duration (100-500ms by default)
4. **Event Recording**: Maintains a history of recent valid blinks

### Liveness Scoring
The liveness score is calculated using three components:

1. **Blink Score (40% weight)**: Based on the number of detected blinks
2. **Eye Movement Score (30% weight)**: Based on natural variations in eye open probability
3. **Recency Score (30% weight)**: Based on how recently the last blink occurred

### Performance Optimizations
- **Frame Rate Control**: Processes frames every 50ms to balance performance and accuracy
- **App State Management**: Pauses detection when app goes to background
- **Memory Management**: Maintains limited history of blink events
- **Hysteresis**: Prevents flickering in eye state detection

## Integration with Face Verification

```typescript
// Example integration with face verification modal
function FaceVerificationModal({ onSuccess, onError }) {
  const { faceData, startDetection, capturePhoto } = useFaceDetection();
  const { 
    isLive, 
    blinkDetected, 
    livenessScore,
    startLivenessDetection 
  } = useCameraLiveness(faceData);

  useEffect(() => {
    if (blinkDetected && isLive && livenessScore > 0.8) {
      // Auto-capture when high-quality blink is detected
      handleAutoCapture();
    }
  }, [blinkDetected, isLive, livenessScore]);

  const handleAutoCapture = async () => {
    try {
      const photo = await capturePhoto();
      onSuccess({
        photo,
        livenessScore,
        livenessDetected: true,
      });
    } catch (error) {
      onError(error);
    }
  };

  // ... rest of component
}
```

## Error Handling

The hook includes robust error handling:
- Graceful degradation when face data is unavailable
- App state change handling for battery optimization
- Memory cleanup on unmount
- Performance throttling to prevent excessive processing

## Testing

The hook can be tested with mock face data:

```typescript
const mockFaceData = {
  bounds: { x: 100, y: 100, width: 200, height: 250 },
  leftEyeOpenProbability: 0.8,
  rightEyeOpenProbability: 0.8,
  faceId: 'test_face',
  rollAngle: 0,
  yawAngle: 0,
};

// Test blink detection by varying eye probabilities
const blinkSequence = [
  { ...mockFaceData, leftEyeOpenProbability: 0.8, rightEyeOpenProbability: 0.8 }, // Open
  { ...mockFaceData, leftEyeOpenProbability: 0.2, rightEyeOpenProbability: 0.2 }, // Closed
  { ...mockFaceData, leftEyeOpenProbability: 0.8, rightEyeOpenProbability: 0.8 }, // Open
];
```

## Security Considerations

- The hook only processes eye movement data, not actual images
- All processing is done locally on the device
- No biometric data is stored permanently
- Liveness detection helps prevent spoofing attacks

## Performance Metrics

- **Processing Interval**: 50ms (20 FPS)
- **Memory Usage**: Minimal (only stores recent blink events)
- **Battery Impact**: Optimized with app state management
- **Accuracy**: Tuned for natural human blink patterns (100-500ms duration)