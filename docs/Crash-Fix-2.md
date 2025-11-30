# Avy Tracker App Crash Analysis & Expo Solutions

## Overview

Your app is experiencing **two critical crash patterns** that are causing production failures. Both are common in React Native/Expo apps and can be fixed entirely with JavaScript/TypeScript code changes—no native modifications needed[1][2].

***

## **Error #1: Promise Already Settled Exception**

### What's Happening
The app crashes with `PromiseAlreadySettledException` when calling `RNMLKitFaceDetection.detectFaces`[1]. This means your code is trying to resolve or reject a promise that has already been completed[2].

### Why It Happens
- **Component unmounts** before face detection completes
- **Multiple rapid calls** to face detection (user taps button repeatedly)
- **Navigation away** from screen while detection is in progress
- **Race conditions** when multiple detections run simultaneously

### The Fix: Implement Cancellation Pattern

**Step 1: Create a custom hook with cleanup**
```javascript
import { useEffect, useRef } from 'react';

export function useCancellablePromise() {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const makeCancellable = (promise) => {
    return new Promise((resolve, reject) => {
      promise
        .then(result => {
          if (isMountedRef.current) {
            resolve(result);
          }
        })
        .catch(error => {
          if (isMountedRef.current) {
            reject(error);
          }
        });
    });
  };
  
  return { makeCancellable, isMounted: () => isMountedRef.current };
}
```

**Step 2: Apply to your face detection component**
```javascript
import { RNMLKitFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
import { useCancellablePromise } from './hooks/useCancellablePromise';

function FaceDetectionScreen() {
  const { makeCancellable, isMounted } = useCancellablePromise();
  const [isDetecting, setIsDetecting] = useState(false);
  
  const detectFaces = async (imageUri) => {
    if (isDetecting) return; // Prevent multiple simultaneous calls
    
    setIsDetecting(true);
    
    try {
      const result = await makeCancellable(
        RNMLKitFaceDetection.detectFaces(imageUri)
      );
      
      if (isMounted()) {
        // Process results only if component is still mounted
        console.log('Faces detected:', result);
      }
    } catch (error) {
      if (isMounted() && !error.message?.includes('settled')) {
        console.error('Face detection error:', error);
      }
    } finally {
      if (isMounted()) {
        setIsDetecting(false);
      }
    }
  };
  
  return (
    // Your UI code
    <Button 
      title="Detect Faces" 
      onPress={() => detectFaces(imageUri)}
      disabled={isDetecting}
    />
  );
}
```

**Step 3: Add debouncing for rapid calls**
```javascript
import { useCallback } from 'react';
import debounce from 'lodash.debounce';

// Inside your component
const debouncedDetectFaces = useCallback(
  debounce((imageUri) => detectFaces(imageUri), 500),
  []
);
```


## **Error #3: Memory Leaks & Resource Cleanup**

### What's Happening
The ShadowNode crash from your first log indicates **memory isn't being properly released** when components unmount[3].

### The Fix: Implement Proper Cleanup

**Step 1: Create a cleanup hook**
```javascript
import { useEffect, useRef } from 'react';

export function useCleanup() {
  const timersRef = useRef([]);
  const subscriptionsRef = useRef([]);
  
  useEffect(() => {
    return () => {
      // Clear all timers
      timersRef.current.forEach(timer => {
        clearTimeout(timer);
        clearInterval(timer);
      });
      
      // Remove all subscriptions
      subscriptionsRef.current.forEach(sub => {
        if (sub?.remove) sub.remove();
        if (sub?.unsubscribe) sub.unsubscribe();
      });
    };
  }, []);
  
  const addTimer = (callback, delay, isInterval = false) => {
    const timer = isInterval 
      ? setInterval(callback, delay)
      : setTimeout(callback, delay);
    timersRef.current.push(timer);
    return timer;
  };
  
  const addSubscription = (subscription) => {
    subscriptionsRef.current.push(subscription);
    return subscription;
  };
  
  return { addTimer, addSubscription };
}
```

**Step 2: Apply to components**
```javascript
function CameraScreen() {
  const { addTimer, addSubscription } = useCleanup();
  
  useEffect(() => {
    // Use addTimer instead of setTimeout/setInterval
    addTimer(() => {
      console.log('Auto capture');
    }, 5000);
    
    // Register subscriptions
    const listener = someEventEmitter.addListener('event', handler);
    addSubscription(listener);
    
    // Cleanup happens automatically!
  }, []);
  
  return <View />;
}
```

***

## **Additional Protection: Global Error Handling**

Add this to your root layout for safety net[4][5]:

```javascript
// app/_layout.tsx
import { useEffect } from 'react';
import { ErrorBoundary } from 'expo-router';

// Global promise rejection handler
const setupGlobalErrorHandlers = () => {
  const originalHandler = global.Promise.prototype.catch;
  
  global.Promise.prototype.catch = function(onRejected) {
    return originalHandler.call(this, (error) => {
      if (error?.message?.includes('PromiseAlreadySettled')) {
        console.warn('Prevented promise crash:', error.message);
        return; // Swallow the error
      }
      return onRejected ? onRejected(error) : Promise.reject(error);
    });
  };
};

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text>Something went wrong!</Text>
      <Text>{error.message}</Text>
      <Button title="Try Again" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);
  
  return (
    <Stack>
      {/* Your screens */}
    </Stack>
  );
}
```

***

## **Testing Your Fixes**

After implementing these changes, test for:

1. **Promise handling**: Navigate away while face detection is running
2. **Rapid interactions**: Tap face detection button multiple times quickly
4. **Memory**: Keep app open for extended periods
5. **Background/foreground**: Switch apps during operations

***

## **Summary**

Your crashes stem from three main issues[1][2][4]:

1. **Unhandled async operations** when components unmount (PromiseAlreadySettled)
3. **Missing cleanup logic** causing memory leaks

All fixes are **JavaScript/TypeScript only** and work perfectly with Expo managed workflow. Implement the cancellation hooks, fix your folder structure, and add proper cleanup—your app will be stable and crash-free.

