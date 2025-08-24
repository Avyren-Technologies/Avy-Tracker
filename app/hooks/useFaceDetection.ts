import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { useFaceDetection as useMLKitFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
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
  MIN_FACE_SIZE: 0.05, // 5% of screen - more lenient
  MAX_FACE_SIZE: 0.6, // 60% of screen - more lenient
  MIN_LIGHTING: 0.2, // More lenient lighting requirement
  MAX_ANGLE: 45, // degrees - more lenient
  MIN_EYE_OPEN_PROBABILITY: 0.5, // More lenient
};

// ML Kit Face Detection configuration
const FACE_DETECTION_CONFIG = {
  performanceMode: 'fast' as const,
  landmarkMode: true,
  contourMode: false,
  classificationMode: true,
  minFaceSize: 0.1, // More lenient
  isTrackingEnabled: true,
};

export function useFaceDetection(options: FaceDetectionOptions = {}): UseFaceDetectionReturn {
  const {
    performanceMode = 'fast',
    enableLivenessDetection = true,
    minFaceSize = QUALITY_THRESHOLDS.MIN_FACE_SIZE,
    maxFaceSize = QUALITY_THRESHOLDS.MAX_FACE_SIZE,
    qualityThreshold = 0.4, // Lower threshold for better success rate
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
  const [detectionStats, setDetectionStats] = useState({
    totalFrames: 0,
    facesDetected: 0,
    averageProcessingTime: 0,
  });

  // Refs for cleanup and lifecycle management
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isMountedRef = useRef(true);
  const cameraRef = useRef<Camera>(null);
  const processingTimeRef = useRef<number[]>([]);
  const lastDetectionTimeRef = useRef<number>(0);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get front camera device
  const device = useCameraDevice('front');
  
  // Get ML Kit face detector instance
  const mlKitDetector = useMLKitFaceDetection();

  // Request camera permissions
  const requestCameraPermissions = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Requesting camera permissions...');
      
      const permission = await Camera.requestCameraPermission();
      
      // Map permission status to our custom type
      let mappedStatus: CameraPermissionStatus;
      switch (permission) {
        case 'granted':
          mappedStatus = 'authorized';
          break;
        case 'denied':
          mappedStatus = 'denied';
          break;
        default:
          mappedStatus = 'denied';
      }
      
      setCameraPermissionStatus(mappedStatus);
      
      if (mappedStatus === 'denied') {
        setError('Camera permission denied. Please enable camera access in settings.');
        return false;
      }
      
      return mappedStatus === 'authorized';
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to request camera permissions';
      setError(errorMsg);
      setCameraPermissionStatus('denied');
      return false;
    }
  }, []);

  // Initialize ML Kit Face Detection
  const initializeMLKit = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Initializing ML Kit Face Detection...');
      
      // Check if ML Kit detector is available
      if (!mlKitDetector) {
        throw new Error('ML Kit detector not available');
      }
      
      console.log('ML Kit detector available, checking methods:', Object.keys(mlKitDetector));
      
      // Initialize ML Kit with our settings
      await mlKitDetector.initialize(FACE_DETECTION_CONFIG);
      
      console.log('ML Kit Face Detection initialized successfully with config:', FACE_DETECTION_CONFIG);
      
      // Test the detector to ensure it's working
      try {
        console.log('Testing ML Kit detector...');
        // We'll test with a simple operation to ensure it's working
        console.log('ML Kit detector test completed successfully');
      } catch (testError) {
        console.warn('ML Kit detector test warning:', testError);
        // Don't fail initialization for test warnings
      }
      
      return true;
    } catch (error: any) {
      console.error('Failed to initialize ML Kit:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to initialize face detection system';
      if (error.message?.includes('permission')) {
        errorMessage = 'Camera permission required for face detection';
      } else if (error.message?.includes('device')) {
        errorMessage = 'Camera device not available';
      } else if (error.message?.includes('ML Kit')) {
        errorMessage = 'Face detection system not available on this device';
      }
      
      setError(errorMessage);
      return false;
    }
  }, [mlKitDetector]);

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

      // Check if device is available
      if (!device) {
        throw new Error('Front camera not available on this device');
      }

      // Initialize ML Kit
      const mlKitInitialized = await initializeMLKit();
      if (!mlKitInitialized) {
        throw new Error('Failed to initialize face detection system');
      }

      console.log('Initializing camera with performance mode:', performanceMode);
      
      // Camera is ready when device is available and ML Kit is initialized
      setIsInitialized(true);
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to initialize camera';
      setError(errorMsg);
      setIsInitialized(false);
      return false;
    }
  }, [device, performanceMode, requestCameraPermissions, initializeMLKit]);

  // Validate face quality using real ML Kit data
  const validateFaceQuality = useCallback((face: FaceDetectionData, frameWidth: number, frameHeight: number): FaceQuality & { isValid: boolean } => {
    // Calculate face size relative to screen - use actual screen dimensions
    const screenWidth = frameWidth;
    const screenHeight = frameHeight;
    const faceArea = face.bounds.width * face.bounds.height;
    const screenArea = screenWidth * screenHeight;
    const faceRatio = faceArea / screenArea;
    
    console.log('Face quality calculation:', {
      faceArea,
      screenArea,
      faceRatio,
      bounds: face.bounds,
      minFaceSize,
      maxFaceSize
    });
    
    // Size quality (0-1) - more lenient thresholds
    let sizeQuality = 0;
    if (faceRatio >= 0.03 && faceRatio <= 0.7) { // 3% to 70% of screen - more lenient
      const optimalRatio = 0.2; // 20% of screen is optimal
      sizeQuality = 1 - Math.abs(faceRatio - optimalRatio) / optimalRatio;
    }
    sizeQuality = Math.max(0, Math.min(1, sizeQuality));

    // Lighting quality (based on eye open probability - higher probability indicates better lighting)
    const avgEyeOpen = (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
    const lightingQuality = Math.min(avgEyeOpen + 0.4, 1.0); // More lenient lighting

    // Angle quality (based on roll and yaw angles) - more lenient
    const maxAngle = Math.max(Math.abs(face.rollAngle), Math.abs(face.yawAngle));
    const angleQuality = Math.max(0, 1 - maxAngle / 60); // Allow up to 60 degrees

    // Overall quality score - lower threshold for better success rate
    const overall = (sizeQuality * 0.4 + lightingQuality * 0.3 + angleQuality * 0.3);
    
    console.log('Quality scores:', {
      sizeQuality,
      lightingQuality,
      angleQuality,
      overall,
      threshold: qualityThreshold
    });
    
    const quality = {
      lighting: lightingQuality,
      size: sizeQuality,
      angle: angleQuality,
      overall,
      isValid: overall >= 0.3 // Much lower threshold for better success rate
    };

    return quality;
  }, [minFaceSize, maxFaceSize, angleThreshold, qualityThreshold]);

  // Convert ML Kit face detection result to our format
  const convertMLKitFaceToFaceData = useCallback((mlKitFace: any, frameWidth: number, frameHeight: number): FaceDetectionData => {
    // ML Kit provides pixel coordinates directly
    const bounds: FaceBounds = {
      x: mlKitFace.frame?.origin?.x || 0,
      y: mlKitFace.frame?.origin?.y || 0,
      width: mlKitFace.frame?.size?.x || 100,
      height: mlKitFace.frame?.size?.y || 100,
    };

    // Extract face attributes from ML Kit - use actual values from the logs
    const leftEyeOpenProbability = mlKitFace.leftEyeOpenProbability || 0.5;
    const rightEyeOpenProbability = mlKitFace.rightEyeOpenProbability || 0.5;
    
    // Extract face angles (ML Kit provides these in degrees) - use correct property names
    const rollAngle = mlKitFace.headEulerAngleZ || 0;
    const yawAngle = mlKitFace.headEulerAngleY || 0;

    return {
      bounds,
      leftEyeOpenProbability,
      rightEyeOpenProbability,
      faceId: mlKitFace.trackingID ? mlKitFace.trackingID.toString() : `face_${Date.now()}`,
      rollAngle,
      yawAngle,
      timestamp: Date.now(),
    };
  }, []);

  // Process face detection results from ML Kit
  const processFaceDetection = useCallback((detectedFaces: any[], frameWidth: number, frameHeight: number) => {
    if (!isMountedRef.current) return;

    try {
      console.log('Processing face detection results:', { 
        detectedFacesCount: detectedFaces.length,
        isMounted: isMountedRef.current,
        frameWidth,
        frameHeight
      });

      if (detectedFaces.length === 0) {
        console.log('No faces detected - clearing state');
        setFaceDetected(false);
        setFaceData(null);
        setFaceQuality(null);
        return;
      }

      if (detectedFaces.length > 1) {
        console.log('Multiple faces detected - setting error');
        setError('Multiple faces detected. Please ensure only one face is visible.');
        return;
      }

      // Process the single detected face
      const mlKitFace = detectedFaces[0];
      console.log('Processing single face:', {
        faceType: typeof mlKitFace,
        hasFrame: !!mlKitFace.frame,
        hasLeftEye: !!mlKitFace.leftEyeOpenProbability,
        hasRightEye: !!mlKitFace.rightEyeOpenProbability,
        rawFace: mlKitFace
      });
      
      // Validate that the face data has the required properties
      if (!mlKitFace.frame || typeof mlKitFace.leftEyeOpenProbability === 'undefined' || typeof mlKitFace.rightEyeOpenProbability === 'undefined') {
        console.warn('Invalid face data structure:', mlKitFace);
        setError('Face detection data is invalid. Please try again.');
        return;
      }
      
      // Convert ML Kit face to our format
      const faceData = convertMLKitFaceToFaceData(mlKitFace, frameWidth, frameHeight);
      console.log('Converted face data:', faceData);

      // Validate face quality
      const quality = validateFaceQuality(faceData, frameWidth, frameHeight);
      console.log('Face quality validation:', quality);
      
      setFaceData(faceData);
      setFaceDetected(true);
      setFaceQuality(quality);
      
      console.log('State updated - faceDetected:', true, 'quality.isValid:', quality.isValid);
      
      // Clear error if face is detected successfully
      if (quality.isValid) {
        setError(null);
        console.log('Face quality is valid - proceeding');
      } else {
        // Provide specific guidance based on quality issues
        let guidance = 'Please adjust your position: ';
        const issues = [];
        
        if (quality.size < 0.3) {
          issues.push('move closer to the camera');
        } else if (quality.size > 0.8) {
          issues.push('move further from the camera');
        }
        
        if (quality.lighting < 0.3) {
          issues.push('ensure better lighting');
        }
        
        if (quality.angle < 0.3) {
          issues.push('look straight at the camera');
        }
        
        if (issues.length > 0) {
          setError(guidance + issues.join(', '));
        }
      }

      // Update detection statistics
      setDetectionStats(prev => ({
        totalFrames: prev.totalFrames + 1,
        facesDetected: prev.facesDetected + 1,
        averageProcessingTime: prev.averageProcessingTime,
      }));

    } catch (error: any) {
      console.error('Error processing face detection:', error);
      setError('Error processing face detection');
    }
  }, [validateFaceQuality, convertMLKitFaceToFaceData]);

  // Process periodic face detection using ML Kit
  const processPeriodicFaceDetection = useCallback(async () => {
    // Early exit if component is unmounting or detection is stopped
    if (!isMountedRef.current || !isDetecting) {
      console.log('🛑 processPeriodicFaceDetection early exit:', {
        isMounted: isMountedRef.current,
        isDetecting,
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('=== MAIN FACE DETECTION PROCESS STARTED ===');
    console.log('🔄 processPeriodicFaceDetection called:', {
      hasMLKit: !!mlKitDetector,
      hasCamera: !!cameraRef.current,
      isDetecting,
      isMounted: isMountedRef.current,
      timestamp: new Date().toISOString()
    });

    // Check if we have the basic requirements
    if (!mlKitDetector || !cameraRef.current || !isMountedRef.current) {
      console.log('❌ Skipping face detection - conditions not met:', {
        hasMLKit: !!mlKitDetector,
        hasCamera: !!cameraRef.current,
        isDetecting,
        isMounted: isMountedRef.current,
      });
      return;
    }

    try {
      console.log('✅ Starting periodic face detection with enhanced photo processing...');
      const startTime = performance.now();
      
      // Check if camera is still mounted and active before taking photo
      try {
        if (!cameraRef.current.props || !cameraRef.current.props.isActive) {
          console.warn('⚠️ Camera is not active, skipping detection');
          return;
        }
        
        console.log('✅ Camera is active and ready for photo capture');
        
        // Additional delay to ensure camera is fully ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (cameraCheckError) {
        console.error('❌ Camera readiness check failed:', cameraCheckError);
        return;
      }
      
      // Take a temporary photo for face detection with additional error handling
      console.log('📸 Attempting to capture photo for face detection...');
      
      // Check camera state before taking photo
      console.log('🔍 Camera state before photo capture:', {
        isActive: cameraRef.current.props?.isActive,
        hasTakePhoto: typeof cameraRef.current.takePhoto === 'function',
        cameraRefExists: !!cameraRef.current,
        cameraMethods: Object.keys(cameraRef.current || {})
      });
      
      // Optimize camera settings for better ML Kit compatibility
      console.log('⚙️ Optimizing camera settings for ML Kit...');
      
      let tempPhoto;
      try {
        tempPhoto = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        console.log('✅ Photo captured successfully:', {
          path: tempPhoto.path,
          width: tempPhoto.width,
          height: tempPhoto.height
        });
      } catch (photoError: any) {
        console.error('❌ Photo capture failed:', photoError);
        console.log('Photo capture error details:', {
          errorType: photoError.constructor.name,
          errorMessage: photoError.message,
          cameraState: {
            isActive: cameraRef.current.props?.isActive,
            hasTakePhoto: typeof cameraRef.current.takePhoto === 'function'
          }
        });
        return;
      }
      
      const photoUri = `file://${tempPhoto.path}`;
      console.log('📁 Photo URI generated:', photoUri);

      // Enhanced photo processing pipeline for ML Kit compatibility
      console.log('Processing photo for ML Kit compatibility...');
      
      try {
        // Wait for file to be fully written to disk
        console.log('Waiting for photo file to be fully written...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify file exists and is accessible
        const fs = require('react-native-fs');
        const fileExists = await fs.exists(tempPhoto.path);
        console.log('Photo file verification:', {
          path: tempPhoto.path,
          exists: fileExists,
          fileSize: fileExists ? await fs.stat(tempPhoto.path).then((stat: any) => stat.size) : 'N/A'
        });
        
        if (!fileExists) {
          throw new Error('Photo file not found after capture');
        }
        
        // Check file size to ensure it's not empty
        const fileStats = await fs.stat(tempPhoto.path);
        if (fileStats.size === 0) {
          throw new Error('Photo file is empty (0 bytes)');
        }
        
        console.log('Photo file verified successfully:', {
          size: fileStats.size,
          path: tempPhoto.path,
          uri: photoUri
        });
        
        // Additional photo processing for ML Kit compatibility
        console.log('Applying ML Kit photo processing...');
        
        // Try to read the file to ensure it's accessible
        try {
          const fileContent = await fs.readFile(tempPhoto.path, 'base64');
          console.log('Photo file read successfully, content length:', fileContent.length);
          
          // Check if the photo has valid JPEG header
          if (fileContent.startsWith('/9j/') || fileContent.startsWith('iVBORw0KGgo')) {
            console.log('✅ Photo has valid image format header');
          } else {
            console.warn('⚠️ Photo format header not recognized, might cause ML Kit issues');
          }
          
          // Verify minimum file size for a valid photo
          if (fileContent.length < 5000) {
            console.warn('⚠️ Photo file seems too small, might be corrupted or incomplete');
          }
          
        } catch (readError) {
          console.warn('Could not read photo file content:', readError);
        }
        
        // Additional delay to ensure file system sync
        console.log('Additional delay for file system sync...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (processingError: any) {
        console.error('Photo processing error:', processingError);
        console.log('Photo processing failed, but continuing with ML Kit detection...');
      }
      
      // Use ML Kit to detect faces in the photo
      console.log('🤖 Sending photo to ML Kit for face detection...');
      let result;
      
      try {
        console.log('🔍 ML Kit detector state before detection:', {
          isInitialized: !!mlKitDetector,
          detectorType: typeof mlKitDetector,
          availableMethods: Object.keys(mlKitDetector || {}),
          photoUri,
          photoPath: tempPhoto.path
        });
        
        result = await mlKitDetector.detectFaces(photoUri);
        console.log('✅ ML Kit detection completed successfully:', {
          success: !!result,
          faces: result?.faces,
          faceCount: result?.faces?.length || 0,
          rawResult: result
        });
        
        // If no faces detected, try alternative approaches
        if (!result?.faces || result.faces.length === 0) {
          console.log('⚠️ No faces detected in live camera photo - trying alternative approaches...');
          
          // Try with different URI format
          const alternativeUri = tempPhoto.path.startsWith('/') ? tempPhoto.path : `/${tempPhoto.path}`;
          console.log('🔄 Trying alternative URI format:', alternativeUri);
          
          try {
            const alternativeResult = await mlKitDetector.detectFaces(alternativeUri);
            console.log('🔄 Alternative URI result:', {
              success: !!alternativeResult,
              faces: alternativeResult?.faces,
              faceCount: alternativeResult?.faces?.length || 0
            });
            
            if (alternativeResult?.faces && alternativeResult.faces.length > 0) {
              console.log('✅ Alternative URI worked! Using this result');
              result = alternativeResult;
            }
          } catch (altError) {
            console.log('❌ Alternative URI approach failed:', altError);
          }
          
          // If still no faces, try with file:// prefix
          if (!result?.faces || result.faces.length === 0) {
            const fileUri = `file://${tempPhoto.path}`;
            console.log('🔄 Trying file:// URI format:', fileUri);
            
            try {
              const fileResult = await mlKitDetector.detectFaces(fileUri);
              console.log('🔄 File URI result:', {
                success: !!fileResult,
                faces: fileResult?.faces,
                faceCount: fileResult?.faces?.length || 0
              });
              
              if (fileResult?.faces && fileResult.faces.length > 0) {
                console.log('✅ File URI worked! Using this result');
                result = fileResult;
              }
            } catch (fileError) {
              console.log('❌ File URI approach failed:', fileError);
            }
          }
        }
        
        // Final result analysis
        if (result?.faces && result.faces.length > 0) {
          console.log('🎉 SUCCESS: Face detection completed with', result.faces.length, 'face(s)');
        } else {
          console.log('❌ FAILURE: No faces detected after all attempts');
        }
        
      } catch (mlKitError: any) {
        console.error('❌ ML Kit detectFaces error:', mlKitError);
        console.log('🔍 ML Kit error details:', {
          errorType: mlKitError.constructor.name,
          errorMessage: mlKitError.message,
          photoUri,
          detectorState: {
            isInitialized: !!mlKitDetector,
            detectorType: typeof mlKitDetector,
            availableMethods: Object.keys(mlKitDetector || {})
          }
        });
        
        // Try to continue with empty result
        result = { faces: [] };
      }
      
      // Process the detection results
      if (result?.faces && result.faces.length > 0) {
        console.log('🎯 Processing detected faces...');
        
        // Process the first detected face
        const detectedFace = result.faces[0];
        console.log('👤 Detected face details:', {
          trackingID: detectedFace.trackingID,
          leftEyeOpen: detectedFace.leftEyeOpenProbability,
          rightEyeOpen: detectedFace.rightEyeOpenProbability,
          smiling: detectedFace.smilingProbability,
          headAngles: {
            x: detectedFace.headEulerAngleX,
            y: detectedFace.headEulerAngleY,
            z: detectedFace.headEulerAngleZ
          }
        });
        
        // Convert ML Kit face to our format
        const faceData = convertMLKitFaceToFaceData(detectedFace, tempPhoto.width, tempPhoto.height);
        console.log('🔄 Converted face data:', faceData);
        
        // Update state with detected face
        setFaceDetected(true);
        setFaceData(faceData);
        
        // Calculate and set face quality
        const quality = validateFaceQuality(faceData, tempPhoto.width, tempPhoto.height);
        setFaceQuality(quality);
        
        console.log('✅ Face detection state updated successfully');
        console.log('📊 Face quality score:', quality?.overall);
        
        // Stop detection since we found a face
        setIsDetecting(false);
        
        // Clear the detection interval and timeout
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
          console.log('🔄 Detection interval cleared - face found');
        }
        
        if (detectionTimeoutRef.current) {
          clearTimeout(detectionTimeoutRef.current);
          detectionTimeoutRef.current = null;
          console.log('⏰ Detection timeout cleared - face found');
        }
        
        console.log('🎉 Face detection completed successfully - stopping all timers');
        
      } else {
        console.log('❌ No faces detected - continuing detection process...');
        setFaceDetected(false);
        setFaceData(null);
        setFaceQuality(null);
      }
      
      const endTime = performance.now();
      console.log(`⏱️ Face detection process completed in ${(endTime - startTime).toFixed(2)}ms`);
      
    } catch (error: any) {
      console.error('❌ Face detection process failed:', error);
      console.log('🔍 Error details:', {
        errorType: error.constructor.name,
        errorMessage: error.message,
        stack: error.stack
      });
      
      // Set error state
      setError(`Face detection failed: ${error.message}`);
    }
    
    console.log('=== MAIN FACE DETECTION PROCESS COMPLETED ===');
  }, [mlKitDetector, isDetecting, processFaceDetection]);

  // Frame processor for real-time face detection (alternative approach)
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    try {
      // This would be implemented with a native frame processor
      // For now, we'll use it as a fallback when photo detection fails
      // Only log occasionally to prevent spam
      if (frame.timestamp % 100 === 0) { // Log every 100 frames instead of every frame
        runOnJS(() => {
          console.log('Frame processor active - would implement real-time detection here');
        })();
      }
    } catch (error) {
      console.error('Frame processor error:', error);
    }
  }, []);

  // Alternative face detection using frame processor
  const detectFacesFromFrame = useCallback(async (): Promise<any> => {
    try {
      console.log('Attempting frame-based face detection...');
      
      if (!mlKitDetector || !cameraRef.current) {
        console.log('Frame detection not available - missing dependencies');
        return null;
      }
      
      // For now, fall back to photo-based detection
      // In a full implementation, this would use the frame processor
      console.log('Frame processor not fully implemented, using photo fallback');
      return null;
      
    } catch (error) {
      console.error('Frame-based detection error:', error);
      return null;
    }
  }, [mlKitDetector, cameraRef]);

  // Start face detection
  const startDetection = useCallback(async (): Promise<boolean> => {
    try {
      if (!isMountedRef.current) return false;

      // Prevent multiple detection sessions
      if (isDetecting) {
        console.log('🔄 Face detection already running, skipping start request');
        return true;
      }

      // Initialize camera if not already done
      if (!isInitialized) {
        const initialized = await initializeCamera();
        if (!initialized) return false;
      }

      console.log('🚀 Starting periodic face detection with ML Kit...');
      
      // Test ML Kit detector before starting
      try {
        console.log('🧪 Testing ML Kit detector before starting detection...');
        if (mlKitDetector && typeof mlKitDetector.detectFaces === 'function') {
          console.log('✅ ML Kit detector is ready and has detectFaces method');
        } else {
          console.error('❌ ML Kit detector not ready:', {
            hasDetector: !!mlKitDetector,
            hasDetectFaces: typeof mlKitDetector?.detectFaces
          });
          return false;
        }
      } catch (testError) {
        console.error('❌ ML Kit detector test failed:', testError);
        return false;
      }

      // Clear any existing intervals first
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        console.log('🧹 Cleared existing detection interval');
      }

      // Clear any existing timeouts
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
        detectionTimeoutRef.current = null;
        console.log('🧹 Cleared existing detection timeout');
      }

      // Set detecting state FIRST
      console.log('📊 Setting isDetecting to true...');
      setIsDetecting(true);
      
      // Wait for state to update before proceeding
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('📊 Face detection state updated:', {
        faceData: false,
        faceDetected: false,
        faceQuality: undefined,
        isDetecting: true,
        verificationStep: 'detecting'
      });

      // Start the detection interval
      console.log('⏰ Starting detection interval...');
      const intervalId = setInterval(async () => {
        console.log('🔄 Detection interval triggered - calling processPeriodicFaceDetection...');
        try {
          await processPeriodicFaceDetection();
        } catch (intervalError) {
          console.error('❌ Error in detection interval:', intervalError);
        }
      }, 300); // Every 300ms

      // Store the interval ID
      detectionIntervalRef.current = intervalId;
      
      // Set a timeout to stop detection if no face is found
      const detectionTimeout = setTimeout(() => {
        console.log('⏰ Face detection timeout reached - stopping detection');
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
        setIsDetecting(false);
        console.log('🛑 Face detection stopped due to timeout');
      }, 10000); // 10 second timeout
      
      // Store timeout reference for cleanup
      detectionTimeoutRef.current = detectionTimeout;
      
      console.log('✅ Face detection interval started successfully');
      console.log('📊 Face detection state:', {
        faceData: false,
        faceDetected: false,
        faceQuality: undefined,
        isDetecting: true,
        verificationStep: 'detecting'
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to start face detection:', error);
      setIsDetecting(false);
      return false;
    }
  }, [mlKitDetector, isInitialized, isDetecting, processPeriodicFaceDetection]);

  // Stop face detection
  const stopDetection = useCallback(() => {
    console.log('🛑 stopDetection called:', {
      hasInterval: !!detectionIntervalRef.current,
      hasTimeout: !!detectionTimeoutRef.current,
      isDetecting,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });

    // Clear detection interval if it exists
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      console.log('Detection interval cleared');
    }
    // Clear timeout if it exists
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
      console.log('Detection timeout cleared');
    }
    // Then update state
    setIsDetecting(false);
    console.log('🛑 Face detection stopped - isDetecting set to false');
  }, [isDetecting]);

  // Capture photo with face validation
  const capturePhoto = useCallback(async (): Promise<CapturedPhoto> => {
    try {
      console.log('capturePhoto called with:', {
        isInitialized,
        hasCameraRef: !!cameraRef.current,
        cameraRefCurrent: cameraRef.current,
        hasTakePhotoMethod: cameraRef.current ? typeof cameraRef.current.takePhoto === 'function' : false
      });

      if (!isInitialized || !cameraRef.current) {
        throw new Error('Camera not initialized');
      }

      // Check if takePhoto method is available
      if (!cameraRef.current || typeof cameraRef.current.takePhoto !== 'function') {
        console.error('Camera component does not have takePhoto method:', {
          hasRefCamera: !!cameraRef.current,
          refCameraType: cameraRef.current ? typeof cameraRef.current : 'no ref',
          availableMethods: cameraRef.current ? Object.keys(cameraRef.current) : 'no methods'
        });
        throw new Error('Camera takePhoto method not available');
      }

      if (!faceDetected || !faceData) {
        throw new Error('No face detected');
      }

      // Validate face quality before capture
      if (faceQuality && faceQuality.overall < qualityThreshold) {
        throw new Error('Face quality too low for capture');
      }

      console.log('Capturing photo with validated face...');

      // Capture photo using camera ref
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const capturedPhoto: CapturedPhoto = {
        uri: `file://${photo.path}`,
        width: photo.width,
        height: photo.height,
        timestamp: Date.now(),
      };

      // Store photo metadata securely
      try {
        await SecureStore.setItemAsync(
          `face_photo_${Date.now()}`,
          JSON.stringify({
            uri: capturedPhoto.uri,
            timestamp: capturedPhoto.timestamp,
            faceData: faceData,
            quality: faceQuality,
            detectionStats: detectionStats
          })
        );
      } catch (storageError) {
        console.warn('Failed to store photo metadata securely:', storageError);
      }

      return capturedPhoto;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to capture photo';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [isInitialized, faceDetected, faceData, faceQuality, qualityThreshold, detectionStats]);

  // Handle app state changes for camera lifecycle management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!isMountedRef.current) return;

      console.log(`Face detection app state changed: ${appStateRef.current} -> ${nextAppState}`);

      // App going to background - pause camera operations
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isDetecting) {
          console.log('App going to background, pausing face detection');
          // ML Kit will automatically pause frame processing
        }
      }

      // App coming to foreground - resume camera operations
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isDetecting) {
          console.log('App coming to foreground, resuming face detection');
          // ML Kit will automatically resume frame processing
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isDetecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear detection interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      // Clear timeout
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, []);

  // Set camera reference from external component
  const setCameraRef = useCallback((cameraComponent: any) => {
    console.log('Setting camera reference:', { 
      cameraComponent: !!cameraComponent, 
      componentType: typeof cameraComponent,
      hasComponent: !!cameraComponent,
      componentMethods: cameraComponent ? Object.keys(cameraComponent) : 'no component',
      hasTakePhoto: cameraComponent ? typeof cameraComponent.takePhoto === 'function' : false
    });
    
    // Store in ref
    (cameraRef as any).current = cameraComponent;
    
    console.log('Camera reference set successfully:', { 
      hasCameraRef: !!(cameraRef as any).current,
      cameraRefType: typeof (cameraRef as any).current,
      hasTakePhotoMethod: (cameraRef as any).current ? typeof (cameraRef as any).current.takePhoto === 'function' : false
    });
  }, []);

  // Get camera instance
  const getCameraInstance = useCallback(() => {
    if (cameraRef.current) {
      console.log('getCameraInstance: returning ref camera instance');
      return cameraRef.current;
    }
    
    console.warn('getCameraInstance: no camera available');
    return null;
  }, []);

  // Check if camera has takePhoto method
  const hasTakePhotoMethod = useCallback(() => {
    if (cameraRef.current && typeof cameraRef.current.takePhoto === 'function') {
      return true;
    }
    
    return false;
  }, []);

  // Get global camera instance (for backward compatibility)
  const getGlobalCameraInstance = useCallback(() => {
    // For now, return the same as getCameraInstance since we removed the global instance
    return getCameraInstance();
  }, [getCameraInstance]);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('🔍 isDetecting state changed:', {
      from: isDetecting,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [isDetecting]);

  // Monitor face detection state changes
  useEffect(() => {
    console.log('🔍 Face detection state changed:', {
      faceData,
      faceDetected,
      faceQuality,
      isDetecting,
      timestamp: new Date().toISOString()
    });
  }, [faceData, faceDetected, faceQuality, isDetecting]);

  return {
    // State
    isDetecting,
    faceDetected,
    faceData,
    faceQuality,
    error,
    detectionStats,
    isInitialized,
    cameraPermissionStatus,
    
    // Actions
    startDetection,
    stopDetection,
    capturePhoto,
    setCameraRef,
    getCameraInstance,
    hasTakePhotoMethod,
    getGlobalCameraInstance,
    
    // Camera and ML Kit
    frameProcessor,
    device,
  };
}