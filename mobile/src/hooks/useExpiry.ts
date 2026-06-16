import {useEffect, useState} from 'react';

interface TimeRemaining {
  hours: number;
  minutes: number;
  expired: boolean;
}

const EXPIRY_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const subscribers = new Set<() => void>();
let minuteInterval: ReturnType<typeof setInterval> | null = null;

function subscribeMinuteTick(callback: () => void): () => void {
  subscribers.add(callback);
  if (!minuteInterval) {
    minuteInterval = setInterval(() => {
      subscribers.forEach(subscriber => subscriber());
    }, 60000);
  }

  return () => {
    subscribers.delete(callback);
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

  useEffect(() => {
    return subscribeMinuteTick(() => {
      setTimeRemaining(calculateTimeRemaining(createdAt));
    });
  }, [createdAt]);

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
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  return {hours, minutes, expired: false};
}
