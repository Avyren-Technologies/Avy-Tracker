# Gemini Project Context: Avy Tracker

This document provides a comprehensive overview of the Avy Tracker project, designed to be used as a context file for AI-assisted development.

## 1. Project Overview

Avy Tracker is a sophisticated, multi-tenant mobile platform for advanced workforce management. Built with React Native (Expo) for the frontend and a Node.js/Express backend, it provides a comprehensive suite of features including real-time employee GPS tracking, automated attendance, leave and expense management, and an integrated AI chatbot (Google Gemini) for user support.

The application is architected around a role-based access control (RBAC) system, with four distinct roles: Employee, Group Admin, Management, and Super Admin. Each role has a tailored interface and set of permissions to manage their specific responsibilities.

### Key Technologies

- **Frontend:** React Native (Expo), TypeScript, NativeWind (Tailwind CSS), Zustand
- **Backend:** Node.js, Express.js, TypeScript, PostgreSQL, Socket.io
- **Core Features:** GPS Tracking, Geofencing, Biometric Authentication, Push Notifications
- **External Services:** Google Maps, Firebase Cloud Messaging, Google Gemini, Azure

## 2. Project Structure

The project is a monorepo containing the frontend mobile application and the backend server.

- **`/app`**: Contains the React Native (Expo) mobile application source code.
    - `(auth)`: Authentication-related screens (signin, forgot password).
    - `(dashboard)`: Main application screens, organized by user role.
    - `components`: Reusable UI components.
    - `context`: React context providers for managing global state (e.g., Auth, Theme).
    - `hooks`: Custom React hooks for business logic (e.g., location tracking, face detection).
    - `services`: Modules for interacting with external services (e.g., anti-spoofing, face verification).
    - `store`: Zustand stores for client-side state management.
- **`/backend`**: Contains the Node.js/Express.js backend server source code.
    - `src`: Backend TypeScript source.
    - `routes`: API endpoint definitions.
    - `middleware`: Express middleware (e.g., authentication).
- **`/database`**: Contains database schemas and migration scripts.
- **`/documentation`**: API documentation and other project-related documents.

**Architectural Note:** The root `package.json` manages dependencies for the frontend application, but also contains some backend dependencies. The `backend/package.json` is the definitive source for backend service dependencies and scripts.

## 3. Build, Run, and Test Commands

### 3.1. Frontend (Mobile App)

- **Run development server:**
  ```bash
  npx expo start
  ```
  Then, press `a` for Android, `i` for iOS, or `w` for web.

- **Run on Android:**
  ```bash
  npm run android
  ```

- **Run on iOS:**
  ```bash
  npm run ios
  ```

- **Run tests:**
  ```bash
  npm run test
  ```

- **Run static type checking:**
  ```bash
  npm run type-check
  ```

### 3.2. Backend (Server)

- **Run development server (with hot-reloading):**
  ```bash
  cd backend
  npm run dev
  ```

- **Build for production:**
  ```bash
  cd backend
  npm run build
  ```

- **Run production build:**
  ```bash
  cd backend
  npm run start
  ```

- **Run tests:**
  ```bash
  cd backend
  npm run test
  ```

## 4. Development Conventions

- **Technology:** The project uses TypeScript for both frontend and backend, enforcing type safety.
- **Styling:** The mobile app uses [NativeWind](https://www.nativewind.dev/), which brings Tailwind CSS to React Native. Utility-first classes are the standard.
- **State Management:** Client-side state is managed with [Zustand](https://github.com/pmndrs/zustand). Global state (like authentication) is also handled via React Context.
- **Real-time Communication:** WebSockets (via `socket.io`) are used for real-time features like live location tracking.
- **Background Tasks:** The app uses Expo's `TaskManager` and background location capabilities to track location even when the app is not in the foreground. This is a critical and sensitive part of the application, defined in `app.config.ts`.
- **Environment Variables:**
    - **Frontend:** Variables are managed in a root `.env` file and exposed to the app via `app.config.ts`. Access them via `Constants.expoConfig.extra`.
    - **Backend:** Variables are managed in `backend/.env`. A `backend/.env.example` file serves as a template.
- **Linting:** The backend has a linting setup (`npm run lint`) using ESLint.
- **Testing:** Both frontend and backend use Jest for unit and integration testing.
- **API:** A RESTful API is exposed by the backend. See `documentation/API-DOCUMENTATION.md` for details.
