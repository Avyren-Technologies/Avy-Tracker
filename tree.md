.
├── Dockerfile
├── GEMINI.md
├── LICENSE
├── README.md
├── app
│   ├── (auth)
│   │   ├── _layout.tsx
│   │   ├── components
│   │   │   └── MFAVerification.tsx
│   │   ├── forgot-password.tsx
│   │   └── signin.tsx
│   ├── (dashboard)
│   │   ├── Group-Admin
│   │   │   ├── attendance-management
│   │   │   │   └── index.tsx
│   │   │   ├── components
│   │   │   │   ├── ChangePasswordForm.tsx
│   │   │   │   ├── DocumentViewer.tsx
│   │   │   │   ├── EditTaskModal.tsx
│   │   │   │   ├── RejectModal.tsx
│   │   │   │   └── TaskCard.tsx
│   │   │   ├── employee-management
│   │   │   │   ├── bulk.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   └── individual.tsx
│   │   │   ├── expense-management
│   │   │   │   ├── [id].tsx
│   │   │   │   └── index.tsx
│   │   │   ├── face-configuration.tsx
│   │   │   ├── face-registration.tsx
│   │   │   ├── group-admin.tsx
│   │   │   ├── leave-insights
│   │   │   │   ├── components
│   │   │   │   │   ├── LeaveBalance.tsx
│   │   │   │   │   └── LeaveRequests.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── leave-management
│   │   │   │   ├── components
│   │   │   │   │   ├── LeaveApprovals.tsx
│   │   │   │   │   ├── LeaveBalances.tsx
│   │   │   │   │   ├── LeavePolicies.tsx
│   │   │   │   │   ├── LeaveRequests.tsx
│   │   │   │   │   └── LeaveTypes.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── reports
│   │   │   │   ├── components
│   │   │   │   │   ├── AttendanceReports.tsx
│   │   │   │   │   ├── ExpenseReports.tsx
│   │   │   │   │   ├── GraphSelector.tsx
│   │   │   │   │   ├── LeaveReports.tsx
│   │   │   │   │   ├── PerformanceReports.tsx
│   │   │   │   │   ├── ReportCard.tsx
│   │   │   │   │   ├── TaskReports.tsx
│   │   │   │   │   ├── TravelReports.tsx
│   │   │   │   │   └── pdf-templates
│   │   │   │   │       ├── AttendanceTemplate.tsx
│   │   │   │   │       ├── BaseTemplate.tsx
│   │   │   │   │       ├── ExpenseTemplate.tsx
│   │   │   │   │       ├── LeaveTemplate.tsx
│   │   │   │   │       ├── PerformanceTemplate.tsx
│   │   │   │   │       ├── TaskTemplate.tsx
│   │   │   │   │       └── TravelTemplate.tsx
│   │   │   │   ├── services
│   │   │   │   │   └── PDFGenerator.ts
│   │   │   │   └── types.ts
│   │   │   ├── reports.tsx
│   │   │   ├── settings
│   │   │   │   ├── About.tsx
│   │   │   │   ├── ChangePassword.tsx
│   │   │   │   ├── ExpenseApprovalRules.tsx
│   │   │   │   ├── HelpSupport.tsx
│   │   │   │   ├── LeaveWorkflowConfig.tsx
│   │   │   │   ├── Notifications.tsx
│   │   │   │   ├── PrivacySecurity.tsx
│   │   │   │   ├── ProfileSettings.tsx
│   │   │   │   ├── TrackingSettings.tsx
│   │   │   │   └── UserPermissions.tsx
│   │   │   ├── settings.tsx
│   │   │   ├── task-management.tsx
│   │   │   ├── tracking
│   │   │   │   ├── analytics.tsx
│   │   │   │   ├── employee-tracking-settings.tsx
│   │   │   │   ├── geofence-management.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── types.ts
│   │   │   └── utils
│   │   │       └── navigationItems.ts
│   │   ├── _layout.tsx
│   │   ├── employee
│   │   │   ├── FingerPrintAuthentication.md
│   │   │   ├── components
│   │   │   │   ├── AddEventModal.tsx
│   │   │   │   ├── AddScheduleModal.tsx
│   │   │   │   ├── EditScheduleModal.tsx
│   │   │   │   ├── NumberToWords.tsx
│   │   │   │   └── TaskList.tsx
│   │   │   ├── employee.tsx
│   │   │   ├── employeeExpenses.tsx
│   │   │   ├── employeeSchedule.tsx
│   │   │   ├── employeeSettings.tsx
│   │   │   ├── face-configuration.tsx
│   │   │   ├── face-registration.tsx
│   │   │   ├── leave-insights
│   │   │   │   ├── components
│   │   │   │   │   ├── LeaveApprovalList.tsx
│   │   │   │   │   ├── LeaveApprovals.tsx
│   │   │   │   │   ├── LeaveBalances.tsx
│   │   │   │   │   ├── LeaveCalendar.tsx
│   │   │   │   │   ├── LeavePolicies.tsx
│   │   │   │   │   ├── LeaveRequestForm.tsx
│   │   │   │   │   ├── LeaveRequests.tsx
│   │   │   │   │   ├── LeaveWorkflowConfig.tsx
│   │   │   │   │   └── RequestLeaveModal.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── myExpenses.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── profile.tsx
│   │   │   ├── settings
│   │   │   │   ├── LiveChat
│   │   │   │   │   ├── components
│   │   │   │   │   │   └── ChatMessage.tsx
│   │   │   │   │   └── index.tsx
│   │   │   │   ├── changePassword.tsx
│   │   │   │   ├── editProfile.tsx
│   │   │   │   ├── help.tsx
│   │   │   │   ├── support.tsx
│   │   │   │   └── terms.tsx
│   │   │   ├── tracking
│   │   │   │   ├── index.tsx
│   │   │   │   └── shift-management.tsx
│   │   │   ├── types.ts
│   │   │   └── utils
│   │   │       └── navigationItems.ts
│   │   ├── management
│   │   │   ├── analytics.tsx
│   │   │   ├── approvals.tsx
│   │   │   ├── face-configuration.tsx
│   │   │   ├── face-registration.tsx
│   │   │   ├── group-admin-management
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── bulk.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   └── individual.tsx
│   │   │   ├── index.tsx
│   │   │   ├── leave-insights
│   │   │   │   ├── components
│   │   │   │   │   ├── LeaveBalanceTracker.tsx
│   │   │   │   │   └── LeaveRequests.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── leave-management
│   │   │   │   ├── components
│   │   │   │   │   ├── LeaveAnalytics.tsx
│   │   │   │   │   ├── LeaveApprovals.tsx
│   │   │   │   │   ├── LeaveBalanceManager.tsx
│   │   │   │   │   ├── LeaveBalances.tsx
│   │   │   │   │   ├── LeavePolicies.tsx
│   │   │   │   │   └── LeaveTypes.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── management.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── profile.tsx
│   │   │   ├── settings
│   │   │   │   ├── about.tsx
│   │   │   │   ├── change-password.tsx
│   │   │   │   ├── help.tsx
│   │   │   │   ├── notifications.tsx
│   │   │   │   ├── privacy.tsx
│   │   │   │   ├── profile.tsx
│   │   │   │   ├── reports.tsx
│   │   │   │   └── team.tsx
│   │   │   ├── settings.tsx
│   │   │   └── utils
│   │   │       └── navigationItems.ts
│   │   ├── shared
│   │   │   ├── AttendanceRegularization.tsx
│   │   │   ├── attendanceManagement.tsx
│   │   │   ├── components
│   │   │   │   ├── BatteryLevelIndicator.tsx
│   │   │   │   ├── StatusIndicator.tsx
│   │   │   │   ├── customModal.tsx
│   │   │   │   └── map
│   │   │   │       ├── LiveTrackingMap.tsx
│   │   │   │       ├── LocationMarker.tsx
│   │   │   │       ├── MapView.tsx
│   │   │   │       └── TrackedUsersList.tsx
│   │   │   └── shiftTracker.tsx
│   │   ├── super-admin
│   │   │   ├── add-company.tsx
│   │   │   ├── company
│   │   │   │   └── [id].tsx
│   │   │   ├── company_management.tsx
│   │   │   ├── create-user.tsx
│   │   │   ├── index.tsx
│   │   │   ├── reports.tsx
│   │   │   ├── security.tsx
│   │   │   ├── settings
│   │   │   │   ├── change-passwordSettings.tsx
│   │   │   │   ├── subscriptionsSettings.tsx
│   │   │   │   └── usersSettings.tsx
│   │   │   ├── settings.tsx
│   │   │   ├── super-admin.tsx
│   │   │   ├── system-config.tsx
│   │   │   └── utils
│   │   │       └── navigationItems.ts
│   │   └── tracking-test.tsx
│   ├── +not-found.tsx
│   ├── _layout.tsx
│   ├── components
│   │   ├── AccessibilityHelper.tsx
│   │   ├── AsyncLoadingStates.tsx
│   │   ├── BackgroundTrackingNotification.tsx
│   │   ├── BiometricAuthWrapper.tsx
│   │   ├── BottomNav.tsx
│   │   ├── EmbeddedMap.tsx
│   │   ├── EmployeeEditModal.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorDisplay.tsx
│   │   ├── FaceDetectionQualityFeedback.tsx
│   │   ├── FacePositioningGuide.tsx
│   │   ├── FaceVerificationModal.tsx
│   │   ├── GroupAdminEditModal.tsx
│   │   ├── LightingConditionFeedback.tsx
│   │   ├── NotificationBadge.tsx
│   │   ├── OTPErrorModal.tsx
│   │   ├── OTPVerification.tsx
│   │   ├── PermissionsModal.tsx
│   │   ├── ProgressIndicators.tsx
│   │   ├── PushNotificationsList.tsx
│   │   ├── RegularizationRequestCard.tsx
│   │   ├── RegularizationRequestForm.tsx
│   │   ├── TaskDetailsModal.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── TroubleshootingGuide.tsx
│   │   ├── UserGuidanceSystem.tsx
│   │   ├── VerificationOrchestrator.tsx
│   │   ├── VerificationProgressOverlay.tsx
│   │   ├── VerificationTutorial.tsx
│   │   └── controls
│   │       ├── AdaptiveTrackingSettings.tsx
│   │       ├── BackgroundTrackingToggle.tsx
│   │       ├── LocationAccuracySettings.tsx
│   │       └── TrackingStatusNotification.tsx
│   ├── context
│   │   ├── AuthContext.tsx
│   │   ├── NotificationContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── TrackingContext.tsx
│   ├── hooks
│   │   ├── useCameraLiveness.ts
│   │   ├── useColorScheme.ts
│   │   ├── useErrorHandling.ts
│   │   ├── useFaceDetection.ts
│   │   ├── useGeofencing.ts
│   │   ├── useLocationTracking.ts
│   │   ├── useOfflineVerification.ts
│   │   ├── useShiftManagement.ts
│   │   ├── useSocket.ts
│   │   └── useVerificationFlow.ts
│   ├── index.tsx
│   ├── screens
│   │   ├── FaceConfiguration.tsx
│   │   └── FaceRegistration.tsx
│   ├── services
│   │   ├── AntiSpoofingService.ts
│   │   ├── BiometricStorageService.ts
│   │   ├── ConnectivityService.ts
│   │   ├── ErrorHandlingService.ts
│   │   ├── FaceDetectionService.ts
│   │   ├── FaceVerificationService.ts
│   │   ├── OfflineVerificationService.ts
│   │   └── VerificationFlowService.ts
│   ├── store
│   │   ├── adminLocationStore.ts
│   │   ├── geofenceStore.ts
│   │   ├── locationStore.ts
│   │   ├── socketStore.ts
│   │   ├── trackingPermissionsStore.ts
│   │   └── useMapStore.ts
│   ├── types
│   │   ├── common.ts
│   │   ├── faceDetection.ts
│   │   ├── faceVerificationErrors.ts
│   │   ├── index.ts
│   │   ├── liveTracking.ts
│   │   ├── location.ts
│   │   ├── nav.ts
│   │   ├── otp.ts
│   │   ├── react-native-modal.d.ts
│   │   ├── userTypes.ts
│   │   └── verification.ts
│   ├── utils
│   │   ├── EventEmitter.ts
│   │   ├── backgroundLocationTask.ts
│   │   ├── batteryOptimizationHelper.ts
│   │   ├── biometricAuth.ts
│   │   ├── deepLinkUtils.ts
│   │   ├── httpBatchManager.ts
│   │   ├── locationAccuracyFilter.ts
│   │   ├── locationQueueManager.ts
│   │   ├── locationUtils.ts
│   │   ├── permissionsManager.ts
│   │   ├── pushNotificationService.ts
│   │   ├── routeUtils.ts
│   │   ├── storage.ts
│   │   ├── themeColors.ts
│   │   └── tokenDebugger.ts
│   └── welcome.tsx
├── app.config.ts
├── assets
│   ├── fonts
│   │   └── SpaceMono-Regular.ttf
│   └── images
│       ├── ParrotAnalyzerSplash.png
│       ├── SplashScreen.png
│       ├── SplashScreenNotWorking.png
│       ├── adaptive-icon.png
│       ├── favicon.png
│       ├── human.jpg
│       ├── icon.png
│       ├── ios-dark.png
│       ├── ios-light.png
│       ├── ios-tinted.png
│       ├── splash-icon-dark.png
│       └── splash-icon-light.png
├── babel.config.js
├── backend
│   ├── Dockerfile
│   ├── fix-mfa-otp.sql
│   ├── logs
│   │   └── deployment-logs.txt
│   ├── package-lock.json
│   ├── package.json
│   ├── run-mfa-fix.sql
│   ├── server.ts
│   ├── src
│   │   ├── config
│   │   │   ├── admin-service-key.json
│   │   │   ├── ca.pem
│   │   │   ├── database.ts
│   │   │   └── environment.ts
│   │   ├── controllers
│   │   │   ├── locationTrackingController.ts
│   │   │   └── shiftTimerController.ts
│   │   ├── database
│   │   │   └── migrations
│   │   │       ├── 007_create_otp_tables.sql
│   │   │       ├── 008_create_face_verification_tables.sql
│   │   │       ├── 009_add_email_support_to_otp.sql
│   │   │       ├── 010_create_attendance_regularization_tables.sql
│   │   │       ├── 011_enhance_employee_tasks.sql
│   │   │       ├── 012_create_customer_notifications.sql
│   │   │       └── 013_create_task_comments_and_activity.sql
│   │   ├── jobs
│   │   │   ├── cleanupExpiredOtps.ts
│   │   │   └── scheduledTasks.ts
│   │   ├── middleware
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── migrations
│   │   │   ├── 20240408_tracking_settings.sql
│   │   │   ├── 20240610_company_holidays.sql
│   │   │   ├── 20240610_leave_management_revamp.sql
│   │   │   ├── 20241201_face_verification_system.sql
│   │   │   ├── Table-Description
│   │   │   │   ├── chat_messages.md
│   │   │   │   ├── companies.md
│   │   │   │   ├── company_geofences.md
│   │   │   │   ├── company_holidays.md
│   │   │   │   ├── company_tracking_settings.md
│   │   │   │   ├── device_tokens.md
│   │   │   │   ├── employee_locations.md
│   │   │   │   ├── employee_schedule.md
│   │   │   │   ├── employee_shifts.md
│   │   │   │   ├── employee_tasks.md
│   │   │   │   ├── error_logs.md
│   │   │   │   ├── expense_documents.md
│   │   │   │   ├── expenses.md
│   │   │   │   ├── geofence_events.md
│   │   │   │   ├── group_admin_shifts.md
│   │   │   │   ├── leave-escalations.md
│   │   │   │   ├── leave_balances.md
│   │   │   │   ├── leave_documents.md
│   │   │   │   ├── leave_policies.md
│   │   │   │   ├── leave_requests.md
│   │   │   │   ├── leave_types.md
│   │   │   │   ├── management_shifts.md
│   │   │   │   ├── notification_templates.md
│   │   │   │   ├── notifications.md
│   │   │   │   ├── push_notifications.md
│   │   │   │   ├── push_receipts.md
│   │   │   │   ├── scheduled_notifications.md
│   │   │   │   ├── shift_timer_settings.md
│   │   │   │   ├── spatial_ref_sys.md
│   │   │   │   ├── support_messages.md
│   │   │   │   ├── tracking_analytics.md
│   │   │   │   ├── user_tracking_permissions.md
│   │   │   │   └── users.md
│   │   │   ├── alter_shift_timer_settings.sql
│   │   │   ├── errorLogIndexes.sql
│   │   │   ├── errorLogs.sql
│   │   │   ├── fix-geofence-table.sql
│   │   │   ├── fix-geography-geofence-table.sql
│   │   │   ├── fix_mfa_otp_column_size.sql
│   │   │   ├── fix_shift_timer_foreign_key.sql
│   │   │   ├── fix_timer_timezone.sql
│   │   │   ├── geofenceEvents.sql
│   │   │   ├── liveTracking.sql
│   │   │   ├── mfa_implementation.sql
│   │   │   ├── shiftTracker.sql
│   │   │   ├── shift_timer_settings.sql
│   │   │   └── tracking_analytics.sql
│   │   ├── models
│   │   │   └── notificationTemplate.ts
│   │   ├── routes
│   │   │   ├── attendanceRegularization.ts
│   │   │   ├── auth.ts
│   │   │   ├── chat.ts
│   │   │   ├── companies.ts
│   │   │   ├── employee.ts
│   │   │   ├── employeeLiveTracking.ts
│   │   │   ├── employeeNotifications.ts
│   │   │   ├── employeeRoutes.ts
│   │   │   ├── expenses.ts
│   │   │   ├── faceVerification.ts
│   │   │   ├── group-admin-leave.ts
│   │   │   ├── group-admin.ts
│   │   │   ├── group-admins.ts
│   │   │   ├── groupAdminLiveTracking.ts
│   │   │   ├── groupAdminNotifications.ts
│   │   │   ├── index.ts
│   │   │   ├── leave-approvals.ts
│   │   │   ├── leave-management.ts
│   │   │   ├── leave.ts
│   │   │   ├── locationTrackingRoutes.ts
│   │   │   ├── management.ts
│   │   │   ├── managementNotifications.ts
│   │   │   ├── notifications.ts
│   │   │   ├── otpVerification.ts
│   │   │   ├── pdf-reports.ts
│   │   │   ├── places.ts
│   │   │   ├── reports.ts
│   │   │   ├── schedule.ts
│   │   │   ├── super.ts
│   │   │   ├── taskDetails.ts
│   │   │   ├── tasks.ts
│   │   │   └── users.ts
│   │   ├── scripts
│   │   │   ├── setupFaceVerification.ts
│   │   │   ├── setupOTPSystem.ts
│   │   │   ├── testFaceVerification.ts
│   │   │   └── validateConfig.ts
│   │   ├── services
│   │   │   ├── AttendanceRegularizationService.ts
│   │   │   ├── BatteryOptimizationService.ts
│   │   │   ├── CustomerNotificationService.ts
│   │   │   ├── ErrorHandlingService.ts
│   │   │   ├── ErrorLoggingService.ts
│   │   │   ├── FaceVerificationService.ts
│   │   │   ├── GeofenceHysteresisService.ts
│   │   │   ├── GeofenceManagementService.ts
│   │   │   ├── GroupAdminTrackingService.ts
│   │   │   ├── KalmanFilterService.ts
│   │   │   ├── LocationValidationService.ts
│   │   │   ├── MFAService.ts
│   │   │   ├── OTPService.ts
│   │   │   ├── RedisManager.ts
│   │   │   ├── RetryService.ts
│   │   │   ├── SMSService.ts
│   │   │   ├── ShiftTrackingService.ts
│   │   │   ├── TaskNotificationService.ts
│   │   │   ├── TrackingAnalyticsService.ts
│   │   │   ├── leaveNotificationService.ts
│   │   │   ├── locationTrackingService.ts
│   │   │   ├── notificationAnalyticsService.ts
│   │   │   ├── notificationRateLimitService.ts
│   │   │   ├── notificationService.ts
│   │   │   ├── scheduledNotificationService.ts
│   │   │   └── socketService.ts
│   │   ├── types
│   │   │   ├── express.d.ts
│   │   │   ├── index.ts
│   │   │   ├── leave.ts
│   │   │   ├── liveTracking.ts
│   │   │   └── user.ts
│   │   └── utils
│   │       ├── auth.ts
│   │       ├── errorLogger.ts
│   │       └── geoUtils.ts
│   ├── test-expo-push.js
│   └── tsconfig.json
├── bun.lock
├── constants
│   ├── GoogleService-Info.plist
│   ├── admin-service-key.json
│   └── google-services.json
├── database
│   ├── Database_Schema_Old.png
│   ├── Full_schema_with_metadata.sql
│   ├── README.md
│   ├── Schema_Diagram.svg
│   ├── database.bak
│   ├── main_schema.sql
│   └── neon_backup.dump
├── docs
│   ├── Crash-Fix-1.md
│   └── Crash-Fix-2.md
├── documentation
│   ├── API-DOCUMENTATION.md
│   ├── Admin Workflow Documentation.docx
│   ├── Deployment.md
│   ├── Live Tracking Implementation Plan.docx
│   └── Parrot Analyzer Documentation.docx
├── eas.json
├── global.css
├── metro.config.js
├── nativewind-env.d.ts
├── package.json
├── scripts
│   └── find-used-deps.js
├── tailwind.config.js
├── tree.md
└── tsconfig.json

79 directories, 445 files
