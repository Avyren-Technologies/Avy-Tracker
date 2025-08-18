import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  FaceBounds,
  FaceDetectionData,
  CapturedPhoto,
  FaceDetectionOptions,
  UseFaceDetectionReturn,
  FaceQuality,
  CameraPermissionStatus
} from '../types/faceDetection';

// Face quality validation thresholds
const QUALITY_THRESHOLDS = {
  MIN_FACE_SIZE: 0.1, // 10% of screen
  MAX_FACE_SIZE: 0.8, // 80% of screen
  MIN_LIGHTING: 0.3,
  MAX_ANGLE: 30, // degrees
  MIN_EYE_OPEN_PROBABILITY: 0.7,
};

export function useFaceDetection(options: FaceDetectionOptions = {}): UseFaceDetectionReturn {
  const {
    performanceMode = 'fast',
    enableLivenessDetection = true,
    minFaceSize = QUALITY_THRESHOLDS.MIN_FACE_SIZE,
    maxFaceSize = QUALITY_THRESHOLDS.MAX_FACE_SIZE,
    qualityThreshold = 0.7,
    lightingThreshold = QUALITY_THRESHOLDS.MIN_LIGHTING,
    angleThreshold = QUALITY_THRESHOLDS.MAX_ANGLE,
  } = options;

  // State management
  const [isDetecting, setIsDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceData, setFaceData] = useState<FaceDetectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<CameraPermissionStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [faceQuality, setFaceQuality] = useState<FaceQuality | null>(null);

  // Refs for cleanup and lifecycle management
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isMountedRef = useRef(true);
  const cameraRef = useRef<any>(null);

  // Request camera permissions
  const requestCameraPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Note: In a real implementation, this would use react-native-vision-camera
      // For now, we'll simulate the permission request
      console.log('Requesting camera permissions...');
      
      // Simulate permission request delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // In real implementation:
      // const permission = await Camera.requestCameraPermission();
      // setCameraPermissionStatus(permission);
      // return permission === 'authorized';
      
      // For simulation, assume permission is granted
      setCameraPermissionStatus('authorized');
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to request camera permissions';
      setError(errorMsg);
      setCameraPermissionStatus('denied');
      return false;
    }
  }, []);

  // Initialize camera and face detection
  const initializeCamera = useCallback(async (): Promise<boolean> => {
    try {
      if (!isMountedRef.current) return false;

      setError(null);
      
      // Request permissions first
      const hasPermission = await requestCameraPermissions();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      // Initialize camera (simulated)
      console.log('Initializing camera with performance mode:', performanceMode);
      
      // In real implementation, this would initialize react-native-vision-camera
      // with face detection plugin
      
      // Simulate initialization delay (requirement: complete within 3 seconds)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!isMountedRef.current) return false;
      
      setIsInitialized(true);
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to initialize camera';
      setError(errorMsg);
      setIsInitialized(false);
      return false;
    }
  }, [performanceMode, requestCameraPermissions]);

  // Validate face quality
  const validateFaceQuality = useCallback((face: FaceDetectionData): FaceQuality & { isValid: boolean } => {
    // Calculate face size relative to screen
    const faceArea = face.bounds.width * face.bounds.height;
    const screenArea = 1; // Normalized to 1
    const faceSize = faceArea / screenArea;
    
    // Size quality (0-1)
    let sizeQuality = 0;
    if (faceSize >= minFaceSize && faceSize <= maxFaceSize) {
      sizeQuality = 1 - Math.abs(faceSize - 0.3) / 0.3; // Optimal at 30% of screen
    }
    sizeQuality = Math.max(0, Math.min(1, sizeQuality));

    // Lighting quality (simulated based on eye open probability)
    const lightingQuality = Math.min(
      face.leftEyeOpenProbability + 0.2,
      face.rightEyeOpenProbability + 0.2
    );

    // Angle quality (based on roll and yaw angles)
    const maxAngle = Math.max(Math.abs(face.rollAngle), Math.abs(face.yawAngle));
    const angleQuality = Math.max(0, 1 - maxAngle / angleThreshold);

    // Overall quality score
    const overall = (sizeQuality * 0.4 + lightingQuality * 0.3 + angleQuality * 0.3);
    
    const quality = {
      lighting: lightingQuality,
      size: sizeQuality,
      angle: angleQuality,
      overall,
      isValid: overall >= qualityThreshold
    };

    return quality;
  }, [minFaceSize, maxFaceSize, angleThreshold, qualityThreshold]);

  // Process face detection results
  const processFaceDetection = useCallback((detectedFaces: any[]) => {
    if (!isMountedRef.current) return;

    try {
      if (detectedFaces.length === 0) {
        setFaceDetected(false);
        setFaceData(null);
        setFaceQuality(null);
        return;
      }

      if (detectedFaces.length > 1) {
        setError('Multiple faces detected. Please ensure only one face is visible.');
        return;
      }

      // Process the single detected face
      const face = detectedFaces[0];
      
      // Convert to our FaceDetectionData format
      const faceData: FaceDetectionData = {
        bounds: {
          x: face.bounds?.x || 0,
          y: face.bounds?.y || 0,
          width: face.bounds?.width || 0,
          height: face.bounds?.height || 0,
        },
        leftEyeOpenProbability: face.leftEyeOpenProbability || 0,
        rightEyeOpenProbability: face.rightEyeOpenProbability || 0,
        faceId: face.faceId || `face_${Date.now()}`,
        rollAngle: face.rollAngle || 0,
        yawAngle: face.yawAngle || 0,
      };

      // Validate face quality
      const quality = validateFaceQuality(faceData);
      
      setFaceData(faceData);
      setFaceDetected(true);
      setFaceQuality(quality);
      
      // Clear error if face is detected successfully
      if (quality.isValid) {
        setError(null);
      } else {
        // Provide specific guidance based on quality issues
        let guidance = 'Please adjust your position: ';
        const issues = [];
        
        if (quality.size < 0.5) {
          issues.push('move closer to the camera');
        } else if (quality.size > 0.8) {
          issues.push('move further from the camera');
        }
        
        if (quality.lighting < 0.5) {
          issues.push('ensure better lighting');
        }
        
        if (quality.angle < 0.5) {
          issues.push('look straight at the camera');
        }
        
        if (issues.length > 0) {
          setError(guidance + issues.join(', '));
        }
      }
    } catch (error: any) {
      console.error('Error processing face detection:', error);
      setError('Error processing face detection');
    }
  }, [validateFaceQuality]);

  // Start face detection
  const startDetection = useCallback(async (): Promise<boolean> => {
    try {
      if (!isMountedRef.current) return false;

      // Initialize camera if not already done
      if (!isInitialized) {
        const initialized = await initializeCamera();
        if (!initialized) return false;
      }

      setIsDetecting(true);
      setError(null);

      // In real implementation, this would start the camera and face detection
      // For simulation, we'll create a mock detection loop
      console.log('Starting face detection with options:', {
        performanceMode,
        enableLivenessDetection,
        qualityThreshold
      });

      // Simulate face detection updates
      detectionIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current || !isDetecting) return;

        // Simulate face detection results
        const mockFaces = [{
          bounds: { x: 100, y: 100, width: 200, height: 250 },
          leftEyeOpenProbability: 0.8 + Math.random() * 0.2,
          rightEyeOpenProbability: 0.8 + Math.random() * 0.2,
          faceId: 'mock_face_1',
          rollAngle: (Math.random() - 0.5) * 20,
          yawAngle: (Math.random() - 0.5) * 20,
        }];

        processFaceDetection(mockFaces);
      }, performanceMode === 'fast' ? 100 : 200);

      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start face detection';
      setError(errorMsg);
      setIsDetecting(false);
      return false;
    }
  }, [isInitialized, initializeCamera, performanceMode, enableLivenessDetection, qualityThreshold, processFaceDetection, isDetecting]);

  // Stop face detection
  const stopDetection = useCallback(() => {
    try {
      setIsDetecting(false);
      setFaceDetected(false);
      setFaceData(null);
      setFaceQuality(null);

      // Clear detection interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      console.log('Face detection stopped');
    } catch (error: any) {
      console.error('Error stopping face detection:', error);
      setError('Error stopping face detection');
    }
  }, []);

  // Capture photo
  const capturePhoto = useCallback(async (): Promise<CapturedPhoto> => {
    try {
      if (!isInitialized) {
        throw new Error('Camera not initialized');
      }

      if (!faceDetected || !faceData) {
        throw new Error('No face detected');
      }

      // Validate face quality before capture
      if (faceQuality && faceQuality.overall < qualityThreshold) {
        throw new Error('Face quality too low for capture');
      }

      console.log('Capturing photo...');

      // In real implementation, this would capture from react-native-vision-camera
      // For simulation, create a mock photo
      const photo: CapturedPhoto = {
        uri: `mock://photo_${Date.now()}.jpg`,
        width: 640,
        height: 480,
        base64: 'mock_base64_data',
        timestamp: Date.now(),
      };

      // Store photo securely if needed
      try {
        await SecureStore.setItemAsync(
          `face_photo_${Date.now()}`,
          JSON.stringify({
            uri: photo.uri,
            timestamp: photo.timestamp,
            faceData: faceData,
            quality: faceQuality
          })
        );
      } catch (storageError) {
        console.warn('Failed to store photo securely:', storageError);
      }

      return photo;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to capture photo';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [isInitialized, faceDetected, faceData, faceQuality, qualityThreshold]);

  // Handle app state changes for camera lifecycle management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!isMountedRef.current) return;

      console.log(`Face detection app state changed: ${appStateRef.current} -> ${nextAppState}`);

      // App going to background - pause camera operations
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isDetecting) {
          console.log('App backgrounded - pausing face detection');
          stopDetection();
        }
      }
      // App coming to foreground - can resume if needed
      else if (appStateRef.current?.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App foregrounded - face detection can be resumed');
        // Note: Don't auto-resume, let the component decide
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isDetecting, stopDetection]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      // Stop detection
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      
      // Cleanup camera resources
      if (cameraRef.current) {
        // In real implementation, cleanup camera resources
        console.log('Cleaning up camera resources');
      }
    };
  }, []);

  return {
    isDetecting,
    faceDetected,
    faceData,
    startDetection,
    stopDetection,
    capturePhoto,
    error,
    cameraPermissionStatus,
    isInitialized,
    faceQuality,
  };
}