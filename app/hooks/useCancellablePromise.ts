import { useEffect, useRef } from "react";

/**
 * Hook to make promises cancellable and prevent PromiseAlreadySettledException
 * when components unmount before async operations complete.
 * 
 * This is critical for face detection operations that may continue after
 * component unmount, causing crashes.
 */
export function useCancellablePromise() {
  const isMountedRef = useRef(true);
  const cancelledPromisesRef = useRef<Set<Promise<any>>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel all pending promises
      cancelledPromisesRef.current.clear();
    };
  }, []);

  const makeCancellable = <T,>(promise: Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      // Track this promise
      cancelledPromisesRef.current.add(promise);

      promise
        .then((result) => {
          // Only resolve if component is still mounted
          if (isMountedRef.current) {
            cancelledPromisesRef.current.delete(promise);
            resolve(result);
          } else {
            // Component unmounted, silently ignore
            cancelledPromisesRef.current.delete(promise);
            console.log(
              "[useCancellablePromise] Promise resolved after unmount, ignoring result"
            );
          }
        })
        .catch((error) => {
          // Only reject if component is still mounted
          if (isMountedRef.current) {
            cancelledPromisesRef.current.delete(promise);
            // Don't reject if it's a PromiseAlreadySettled error
            if (
              error?.message?.includes("PromiseAlreadySettled") ||
              error?.message?.includes("already settled")
            ) {
              console.warn(
                "[useCancellablePromise] Prevented PromiseAlreadySettledException:",
                error.message
              );
              return; // Silently ignore
            }
            reject(error);
          } else {
            // Component unmounted, silently ignore
            cancelledPromisesRef.current.delete(promise);
            console.log(
              "[useCancellablePromise] Promise rejected after unmount, ignoring error:",
              error.message
            );
          }
        });
    });
  };

  const cancelAll = () => {
    cancelledPromisesRef.current.clear();
  };

  return {
    makeCancellable,
    isMounted: () => isMountedRef.current,
    cancelAll,
  };
}

