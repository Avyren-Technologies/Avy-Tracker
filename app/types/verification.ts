import { FaceVerificationResult } from './faceDetection';

export interface LocationResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  isInGeofence?: boolean;
  geofenceName?: string;
  error?: string;
  confidence?: number;
  overridden?: boolean;
  overrideReason?: string;
}

export interface VerificationStep {
  type: 'location' | 'face';
  required: boolean;
  completed: boolean;
  result?: LocationResult | FaceVerificationResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startTime?: number;
  endTime?: number;
}

export interface VerificationFlowState {
  sessionId: string;
  userId: number;
  shiftAction: 'start' | 'end';
  steps: VerificationStep[];
  currentStepIndex: number;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'overridden';
  confidenceScore: number;
  fallbackMode: boolean;
  canOverride: boolean;
  overrideReason?: string;
  startTime: number;
  endTime?: number;
  auditLog: VerificationAuditEntry[];
}

export interface VerificationAuditEntry {
  timestamp: number;
  event: string;
  details: any;
  stepType?: 'location' | 'face';
  success?: boolean;
  error?: string;
  latency?: number;
}

export interface VerificationConfig {
  requireLocation: boolean;
  requireFace: boolean;
  allowLocationFallback: boolean;
  allowFaceFallback: boolean;
  maxRetries: number;
  timeoutMs: number;
  confidenceThreshold: number;
}

export interface VerificationFlowSummary {
  sessionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'overridden';
  progress: string;
  confidenceScore: number;
  totalLatency: number | null;
  canOverride: boolean;
  fallbackMode: boolean;
  completedSteps: string[];
  failedSteps: string[];
  nextStep: string | null;
}

export interface VerificationPerformanceMetrics {
  sessionId: string;
  userId: number;
  shiftAction: 'start' | 'end';
  totalLatency: number;
  stepCount: number;
  completedSteps: number;
  failedSteps: number;
  retryCount: number;
  confidenceScore: number;
  fallbackMode: boolean;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'overridden';
  avgStepLatency: number;
  maxStepLatency: number;
  stepBreakdown: Array<{
    type: 'location' | 'face';
    latency: number;
    retries: number;
  }>;
  auditLogEntries: number;
  timestamp: number;
}

export interface VerificationStepMetrics {
  type: 'location' | 'face';
  startTime: number;
  endTime?: number;
  latency?: number;
  retryCount: number;
  success: boolean;
  confidence?: number;
  error?: string;
}