import { useState, useEffect } from 'react';

/**
 * useLocalStorageState
 * 
 * A hook that syncs a useState variable with localStorage.
 * 
 * @param {string} key - The key to use in localStorage.
 * @param {any} initialValue - The initial value if no data exists.
 * @returns [state, setState]
 */
export const useLocalStorageState = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing localStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
};
