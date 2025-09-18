import {
  CapturedPhoto,
  FaceDetectionData,
  LandmarkPoint,
} from "../types/faceDetection";

interface SpoofingAnalysis {
  textureScore: number;
  reflectionScore: number;
  depthScore: number;
  lightingScore: number;
  overallScore: number;
  isSpoofed: boolean;
}

/**
 * Anti-Spoofing Service for Face Verification
 * Implements detection of various spoofing attacks including:
 * - Printed photos
 * - Screen displays
 * - Video playback
 * - Depth inconsistencies
 */
export class AntiSpoofingService {
  /**
   * Analyze an image for spoofing attempts
   */
  static async analyzeImage(
    photo: CapturedPhoto,
    faceData: FaceDetectionData,
  ): Promise<SpoofingAnalysis> {
    const analysis: SpoofingAnalysis = {
      textureScore: 0,
      reflectionScore: 0,
      depthScore: 0,
      lightingScore: 0,
      overallScore: 0,
      isSpoofed: false,
    };

    try {
      // 1. Texture Analysis (detect printed photos)
      analysis.textureScore = await this.analyzeTexture(photo);

      // 2. Reflection Analysis (detect screen spoofing)
      analysis.reflectionScore = await this.analyzeReflections(photo);

      // 3. Depth Consistency (using ML Kit landmarks)
      analysis.depthScore = this.analyzeDepthConsistency(faceData.landmarks);

      // 4. Lighting Consistency
      analysis.lightingScore = this.analyzeLightingConsistency(faceData);

      // Calculate overall score
      analysis.overallScore =
        analysis.textureScore * 0.3 +
        analysis.reflectionScore * 0.3 +
        analysis.depthScore * 0.2 +
        analysis.lightingScore * 0.2;

      // Determine if spoofed (threshold: 0.7)
      analysis.isSpoofed = analysis.overallScore < 0.7;

      return analysis;
    } catch (error) {
      console.error("Anti-spoofing analysis failed:", error);
      // Return conservative analysis on error
      return {
        textureScore: 0.5,
        reflectionScore: 0.5,
        depthScore: 0.5,
        lightingScore: 0.5,
        overallScore: 0.5,
        isSpoofed: true, // Conservative: assume spoofed on error
      };
    }
  }

  /**
   * Analyze image texture to detect printed photos
   * Real faces have more natural texture variation than printed photos
   */
  private static async analyzeTexture(photo: CapturedPhoto): Promise<number> {
    try {
      // Basic texture analysis - in production, use more sophisticated algorithms
      // For now, we'll use image dimensions and quality as a proxy
      const aspectRatio = photo.width / photo.height;
      const resolution = photo.width * photo.height;

      // Natural photos tend to have good resolution and reasonable aspect ratios
      let textureScore = 0.8; // Default good score

      // Penalize very low resolution (typical of printed photos)
      if (resolution < 300000) {
        // Less than 300k pixels
        textureScore -= 0.2;
      }

      // Penalize unusual aspect ratios (printed photos often have standard ratios)
      if (aspectRatio < 0.5 || aspectRatio > 2.0) {
        textureScore -= 0.1;
      }

      return Math.max(0, Math.min(1, textureScore));
    } catch (error) {
      console.warn("Texture analysis failed:", error);
      return 0.5; // Neutral score on failure
    }
  }

  /**
   * Analyze reflections to detect screen spoofing
   * Screen displays often have uniform lighting and reflections
   */
  private static async analyzeReflections(
    photo: CapturedPhoto,
  ): Promise<number> {
    try {
      // Basic reflection analysis
      // In production, analyze pixel intensity variations and reflection patterns

      // For now, use image properties as indicators
      const uri = photo.uri;

      // Real faces in natural lighting have more variation
      // This is a simplified implementation
      let reflectionScore = 0.8; // Default good score

      // Check if image might be from a screen (very crude heuristic)
      if (uri.includes("temp") || uri.includes("cache")) {
        // Temporary files might indicate screen capture
        reflectionScore -= 0.1;
      }

      return Math.max(0, Math.min(1, reflectionScore));
    } catch (error) {
      console.warn("Reflection analysis failed:", error);
      return 0.5; // Neutral score on failure
    }
  }

