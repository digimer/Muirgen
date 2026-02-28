import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

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

/* 
 * This handles the virtual HDD LED to show when something is saved (or whatever makes sense).
 */
const SystemStatusContext = createContext({
  isHddActive: false,
  triggerHddLed: () => {}
});

export const SystemStatusProvider = ({ children }) => {
  const [isHddActive, setIsHddActive] = useState(false);

  const triggerHddLed = useCallback((durationMs = 500) =>{
    setIsHddActive(true);
    setTimeout(() => {
      setIsHddActive(false);
    }, durationMs);
  }, []);

  // Using native React.createElement so Vite doesn't complain about JSX markup in a .js file
  return React.createElement(
    SystemStatusContext.Provider,
    { value: { isHddActive, triggerHddLed } },
    children
  );
};

export const useSystemStatus = () => useContext(SystemStatusContext);
