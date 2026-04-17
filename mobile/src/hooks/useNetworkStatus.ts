import {useEffect, useState} from 'react';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  return isConnected;
}
