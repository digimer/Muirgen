// src/useInterval.js
import { useEffect, useRef } from 'react';

export default function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id); // Automatic cleanup
    }
  }, [delay]);
}

