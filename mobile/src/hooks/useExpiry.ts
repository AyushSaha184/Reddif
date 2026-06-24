import {useEffect, useRef, useState} from 'react';

interface TimeRemaining {
  hours: number;
  minutes: number;
  expired: boolean;
}

const EXPIRY_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const subscribers = new Set<() => void>();
let minuteInterval: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

function subscribeMinuteTick(callback: () => void): () => void {
  subscriberCount++;
  subscribers.add(callback);
  if (!minuteInterval) {
    minuteInterval = setInterval(() => {
      subscribers.forEach(subscriber => subscriber());
    }, 60000);
  }

  return () => {
    subscribers.delete(callback);
    subscriberCount--;
    if (subscribers.size === 0 && minuteInterval) {
      clearInterval(minuteInterval);
      minuteInterval = null;
    }
  };
}

export function useExpiry(createdAt: number): TimeRemaining {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(createdAt)
  );
  const callbackRef = useRef(() => {
    setTimeRemaining(calculateTimeRemaining(createdAt));
  });

  useEffect(() => {
    return subscribeMinuteTick(callbackRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return timeRemaining;
}

function calculateTimeRemaining(createdAt: number): TimeRemaining {
  const now = Date.now();
  const expiryTime = createdAt + EXPIRY_DURATION;
  const remaining = expiryTime - now;

  if (remaining <= 0) {
    return {hours: 0, minutes: 0, expired: true};
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.max(1, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));

  return {hours, minutes, expired: false};
}
