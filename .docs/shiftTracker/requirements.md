# Shift Start/End Face + Geofence Verification (ShiftTracker)

## Feature Metadata

- **Feature Name**: Shift Start/End Face + Geofence Verification (ShiftTracker)
- **Short Description**: Add a small live map and biometric face verification to @shiftTracker.tsx — show current location and geofence name if inside a geofence; capture an auto-photo on eye-blink and validate it against registered user photo when starting/ending shifts. Provide registration and settings (OTP-based) to add/remove face.
- **Business Goals / Success Metrics**:
  - Reduce buddy-punching and fraudulent shift starts by ≥ 90% (relative to baseline)
  - 98% successful face verification for supported devices
  - Photo validation and geofence check complete within 3 seconds on average
  - Zero PII data leaks; all biometric data stored and transmitted encrypted
- **Priority**: HIGH
- **User Roles Affected**: Employee (primary), Manager (audit/override), Admin (configure policies)
- **Platforms**: React Native (ShiftTracker.tsx) mobile app, Backend API, Database
- **Related Modules or Repos**: shift-tracker UI module, auth service, location-service, camera/biometrics module, settings module
- **API/Back-end Services Impacted**: `/api/users/photo/register`, `/api/users/photo/verify`, `/api/shifts/start`, `/api/shifts/end`, `/api/geofences/nearby`, `/api/settings/face-config/otp`
- **DB Changes Expected**: YES — add fields to `users` and `employee_shifts` tables (no new audit tables)
- **Constraints / Non-functional**: GDPR/PII compliance, encryption at rest and in transit, consent capture, multi-tenant isolation, offline-friendly queueing, latency goal < 3s for verification
- **Out-of-scope**: Integration with third-party commercial face databases; advanced continuous liveness beyond blink; full facial recognition accuracy tuning beyond initial threshold tuning
- **Example UI Flow**: User opens ShiftTracker -> small inline map shows location + geofence name (if in one) -> user taps Start Shift -> app validates current rules -> camera monitors for blink and auto-captures live photo -> app sends verification request -> on success, start shift; end shift follows same flow. First-time users prompted to register face on first login. Settings page contains Add/Remove face with OTP confirmation.

## Problem Statement

The current shift tracking system relies solely on GPS location and manual user input, making it vulnerable to buddy-punching and fraudulent shift starts. Employees can start shifts for others or manipulate their location data. Additionally, the system lacks visual confirmation of user presence and geofence awareness, reducing trust in attendance records.

**Success Metrics**:
- 90% reduction in buddy-punching incidents
- 98% face verification success rate
- <3 second verification latency
- Zero PII data breaches
- 95% user adoption rate within 30 days

## Stakeholders

- **Primary Users**: Employees using shift tracking
- **Secondary Users**: Group Admins monitoring attendance
- **Tertiary Users**: Management personnel reviewing reports
- **System Administrators**: Configuring face verification policies
- **Compliance Officers**: Ensuring GDPR/PII compliance
- **Security Team**: Monitoring verification attempts and fraud patterns

## Functional Requirements

### FR-001: Small Embedded Map in ShiftTracker

**User Story**: As an Employee, I want to see my current location and nearby work areas on a small map within the ShiftTracker, so that I can verify I'm in the correct location before starting my shift.

**Acceptance Criteria**:
- GIVEN the user opens `@shiftTracker.tsx` WHEN the component loads THEN a small map panel (300x200px) displays below the current time display
- GIVEN the user is inside a defined geofence WHEN the map loads THEN the geofence name appears as a tooltip/label on the map
- GIVEN the user's location changes WHEN the change exceeds 10 meters THEN the map updates to show the new position
- GIVEN the map is displayed WHEN the user taps on it THEN it expands to full screen for detailed viewing
- GIVEN the map is in full screen WHEN the user taps the collapse button THEN it returns to the small panel size
- GIVEN the device has poor GPS signal WHEN the map loads THEN it shows a "Location unavailable" message with retry option

**Requirement Mapping**: Maps to Tasks [T-001], [T-002], [T-003]

### FR-002: Face Verification on Shift Start/End

**User Story**: As an Employee, I want the system to automatically verify my identity using facial recognition when starting or ending shifts, so that my attendance is securely recorded and cannot be manipulated by others.

