import { useEffect, useRef } from "react";

/**
 * Hook to manage cleanup of timers, subscriptions, and other resources
 * to prevent memory leaks when components unmount.
 * 
 * This is critical for face detection components that use intervals,
 * timeouts, and event listeners.
 */
export function useCleanup() {
  const timersRef = useRef<Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>>([]);
  const subscriptionsRef = useRef<Array<{ remove?: () => void; unsubscribe?: () => void }>>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      // Clear all timers
      timersRef.current.forEach((timer) => {
        try {
          clearTimeout(timer as ReturnType<typeof setTimeout>);
          clearInterval(timer as ReturnType<typeof setInterval>);
        } catch (error) {
          console.warn("[useCleanup] Error clearing timer:", error);
        }
      });
      timersRef.current = [];

      // Remove all subscriptions
      subscriptionsRef.current.forEach((sub) => {
        try {
          if (sub?.remove) {
            sub.remove();
          }
          if (sub?.unsubscribe) {
            sub.unsubscribe();
          }
        } catch (error) {
          console.warn("[useCleanup] Error removing subscription:", error);
        }
      });
      subscriptionsRef.current = [];
    };
  }, []);

  const addTimer = (
    callback: () => void,
    delay: number,
    isInterval = false
  ): ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> => {
    const timer = isInterval
      ? setInterval(callback, delay)
      : setTimeout(callback, delay);
    timersRef.current.push(timer);
    return timer;
  };

  const removeTimer = (
    timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>
  ) => {
    try {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
      timersRef.current = timersRef.current.filter((t) => t !== timer);
    } catch (error) {
      console.warn("[useCleanup] Error removing timer:", error);
    }
  };

  const addSubscription = (subscription: {
    remove?: () => void;
    unsubscribe?: () => void;
  }) => {
    subscriptionsRef.current.push(subscription);
    return subscription;
  };

  const removeSubscription = (subscription: {
    remove?: () => void;
    unsubscribe?: () => void;
  }) => {
    try {
      if (subscription?.remove) {
        subscription.remove();
      }
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
      subscriptionsRef.current = subscriptionsRef.current.filter(
        (s) => s !== subscription
      );
    } catch (error) {
      console.warn("[useCleanup] Error removing subscription:", error);
    }
  };

  const clearAll = () => {
    // Clear all timers
    timersRef.current.forEach((timer) => {
      try {
        clearTimeout(timer as ReturnType<typeof setTimeout>);
        clearInterval(timer as ReturnType<typeof setInterval>);
      } catch (error) {
        console.warn("[useCleanup] Error clearing timer in clearAll:", error);
      }
    });
    timersRef.current = [];

    // Remove all subscriptions
    subscriptionsRef.current.forEach((sub) => {
      try {
        if (sub?.remove) {
          sub.remove();
        }
        if (sub?.unsubscribe) {
          sub.unsubscribe();
        }
      } catch (error) {
        console.warn("[useCleanup] Error removing subscription in clearAll:", error);
      }
    });
    subscriptionsRef.current = [];
  };

  return {
    addTimer,
    removeTimer,
    addSubscription,
    removeSubscription,
    clearAll,
    isMounted: () => isMountedRef.current,
  };
}

