import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Linking, Image} from 'react-native';

const WifiIcon = ({color}: {color: string}) => (
  <Image
    source={{uri: 'https://img.icons8.com/ios/50/wifi-off.png'}}
    style={{width: 20, height: 20, tintColor: color}}
  />
);

export function ConnectionBanner() {
  const openSettings = () => {
    Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <WifiIcon color="#FFFFFF" />
      <Text style={styles.text}>No internet connection</Text>
      <TouchableOpacity onPress={openSettings}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});