**Acceptance Criteria**:
- GIVEN the user taps "Start Shift" WHEN the button is pressed THEN the camera activates and begins monitoring for eye blinks
- GIVEN the camera detects an eye blink WHEN a blink is detected THEN a photo is automatically captured without user intervention
- GIVEN a photo is captured WHEN the capture completes THEN it's immediately sent to `/api/users/photo/verify` with location and device metadata
- GIVEN the verification request is sent WHEN the server responds THEN the shift only starts if face match score exceeds 0.85 and all other validations pass, and the verification outcome is written to `employee_shifts` fields (`face_verified`, `face_verification_time`, `face_verification_method`, `face_verification_score`, `face_verification_hash`)
- GIVEN verification fails WHEN 3 consecutive attempts fail THEN the system falls back to Manager override flow
- GIVEN the user is offline WHEN attempting to start a shift THEN the verification request is queued locally and processed when network is restored

**Requirement Mapping**: Maps to Tasks [T-004], [T-005], [T-006], [T-007]

### FR-003: Initial Face Registration

**User Story**: As a new Employee, I want to register my face securely during first login, so that I can use face verification for future shift tracking.

**Acceptance Criteria**:
- GIVEN the user logs in for the first time WHEN authentication succeeds THEN a face registration prompt appears with clear consent language
- GIVEN the user consents to face registration WHEN consent is given THEN the camera activates with instructions for optimal photo capture
- GIVEN the user follows capture instructions WHEN photos are taken THEN the system captures 3-5 images from different angles for template generation
- GIVEN multiple photos are captured WHEN processing completes THEN the system stores encrypted face template hash and a reference image URL in `users` (no raw templates in plaintext)
- GIVEN face registration succeeds WHEN the process completes THEN the user receives confirmation and can proceed to use shift tracking
- GIVEN face registration fails WHEN an error occurs THEN the user receives clear error message and retry instructions

**Requirement Mapping**: Maps to Tasks [T-008], [T-009], [T-010]

### FR-004: Settings Face Configuration

**User Story**: As an Employee, I want to manage my face registration settings with secure OTP verification, so that I can update or remove my biometric data when needed.

**Acceptance Criteria**:
- GIVEN the user navigates to Settings WHEN the face configuration section is accessed THEN options to Add/Remove face are displayed
- GIVEN the user selects "Add Face" WHEN the option is chosen THEN an OTP is sent to their verified phone/email
- GIVEN the user receives OTP WHEN they enter the code THEN the system verifies the OTP before allowing face registration
- GIVEN the user selects "Remove Face" WHEN the option is chosen THEN an OTP is sent and verification required before removal
- GIVEN face removal is confirmed WHEN the process completes THEN all biometric data is permanently deleted and the action is recorded using existing logging (no new audit tables)
- GIVEN OTP verification fails WHEN 3 attempts are made THEN the action is blocked for 15 minutes with security notification

**Requirement Mapping**: Maps to Tasks [T-011], [T-012], [T-013]

### FR-005: Fallback and Error Handling

**User Story**: As an Employee, I want clear guidance when face verification is unavailable, so that I can still complete my shift tracking with alternative methods.

**Acceptance Criteria**:
- GIVEN camera permission is denied WHEN the app requests access THEN clear instructions are shown on how to enable camera in device settings
- GIVEN camera is unavailable WHEN attempting shift start THEN alternative OTP verification is offered if policy allows
- GIVEN verification fails 3 times WHEN attempting shift start THEN Manager override flow is initiated with notification to relevant admin
- GIVEN the device is offline WHEN verification is required THEN requests are queued locally with "Pending Verification" status
- GIVEN network is restored WHEN queued requests exist THEN verification processes automatically and shift status updates accordingly
- GIVEN low light conditions WHEN attempting capture THEN the system provides guidance and attempts to optimize camera settings

**Requirement Mapping**: Maps to Tasks [T-014], [T-015], [T-016]

## Non-Functional Requirements

### Performance Requirements
- Face verification must complete within 3 seconds on supported devices
- Map updates must not exceed 500ms for location changes
- Camera activation must complete within 1 second
- Offline queue processing must not block UI interactions

### Security Requirements
- All biometric data must be encrypted at rest using AES-256
- Face templates must be hashed using PBKDF2 with minimum 100,000 iterations
- API endpoints must implement rate limiting (max 10 attempts per minute)
- All verification attempts must be logged with device fingerprinting using existing logging (e.g., `error_logs` for failures) — no new audit tables

### Accessibility Requirements
- Map labels must meet WCAG AA contrast ratios (4.5:1 minimum)
- Camera instructions must include audio descriptions
- Error messages must be screen reader compatible
- Touch targets must meet minimum 44x44px size requirements

### Offline Behavior
- Verification requests must queue locally when offline
- Shift status must show "Pending Verification" during offline periods
- Local storage must encrypt sensitive data using device keychain
- Sync must resume automatically when network connectivity is restored

