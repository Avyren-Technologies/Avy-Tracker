# Avy Tracker - Project Overview

## Application Architecture

Avy Tracker is a comprehensive workforce management platform built with a modern hybrid architecture:

### Frontend Stack
- **React Native Expo** - Cross-platform mobile application
- **TypeScript** - Type-safe development
- **NativeWind** - Tailwind CSS for React Native styling
- **Expo Router** - File-based routing system
- **Zustand** - State management
- **React Native Maps** - Location and mapping functionality

### Backend Stack
- **Node.js with TypeScript** - Server runtime
- **Express.js** - Web framework
- **PostgreSQL** - Primary database with PostGIS for geospatial data
- **Socket.IO** - Real-time communication
- **JWT** - Authentication and authorization
- **Redis/IORedis** - Caching and session management
- **Multer** - File upload handling

### Key Technologies
- **Expo Location** - GPS tracking and geofencing
- **Push Notifications** - Expo notifications service
- **Google Gemini AI** - Chatbot integration
- **PDF Generation** - Report generation
- **Background Tasks** - Location tracking when app is closed

## Application Purpose

Avy Tracker is an enterprise-grade workforce management platform designed for companies to:

1. **Track Employee Location** - Real-time GPS tracking with geofencing
2. **Manage Attendance** - Automated shift tracking and attendance logging
3. **Handle Expenses** - Expense submission, approval workflows, and reporting
4. **Leave Management** - Leave requests, approvals, and balance tracking
5. **Team Analytics** - Performance metrics, travel analytics, and reporting
6. **Multi-tenant Support** - Company-based isolation and management

## User Roles & Hierarchy

### 1. Super Admin
- **Highest level access** - System-wide management
- **Company Management** - Create, manage, and disable companies
- **User Limits** - Set and monitor user limits per company
- **System Configuration** - Global settings and security
- **Cross-company Analytics** - Platform-wide reporting

### 2. Management
- **Company-level oversight** - Full company management
- **Group Admin Management** - Create and manage group admins
- **Advanced Analytics** - Company-wide performance metrics
- **Leave Approvals** - Final approval authority for escalated leaves
- **Expense Oversight** - Review and approve high-value expenses

### 3. Group Admin
- **Team Management** - Manage assigned employees
- **Employee Creation** - Add employees individually or in bulk
- **Expense Approvals** - First-level expense approval
- **Leave Management** - Process leave requests
- **Team Analytics** - Team performance and attendance reports
- **Geofence Management** - Create and manage location boundaries

### 4. Employee
- **Personal Dashboard** - Individual metrics and tasks
- **Shift Management** - Start/stop shifts with location tracking
- **Expense Submission** - Submit expenses with receipts
- **Leave Requests** - Apply for leave with documentation
- **Task Management** - View and update assigned tasks
- **Profile Management** - Update personal information

## Core Features

### Location Tracking
- **Real-time GPS tracking** during active shifts
- **Geofencing** with entry/exit notifications
- **Background location** tracking when app is closed
- **Travel analytics** with distance and time calculations
- **Battery optimization** for extended tracking

### Attendance Management
- **Shift-based tracking** with start/end times
- **Location-verified attendance** using GPS coordinates
- **Automatic shift detection** based on geofence entry
- **Attendance analytics** with patterns and insights

### Expense Management
- **Multi-category expenses** (travel, lodging, meals, etc.)
- **Receipt uploads** with image and PDF support
- **Approval workflows** with multi-level authorization
- **Expense analytics** and reporting
- **Integration with shift data** for automatic calculations

### Leave Management
- **Multiple leave types** (EL, SL, ML, CL, etc.)
- **Leave balance tracking** with carry-forward rules
- **Approval workflows** with escalation paths
- **Leave calendar** for team visibility
- **Policy enforcement** with validation rules

### Notification System
- **Push notifications** for real-time updates
- **In-app notifications** with read/unread status
- **Role-based notifications** with different priorities
- **Notification templates** for consistent messaging

### Analytics & Reporting
- **Real-time dashboards** with key metrics
- **PDF report generation** for formal documentation
- **Travel analytics** with route optimization insights
- **Performance metrics** for individuals and teams
- **Attendance patterns** and trend analysis

## Technical Architecture

### Database Schema
- **Users table** - Core user information with role-based access
- **Companies table** - Multi-tenant company management
- **Employee shifts** - Shift tracking with location data
- **Expenses** - Expense records with approval status
- **Leave requests** - Leave management with balances
- **Notifications** - Push and in-app notification system
- **Geofences** - Location boundaries for companies
- **Analytics tables** - Aggregated data for reporting

### Authentication & Security
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (RBAC)
- **Company-based data isolation** for multi-tenancy
- **Secure token storage** using Expo SecureStore
- **Password encryption** using bcrypt
- **API rate limiting** and request validation

### Real-time Features
- **Socket.IO integration** for live updates
- **Location streaming** for real-time tracking
- **Notification delivery** with delivery confirmation
- **Live chat support** with AI integration

### Offline Capabilities
- **Offline authentication** with cached credentials
- **Data synchronization** when connection restored
- **Offline location tracking** with batch uploads
- **Cached data access** for essential features

This architecture supports scalable, secure, and feature-rich workforce management for organizations of all sizes.