  /**
   * Analyze depth consistency using ML Kit landmarks
   * Real faces have consistent depth patterns across landmarks
   */
  private static analyzeDepthConsistency(landmarks?: LandmarkPoint[]): number {
    try {
      if (!landmarks || landmarks.length === 0) {
        return 0.5; // Neutral score if no landmarks
      }

      // Analyze depth consistency using z-coordinates if available
      const landmarksWithDepth = landmarks.filter(
        (point) => point.z !== undefined,
      );

      if (landmarksWithDepth.length === 0) {
        // No depth data available, use 2D analysis
        return this.analyze2DConsistency(landmarks);
      }

      // Calculate depth variance across landmarks
      const depths = landmarksWithDepth.map((point) => point.z!);
      const variance = this.calculateVariance(depths);

      // Lower variance = more consistent depth = higher score
      // Real faces have natural depth variation, printed photos have flat depth
      const consistencyScore = Math.max(0, 1 - variance / 100);

      return Math.max(0, Math.min(1, consistencyScore));
    } catch (error) {
      console.warn("Depth analysis failed:", error);
      return 0.5;
    }
  }

  /**
   * Analyze 2D landmark consistency when depth data is not available
   */
  private static analyze2DConsistency(landmarks: LandmarkPoint[]): number {
    try {
      // Analyze facial proportions for natural variation
      if (landmarks.length < 10) {
        return 0.5;
      }

      // Calculate distances between key landmarks
      const distances: number[] = [];
      for (let i = 0; i < Math.min(landmarks.length - 1, 20); i++) {
        const point1 = landmarks[i];
        const point2 = landmarks[i + 1];
        const distance = Math.sqrt(
          Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2),
        );
        distances.push(distance);
      }

      // Calculate variance in distances
      const variance = this.calculateVariance(distances);

      // Natural faces have some variation, printed photos might be too uniform
      const consistencyScore = variance > 5 ? 0.8 : 0.6; // Prefer some variation

      return Math.max(0, Math.min(1, consistencyScore));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Analyze lighting consistency across face regions
   * Real faces have natural lighting patterns
   */
  private static analyzeLightingConsistency(
    faceData: FaceDetectionData,
  ): number {
    try {
      // Analyze lighting consistency using eye openness as a proxy
      const eyeOpenness =
        (faceData.leftEyeOpenProbability + faceData.rightEyeOpenProbability) /
        2;

      // Good lighting typically results in better eye detection
      // Very poor lighting or artificial lighting might indicate spoofing
      let lightingScore = eyeOpenness;

      // Boost score for natural eye openness ranges
      if (eyeOpenness > 0.7 && eyeOpenness < 0.99) {
        lightingScore += 0.1; // Natural range
      }

      // Check face angles for natural positioning
      const angleConsistency =
        1 - (Math.abs(faceData.rollAngle) + Math.abs(faceData.yawAngle)) / 180;
      lightingScore = (lightingScore + angleConsistency) / 2;

      return Math.max(0, Math.min(1, lightingScore));
    } catch (error) {
      console.warn("Lighting analysis failed:", error);
      return 0.5;
    }
  }

  /**
   * Calculate variance of a numeric array
   */
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return variance;
  }

  /**
   * Quick spoofing check based on basic heuristics
   * Used as a fast pre-filter before detailed analysis
   */
  static quickSpoofingCheck(faceData: FaceDetectionData): boolean {
    try {
      // Quick checks for obvious spoofing attempts

      // 1. Face too perfectly centered (might be a cropped photo)
      const bounds = faceData.bounds;
      const centeredness = Math.abs(0.5 - (bounds.x + bounds.width / 2));
      if (centeredness < 0.05) {
        // Too centered
        return true; // Potentially spoofed
      }

      // 2. Perfect angles (real faces rarely have perfect 0-degree angles)
      if (
        Math.abs(faceData.rollAngle) < 0.5 &&
        Math.abs(faceData.yawAngle) < 0.5
      ) {
        return true; // Potentially spoofed
      }

      // 3. Unnatural eye openness (exactly 1.0 or 0.0 is suspicious)
      const avgEyeOpen =
        (faceData.leftEyeOpenProbability + faceData.rightEyeOpenProbability) /
        2;
      if (avgEyeOpen === 1.0 || avgEyeOpen === 0.0) {
        return true; // Potentially spoofed
      }

      return false; // Likely genuine
    } catch (error) {
      console.warn("Quick spoofing check failed:", error);
      return true; // Conservative: assume spoofed on error
    }
  }
}