## Data & Privacy Requirements

### Consent Management
- Explicit consent must be captured before face registration
- Consent must be time-stamped and logged with user ID
- Users must be able to withdraw consent at any time
- Consent withdrawal must trigger immediate data deletion

### Data Retention
- Raw face images must be deleted within 24 hours of template generation
- Face templates must be retained for active employment period only
- Verification logs must be retained for 7 years for compliance
- Deleted user data must be permanently removed within 30 days

### PII Protection
- No biometric data may be stored in plaintext
- All API communications must use TLS 1.3 encryption
- Database connections must use encrypted connections
- Operational logs must not contain sensitive biometric information

## Role-Interaction Matrix

| Feature | Employee | Manager | Admin |
|---------|----------|---------|-------|
| View embedded map | ✅ Read | ✅ Read | ✅ Read |
| Start/End shift with face verification | ✅ Full | ✅ Full | ✅ Full |
| Register face | ✅ Full | ❌ | ❌ |
| Manage face settings | ✅ Full | ❌ | ❌ |
| Override failed verification | ❌ | ✅ Full | ✅ Full |
| Configure verification policies | ❌ | ❌ | ✅ Full |
| View verification status in shift history | ✅ Read (own) | ✅ Read | ✅ Full |
| Manage face registration for users | ❌ | ❌ | ✅ Full |

## Edge Cases and Error States

### Camera and Permission Issues
- Camera permission denied: Show settings navigation guide
- Camera hardware failure: Fallback to OTP verification
- Multiple camera devices: Use primary camera by default
- Camera in use by other app: Show "Camera busy" message

### Biometric Verification Edge Cases
- Multiple faces detected: Reject capture and show "Single person only" message
- Poor lighting conditions: Provide lighting guidance and retry
- Face partially obscured: Show "Face fully visible" instruction
- Rapid movement: Wait for stable positioning before capture

### Network and Offline Scenarios
- Intermittent connectivity: Queue requests and retry with exponential backoff
- Server timeout: Retry up to 3 times with user notification
- Rate limiting exceeded: Show "Too many attempts" message with cooldown
- API service unavailable: Queue requests and show offline indicator

### Security and Fraud Prevention
- Device fingerprint mismatch: Block verification and log security event
- Unusual verification patterns: Flag for manual review (via monitoring/alerts, no audit tables)
- Concurrent verification attempts: Allow only one active session
- Location spoofing detection: Validate GPS accuracy and consistency

## Done Criteria

### Development Complete
- [ ] All functional requirements implemented and tested
- [ ] Non-functional requirements validated
- [ ] Security review completed and approved
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met

### Quality Assurance
- [ ] Unit tests achieve 90% coverage
- [ ] Integration tests pass for all scenarios
- [ ] E2E tests cover critical user journeys
- [ ] Manual testing completed on iOS and Android
- [ ] Security penetration testing completed

### Documentation and Training
- [ ] API documentation updated
- [ ] User guides created for all roles
- [ ] Admin configuration guide completed
- [ ] Support team training materials ready
- [ ] Rollback procedures documented

## Rollout Plan

### Phase 1: Feature Flag Deployment (Week 1)
- Deploy feature with 100% disabled flag
- Run database migrations
- Deploy monitoring and alerting
- Conduct internal testing

### Phase 2: Internal Testing (Week 2-3)
- Enable feature for internal users (10%)
- Collect feedback and performance metrics
- Fix critical issues
- Validate security measures

### Phase 3: Beta Rollout (Week 4-5)
- Enable feature for beta users (25%)
- Monitor system performance
- Gather user feedback
- Finalize configuration

### Phase 4: Full Rollout (Week 6)
- Enable feature for all users
- Monitor system health
- Provide user support
- Track success metrics

## Open Questions & Assumptions

### Open Questions
1. What is the minimum device specification for face verification?
2. How should we handle users with multiple registered faces?
3. What is the acceptable false positive/negative rate for verification?
4. How long should verification attempts be cached to prevent replay attacks?

### Assumptions
1. All target devices support camera and face detection APIs
2. Users have stable internet connectivity during verification
3. Face verification accuracy meets business requirements
4. Regulatory compliance requirements are understood and implementable
5. Users will accept face verification as a security measure

---

## Notes for Reviewers

**Please verify**:
- All functional requirements have clear acceptance criteria
- Non-functional requirements are measurable and testable
- Security requirements align with organizational policies
- Privacy requirements meet GDPR compliance standards
- Rollout plan includes adequate testing phases
- Edge cases cover realistic failure scenarios
- Requirements traceability is maintained throughout the document
