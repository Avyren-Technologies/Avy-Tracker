import * as FaceDetector from "expo-face-detector";
import { Camera } from "expo-camera";
import * as FileSystem from "expo-file-system";
import ErrorHandlingService from "./ErrorHandlingService";
import BiometricStorageService from "./BiometricStorageService";

export interface FaceDetectionResult {
  success: boolean;
  faceCount: number;
  quality: "excellent" | "good" | "fair" | "poor";
  confidence: number;
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  };
  bounds?: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  faceId?: string;
  livenessScore?: number;
  recommendations?: string[];
}

export interface FaceVerificationResult {
  success: boolean;
  match: boolean;
  confidence: number;
  message: string;
  faceId?: string;
}

export class FaceDetectionService {
  private static instance: FaceDetectionService;
  private biometricStorage: BiometricStorageService;
  private isInitialized = false;

  private constructor() {
    this.biometricStorage = BiometricStorageService.getInstance();
  }

  public static getInstance(): FaceDetectionService {
    if (!FaceDetectionService.instance) {
      FaceDetectionService.instance = new FaceDetectionService();
    }
    return FaceDetectionService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Request camera permissions
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Camera permission denied");
      }

      this.isInitialized = true;
      console.log("FaceDetectionService initialized successfully");
    } catch (error) {
      ErrorHandlingService.logError(
        "FACE_DETECTION_INIT_ERROR",
        error as Error,
        {
          context: "FaceDetectionService.initialize",
        },
      );
      throw error;
    }
  }

  public async detectFacesInImage(
    imageUri: string,
  ): Promise<FaceDetectionResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Use Expo's face detector
      const options: FaceDetector.DetectionOptions = {
        mode: FaceDetector.FaceDetectorMode.accurate,
        detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
        runClassifications: FaceDetector.FaceDetectorClassifications.all,
      };

      const result = await FaceDetector.detectFacesAsync(imageUri, options);

      if (!result.faces || result.faces.length === 0) {
        return {
          success: false,
          faceCount: 0,
          quality: "poor",
          confidence: 0,
          recommendations: [
            "No face detected. Please ensure your face is visible and well-lit.",
          ],
        };
      }

      const primaryFace = result.faces[0];
      const quality = this.assessFaceQuality(primaryFace);
      const livenessScore = await this.assessLiveness(primaryFace);

      return {
        success: true,
        faceCount: result.faces.length,
        quality: quality.overall,
        confidence: quality.score,
        bounds: primaryFace.bounds,
        faceId: await this.generateFaceId(primaryFace),
        livenessScore,
        recommendations: quality.recommendations,
      };
    } catch (error) {
      ErrorHandlingService.logError("FACE_DETECTION_ERROR", error as Error, {
        context: "FaceDetectionService.detectFacesInImage",
        imageUri,
      });

      return {
        success: false,
        faceCount: 0,
        quality: "poor",
        confidence: 0,
        recommendations: [
          "Face detection failed. Please try again with better lighting.",
        ],
      };
    }
  }

  public async verifyFace(
    imageUri: string,
    userId: string,
  ): Promise<FaceVerificationResult> {
    try {
      // Detect face in current image
      const detectionResult = await this.detectFacesInImage(imageUri);

      if (!detectionResult.success || detectionResult.quality === "poor") {
        return {
          success: false,
          match: false,
          confidence: 0,
          message:
            "Face quality too low for verification. " +
            (detectionResult.recommendations?.[0] || ""),
        };
      }

      // Get stored biometric data for user
      const storedBiometric =
        await this.biometricStorage.getBiometricData(userId);

      if (!storedBiometric) {
        // First time setup - store the face data
        await this.storeFaceBiometric(userId, detectionResult);
        return {
          success: true,
          match: true,
          confidence: detectionResult.confidence,
          message: "Face biometric registered successfully",
          faceId: detectionResult.faceId,
        };
      }

      // Compare faces
      const matchResult = await this.compareFaces(
        detectionResult,
        storedBiometric,
      );

      return {
        success: true,
        match: matchResult.match,
        confidence: matchResult.confidence,
        message: matchResult.match
          ? "Face verification successful"
          : "Face verification failed",
        faceId: detectionResult.faceId,
      };
    } catch (error) {
      ErrorHandlingService.logError("FACE_VERIFICATION_ERROR", error as Error, {
        context: "FaceDetectionService.verifyFace",
        userId,
        imageUri,
      });

      return {
        success: false,
        match: false,
        confidence: 0,
        message: "Face verification failed due to technical error",
      };
    }
  }

  private assessFaceQuality(face: FaceDetector.FaceFeature): {
    overall: "excellent" | "good" | "fair" | "poor";
    score: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let score = 0;

    // Face size assessment (30% weight)
    const faceSize = Math.min(face.bounds.size.width, face.bounds.size.height);
    const sizeScore = Math.min(faceSize / 200, 1); // Prefer faces at least 200px
    score += sizeScore * 0.3;

    if (sizeScore < 0.5) {
      recommendations.push(
        "Move closer to the camera for better face detection",
      );
    }

    // Face position assessment (20% weight)
    const centerX = face.bounds.origin.x + face.bounds.size.width / 2;
    const centerY = face.bounds.origin.y + face.bounds.size.height / 2;
    const positionScore =
      1 - Math.abs(0.5 - centerX / 400) - Math.abs(0.5 - centerY / 400); // Assuming 400px image
    score += Math.max(0, positionScore) * 0.2;

    if (positionScore < 0.7) {
      recommendations.push("Center your face in the camera frame");
    }

    // Eye detection assessment (25% weight)
    const eyeScore =
      (face.leftEyeOpenProbability || 0) * (face.rightEyeOpenProbability || 0);
    score += eyeScore * 0.25;

    if (eyeScore < 0.7) {
      recommendations.push(
        "Keep both eyes open and look directly at the camera",
      );
    }

    // Head pose assessment (25% weight)
    const rollAngle = Math.abs(face.rollAngle || 0);
    const yawAngle = Math.abs(face.yawAngle || 0);
    const poseScore = Math.max(0, 1 - (rollAngle + yawAngle) / 60); // Prefer angles < 30 degrees
    score += poseScore * 0.25;

    if (poseScore < 0.7) {
      recommendations.push(
        "Keep your head straight and face the camera directly",
      );
    }

    // Determine overall quality
    let overall: "excellent" | "good" | "fair" | "poor";
    if (score >= 0.8) overall = "excellent";
    else if (score >= 0.6) overall = "good";
    else if (score >= 0.4) overall = "fair";
    else overall = "poor";

    return { overall, score, recommendations };
  }

  private async assessLiveness(
    face: FaceDetector.FaceFeature,
  ): Promise<number> {
    // Basic liveness assessment based on available features
    let livenessScore = 0.5; // Base score

    // Eye blink detection
    const leftEyeOpen = face.leftEyeOpenProbability || 0;
    const rightEyeOpen = face.rightEyeOpenProbability || 0;
    const eyeScore = (leftEyeOpen + rightEyeOpen) / 2;

    // Prefer partially open eyes (indicates natural blinking)
    if (eyeScore > 0.3 && eyeScore < 0.9) {
      livenessScore += 0.2;
    }

    // Smile detection (indicates natural expression)
    const smileScore = face.smilingProbability || 0;
    if (smileScore > 0.1 && smileScore < 0.8) {
      livenessScore += 0.1;
    }

    // Head pose variation (slight movement indicates liveness)
    const headMovement =
      Math.abs(face.rollAngle || 0) + Math.abs(face.yawAngle || 0);
    if (headMovement > 2 && headMovement < 15) {
      livenessScore += 0.2;
    }

    return Math.min(1, livenessScore);
  }

  private async generateFaceId(
    face: FaceDetector.FaceFeature,
  ): Promise<string> {
    // Generate a unique face ID based on facial features
    const features = {
      bounds: face.bounds,
      rollAngle: face.rollAngle,
      yawAngle: face.yawAngle,
    };

    const featuresString = JSON.stringify(features);
    const encoder = new TextEncoder();
    const data = encoder.encode(featuresString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private async storeFaceBiometric(
    userId: string,
    faceData: FaceDetectionResult,
  ): Promise<void> {
    const biometricData = {
      type: "face" as const,
      data: {
        faceId: faceData.faceId,
        bounds: faceData.bounds,
        quality: faceData.quality,
        confidence: faceData.confidence,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        deviceInfo: await this.getDeviceInfo(),
      },
    };

    await this.biometricStorage.storeBiometricData(userId, biometricData);
  }

  private async compareFaces(
    currentFace: FaceDetectionResult,
    storedBiometric: any,
  ): Promise<{
    match: boolean;
    confidence: number;
  }> {
    try {
      const stored = storedBiometric.data;

      // Compare face bounds
      const boundsSimilarity = this.calculateBoundsSimilarity(
        currentFace.bounds,
        stored.bounds,
      );

      // Use bounds similarity as the main comparison
      const threshold = 0.75; // Configurable threshold

      return {
        match: boundsSimilarity >= threshold,
        confidence: boundsSimilarity,
      };
    } catch (error) {
      ErrorHandlingService.logError("FACE_COMPARISON_ERROR", error as Error, {
        context: "FaceDetectionService.compareFaces",
      });

      return {
        match: false,
        confidence: 0,
      };
    }
  }

  private calculateBoundsSimilarity(bounds1: any, bounds2: any): number {
    if (!bounds1 || !bounds2) return 0;

    const widthDiff = Math.abs(bounds1.size.width - bounds2.size.width);
    const heightDiff = Math.abs(bounds1.size.height - bounds2.size.height);
    const xDiff = Math.abs(bounds1.origin.x - bounds2.origin.x);
    const yDiff = Math.abs(bounds1.origin.y - bounds2.origin.y);

    const totalDiff = widthDiff + heightDiff + xDiff + yDiff;
    const maxDiff = 200; // Maximum expected difference for a match

    return Math.max(0, 1 - totalDiff / maxDiff);
  }

  private async getDeviceInfo(): Promise<any> {
    try {
      const deviceInfo = {
        platform: "expo",
        timestamp: new Date().toISOString(),
      };
      return deviceInfo;
    } catch (error) {
      return { platform: "unknown", timestamp: new Date().toISOString() };
    }
  }

  public async captureFaceImage(): Promise<string | null> {
    try {
      // This would be called from a camera component
      // Return the captured image URI
      return null; // Placeholder - actual implementation depends on camera component
    } catch (error) {
      ErrorHandlingService.logError("FACE_CAPTURE_ERROR", error as Error, {
        context: "FaceDetectionService.captureFaceImage",
      });
      return null;
    }
  }

  public async validateFaceForShift(
    userId: string,
    imageUri: string,
  ): Promise<{
    success: boolean;
    message: string;
    confidence?: number;
  }> {
    try {
      const verificationResult = await this.verifyFace(imageUri, userId);

      if (!verificationResult.success) {
        return {
          success: false,
          message: verificationResult.message,
        };
      }

      if (!verificationResult.match) {
        return {
          success: false,
          message:
            "Face verification failed. Please try again or contact your supervisor.",
        };
      }

      return {
        success: true,
        message: "Face verification successful",
        confidence: verificationResult.confidence,
      };
    } catch (error) {
      ErrorHandlingService.logError(
        "FACE_SHIFT_VALIDATION_ERROR",
        error as Error,
        {
          context: "FaceDetectionService.validateFaceForShift",
          userId,
        },
      );

      return {
        success: false,
        message: "Face verification failed due to technical error",
      };
    }
  }
}

export default FaceDetectionService;
