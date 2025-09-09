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
  CameraPermissionStatus,
  LandmarkPoint,
  ContourPoint,
  FaceAttributes
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
  landmarkMode: true, // Enable 468-point landmarks
  contourMode: true,  // Enable face contours
  classificationMode: true, // Enable age, gender, smiling detection
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
  
  // CRITICAL FIX: Camera keep-alive mechanism
  const cameraKeepAliveRef = useRef(false);
  
  // FINAL FIX: Camera reference persistence to prevent detachment during state transitions
  const persistentCameraRef = useRef<any>(null);
  const cameraRefStateRef = useRef<'null' | 'valid' | 'detached'>('null');

  // Get front camera device
  const device = useCameraDevice('front');
  
  // Get ML Kit face detector instance
  const mlKitDetector = useMLKitFaceDetection();

  // CRITICAL FIX: Enable camera keep-alive to prevent native view detachment
  const enableCameraKeepAlive = useCallback(() => {
    console.log('🔒 === ENABLING CAMERA KEEP-ALIVE ===');
    console.log('🔒 Previous state:', cameraKeepAliveRef.current);
    cameraKeepAliveRef.current = true;
    console.log('🔒 New state:', cameraKeepAliveRef.current);
  }, []);

  const disableCameraKeepAlive = useCallback(() => {
    console.log('🔓 === DISABLING CAMERA KEEP-ALIVE ===');
    console.log('🔓 Previous state:', cameraKeepAliveRef.current);
    cameraKeepAliveRef.current = false;
    console.log('🔓 New state:', cameraKeepAliveRef.current);
  }, []);

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

    // Extract enhanced ML Kit data
    const landmarks = mlKitFace.landmarks || [];
    const contours = mlKitFace.contours || [];
    const trackingId = mlKitFace.trackingID?.toString();
    
    // Extract face attributes
    const attributes: FaceAttributes = {
      age: mlKitFace.age,
      gender: mlKitFace.gender,
      smiling: mlKitFace.smilingProbability,
      headEulerAngles: {
        x: mlKitFace.headEulerAngleX || 0,
        y: mlKitFace.headEulerAngleY || 0,
        z: mlKitFace.headEulerAngleZ || 0,
      },
      emotions: {
        happy: mlKitFace.smilingProbability || 0,
        sad: 0, // ML Kit doesn't provide these, default to 0
        angry: 0,
        surprised: 0,
        neutral: 1 - (mlKitFace.smilingProbability || 0),
      }
    };

    return {
      bounds,
      leftEyeOpenProbability,
      rightEyeOpenProbability,
      faceId: trackingId || `face_${Date.now()}`,
      rollAngle,
      yawAngle,
      timestamp: Date.now(),
      // Enhanced ML Kit data
      landmarks,
      contours,
      trackingId,
      attributes,
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
    // Early exit if component is unmounting - but don't check isDetecting here as it causes race conditions
    if (!isMountedRef.current) {
      console.log('🛑 processPeriodicFaceDetection early exit - component unmounted:', {
        isMounted: isMountedRef.current,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if detection interval is still active (more reliable than state)
    if (!detectionIntervalRef.current) {
      console.log('🛑 processPeriodicFaceDetection early exit - no active interval:', {
        hasInterval: !!detectionIntervalRef.current,
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

    // CRITICAL FIX: Use getCameraInstance to get a valid camera reference
    const validCamera = getCameraInstance();
    if (!mlKitDetector || !validCamera || !isMountedRef.current) {
      console.log('❌ Skipping face detection - conditions not met:', {
        hasMLKit: !!mlKitDetector,
        hasCamera: !!validCamera,
        isDetecting,
        isMounted: isMountedRef.current,
      });
      
      // If camera ref is missing but we have ML Kit, log more details
      if (mlKitDetector && !validCamera) {
        console.log('🔍 Camera ref missing - detection will retry when camera is connected');
      }
      
      return;
    }

    try {
      console.log('✅ Starting periodic face detection with enhanced photo processing...');
      const startTime = performance.now();
      
      // Check if camera is still mounted and active before taking photo
      try {
        if (!validCamera.props || !validCamera.props.isActive) {
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
        isActive: validCamera.props?.isActive,
        hasTakePhoto: typeof validCamera.takePhoto === 'function',
        cameraRefExists: !!validCamera,
        cameraMethods: Object.keys(validCamera || {})
      });
      
      // Optimize camera settings for better ML Kit compatibility
      console.log('⚙️ Optimizing camera settings for ML Kit...');
      
      let tempPhoto;
      try {
        tempPhoto = await validCamera.takePhoto({
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
            isActive: validCamera.props?.isActive,
            hasTakePhoto: typeof validCamera.takePhoto === 'function'
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

      // Prevent multiple detection sessions by checking interval ref instead of state
      if (detectionIntervalRef.current) {
        console.log('🔄 Face detection already running (interval active), skipping start request');
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

      // Set detecting state and start interval immediately to avoid race conditions
      console.log('📊 Setting isDetecting to true and starting interval...');
      setIsDetecting(true);
      
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
  }, []); // Remove isDetecting from dependencies to prevent recreation

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

      // Check if camera is still active and mounted
      try {
        // Test if camera is still responsive by checking if takePhoto method exists
        if (!cameraRef.current || typeof cameraRef.current.takePhoto !== 'function') {
          throw new Error('Camera is not ready for capture');
        }
      } catch (stateError) {
        console.warn('Camera state check failed:', stateError);
        throw new Error('Camera is not ready for capture');
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

      // Enhanced delay and camera state validation for liveness transition
      console.log('🔍 Validating camera state before final capture...');
      
      // Wait for camera to stabilize after liveness detection
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Retry mechanism for camera availability
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Validate camera is still available
          if (!cameraRef.current || typeof cameraRef.current.takePhoto !== 'function') {
            throw new Error(`Camera unavailable on attempt ${retryCount + 1}`);
          }
          
          // Test camera responsiveness
          console.log(`✅ Camera validation successful on attempt ${retryCount + 1}`);
          break;
          
        } catch (validationError: any) {
          retryCount++;
          console.warn(`⚠️ Camera validation failed on attempt ${retryCount}:`, validationError.message);
          
          if (retryCount >= maxRetries) {
            throw new Error('Camera validation failed after multiple attempts');
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
        }
      }

      // Final camera state check before capture
      console.log('📸 Final camera state validation before photo capture...');
      
      // CRITICAL FIX: Use getCameraInstance to get a valid camera reference
      const validCamera = getCameraInstance();
      if (!validCamera || typeof validCamera.takePhoto !== 'function') {
        throw new Error('No valid camera available for photo capture');
      }
      
      // Capture photo using valid camera reference with error handling
      let photo: any = null;
      try {
        photo = await validCamera.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        console.log('✅ Photo capture successful:', photo);
      } catch (captureError: any) {
        console.error('❌ Photo capture failed:', captureError.message);
        
        // If it's a native view tag error, implement advanced camera recovery
        if (captureError.message.includes('native view tag')) {
          console.log('🔄 Native view tag error detected - implementing advanced camera recovery...');
          
          // Try multiple recovery strategies
          let recoverySuccess = false;
          
          // Strategy 1: Force camera reference refresh and retry
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`🔄 Recovery attempt ${attempt}: Forcing camera reference refresh...`);
              
              // Force refresh camera reference
              await refreshCameraRef();
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              
              // Get fresh camera instance
              const refreshedCamera = getCameraInstance();
              if (refreshedCamera && typeof refreshedCamera.takePhoto === 'function') {
                console.log(`🔄 Recovery attempt ${attempt}: Testing camera responsiveness...`);
                
                // Test camera before actual capture
                try {
                  photo = await refreshedCamera.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                  });
                  console.log(`✅ Photo capture successful on recovery attempt ${attempt}:`, photo);
                  recoverySuccess = true;
                  break;
                } catch (testError: any) {
                  console.warn(`⚠️ Recovery attempt ${attempt} test failed:`, testError.message);
                  // Continue to next attempt
                }
              } else {
                console.warn(`⚠️ Recovery attempt ${attempt}: Camera still invalid after refresh`);
              }
            } catch (recoveryError: any) {
              console.warn(`⚠️ Recovery attempt ${attempt} failed:`, recoveryError.message);
            }
          }
          
          // Strategy 2: If still failing, try to re-establish camera connection
          if (!recoverySuccess) {
            console.log('🔄 All recovery attempts failed - trying camera reconnection...');
            
            // Wait longer for camera to fully stabilize
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Force camera reconnection
            try {
              await refreshCameraRef();
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Final attempt with reconnected camera
              const finalCamera = getCameraInstance();
              if (finalCamera && typeof finalCamera.takePhoto === 'function') {
                try {
                  photo = await finalCamera.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                  });
                  console.log('✅ Photo capture successful after camera reconnection:', photo);
                  recoverySuccess = true;
                } catch (finalError: any) {
                  console.error('❌ Final camera recovery attempt failed:', finalError.message);
                }
              }
            } catch (reconnectionError: any) {
              console.error('❌ Camera reconnection failed:', reconnectionError.message);
            }
          }
          
          if (!recoverySuccess) {
            throw new Error('Camera recovery failed after multiple strategies');
          }
        } else {
          throw captureError;
        }
      }

      // Ensure photo was captured successfully
      if (!photo) {
        throw new Error('Photo capture failed - no photo data received');
      }

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

  // Cleanup on unmount with persistence cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 === CLEANING UP FACE DETECTION ON UNMOUNT ===');
      isMountedRef.current = false;
      
      // Clear detection interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      
      // Clear timeout
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
        detectionTimeoutRef.current = null;
      }
      
      // FINAL FIX: Clean up camera references
      if (cameraRef.current) {
        console.log('🧹 Cleaning up main camera ref');
        (cameraRef as any).current = null;
      }
      
      if (persistentCameraRef.current) {
        console.log('🧹 Cleaning up persistent camera ref');
        persistentCameraRef.current = null;
      }
      
      cameraRefStateRef.current = 'null';
      
      console.log('✅ Face detection cleanup completed');
    };
  }, []);

  // Refresh camera reference with persistence recovery
  const refreshCameraRef = useCallback(async () => {
    console.log('🔄 === REFRESHING CAMERA REFERENCE ===');
    console.log('🔍 Current camera ref state:', cameraRefStateRef.current);
    console.log('🔍 Persistent ref exists:', !!persistentCameraRef.current);
    
    // Strategy 1: Try to recover from persistent ref first
    if (persistentCameraRef.current && typeof persistentCameraRef.current.takePhoto === 'function') {
      console.log('🔍 Persistent camera ref is valid - attempting recovery...');
      
      // Test the persistent ref before restoring
      try {
        // Quick test to ensure camera is responsive
        const testResult = await persistentCameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        
        if (testResult && testResult.path) {
          // Restore from persistent ref
          (cameraRef as any).current = persistentCameraRef.current;
          cameraRefStateRef.current = 'valid';
          
          console.log('✅ Camera reference recovered from persistent ref');
          return true;
        } else {
          console.warn('⚠️ Persistent ref test failed - invalid photo result');
        }
      } catch (testError: any) {
        console.warn('⚠️ Persistent ref test failed:', testError.message);
        // Clear invalid persistent ref
        persistentCameraRef.current = null;
      }
    }
    
    // Strategy 2: Wait for camera to stabilize and retry
    console.log('🔄 Waiting for camera to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if camera ref is valid
    if (cameraRef.current && typeof cameraRef.current.takePhoto === 'function') {
      try {
        // Test camera responsiveness
        const testResult = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        
        if (testResult && testResult.path) {
          console.log('✅ Camera reference is valid after refresh');
          cameraRefStateRef.current = 'valid';
          return true;
        }
      } catch (testError: any) {
        console.warn('⚠️ Camera ref test failed:', testError.message);
      }
    }
    
    // Strategy 3: Force camera state reset
    console.log('🔄 Forcing camera state reset...');
    cameraRefStateRef.current = 'detached';
    
    // Clear invalid references
    (cameraRef as any).current = null;
    if (persistentCameraRef.current) {
      persistentCameraRef.current = null;
    }
    
    console.log('❌ Camera reference is still invalid after refresh - reset to detached state');
    return false;
  }, []);

  // Enhanced camera state monitoring with persistence recovery
  const monitorCameraState = useCallback(async () => {
    console.log('🔍 === CAMERA STATE MONITORING ===');
    console.log('🔍 Camera ref exists:', !!cameraRef.current);
    console.log('🔍 Persistent ref exists:', !!persistentCameraRef.current);
    console.log('🔍 Camera ref state:', cameraRefStateRef.current);
    
    // FINAL FIX: If main ref is null but persistent ref exists, try recovery
    if (!cameraRef.current && persistentCameraRef.current) {
      console.log('🔍 Main ref is null but persistent ref exists - attempting recovery...');
      return await refreshCameraRef();
    }
    
    if (!cameraRef.current) {
      console.log('❌ No camera reference available');
      return false;
    }
    
    try {
      // Check if camera is responsive
      const hasTakePhoto = typeof cameraRef.current.takePhoto === 'function';
      const isActive = cameraRef.current.props?.isActive !== false;
      
      console.log('🔍 Camera state monitoring:', { hasTakePhoto, isActive });
      
      // If camera seems unresponsive, try to refresh it
      if (!hasTakePhoto || !isActive) {
        console.log('⚠️ Camera appears unresponsive - attempting refresh...');
        return await refreshCameraRef();
      }
      
      return true;
    } catch (error) {
      console.warn('⚠️ Camera state monitoring failed:', error);
      return false;
    }
  }, [refreshCameraRef]);

  // Set camera reference from external component
  const setCameraRef = useCallback((cameraComponent: any) => {
    console.log('🔍 === SETTING CAMERA REFERENCE ===');
    console.log('🔍 Camera component exists:', !!cameraComponent);
    console.log('🔍 Component type:', typeof cameraComponent);
    console.log('🔍 Has component:', !!cameraComponent);
    
    if (cameraComponent) {
      console.log('🔍 Component methods:', Object.keys(cameraComponent));
      console.log('🔍 Has takePhoto method:', typeof cameraComponent.takePhoto === 'function');
      
      // FINAL FIX: Store in persistent ref to prevent detachment
      persistentCameraRef.current = cameraComponent;
      cameraRefStateRef.current = 'valid';
      
      console.log('🔍 Camera reference stored in persistent ref');
    }
    
    // Store in main ref
    (cameraRef as any).current = cameraComponent;
    
    console.log('✅ Camera reference set successfully:', { 
      hasCameraRef: !!(cameraRef as any).current,
      cameraRefType: typeof (cameraRef as any).current,
      hasTakePhotoMethod: (cameraRef as any).current ? typeof (cameraRef as any).current.takePhoto === 'function' : false,
      persistentRefState: cameraRefStateRef.current
    });

    // If detection is already running but was waiting for camera, restart it
    if (detectionIntervalRef.current && cameraComponent) {
      console.log('🔄 Camera connected during active detection - detection will now proceed');
    }
  }, []);

  // Get camera instance with persistence fallback
  const getCameraInstance = useCallback(() => {
    console.log('🔍 === GET CAMERA INSTANCE ===');
    console.log('🔍 Main ref exists:', !!cameraRef.current);
    console.log('🔍 Persistent ref exists:', !!persistentCameraRef.current);
    
    if (cameraRef.current) {
      console.log('✅ getCameraInstance: returning main ref camera instance');
      return cameraRef.current;
    }
    
    // FINAL FIX: Fallback to persistent ref if main ref is null
    if (persistentCameraRef.current) {
      console.log('🔄 getCameraInstance: main ref is null, using persistent ref');
      
      // Restore main ref from persistent ref
      (cameraRef as any).current = persistentCameraRef.current;
      cameraRefStateRef.current = 'valid';
      
      console.log('✅ getCameraInstance: restored camera instance from persistent ref');
      return persistentCameraRef.current;
    }
    
    console.warn('❌ getCameraInstance: no camera available');
    return null;
  }, []);

  // Check if camera has takePhoto method with persistence fallback
  const hasTakePhotoMethod = useCallback(() => {
    console.log('🔍 === CHECKING TAKE PHOTO METHOD ===');
    console.log('🔍 Main ref exists:', !!cameraRef.current);
    console.log('🔍 Persistent ref exists:', !!persistentCameraRef.current);
    
    if (cameraRef.current && typeof cameraRef.current.takePhoto === 'function') {
      console.log('✅ hasTakePhotoMethod: main ref has takePhoto method');
      return true;
    }
    
    // FINAL FIX: Check persistent ref if main ref is null
    if (persistentCameraRef.current && typeof persistentCameraRef.current.takePhoto === 'function') {
      console.log('🔄 hasTakePhotoMethod: main ref is null, but persistent ref has takePhoto method');
      
      // Restore main ref from persistent ref
      (cameraRef as any).current = persistentCameraRef.current;
      cameraRefStateRef.current = 'valid';
      
      console.log('✅ hasTakePhotoMethod: restored camera instance from persistent ref');
      return true;
    }
    
    console.log('❌ hasTakePhotoMethod: no camera with takePhoto method available');
    return false;
  }, []);

  // Get global camera instance (for backward compatibility)
  const getGlobalCameraInstance = useCallback(() => {
    // For now, return the same as getCameraInstance since we removed the global instance
    return getCameraInstance();
  }, [getCameraInstance]);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('🔍 === isDetecting STATE CHANGED ===');
    console.log('🔍 New value:', isDetecting);
    console.log('🔍 Has interval:', !!detectionIntervalRef.current);
    console.log('🔍 Has timeout:', !!detectionTimeoutRef.current);
    console.log('🔍 Camera keep-alive:', cameraKeepAliveRef.current);
    console.log('🔍 Timestamp:', new Date().toISOString());
  }, [isDetecting]);

  // Monitor face detection state changes
  useEffect(() => {
    console.log('🔍 === FACE DETECTION STATE CHANGED ===');
    console.log('🔍 Face data:', !!faceData);
    console.log('🔍 Face detected:', faceDetected);
    console.log('🔍 Face quality:', !!faceQuality);
    console.log('🔍 Is detecting:', isDetecting);
    console.log('🔍 Has interval:', !!detectionIntervalRef.current);
    console.log('🔍 Camera keep-alive:', cameraKeepAliveRef.current);
    console.log('🔍 Timestamp:', new Date().toISOString());
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
    refreshCameraRef,
    monitorCameraState,
    getCameraInstance,
    hasTakePhotoMethod,
    getGlobalCameraInstance,
    
    // CRITICAL FIX: Camera keep-alive functions
    enableCameraKeepAlive,
    disableCameraKeepAlive,
    
    // Camera and ML Kit
    frameProcessor,
    device,
  };
}