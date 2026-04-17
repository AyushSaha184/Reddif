import {useEffect, useState} from 'react';

interface TimeRemaining {
  hours: number;
  minutes: number;
  expired: boolean;
}

const EXPIRY_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

export function useExpiry(createdAt: number): TimeRemaining {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(createdAt)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(createdAt));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
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
