import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface FlairChipProps {
  flair: string;
}

export function FlairChip({flair}: FlairChipProps) {
  const getBackgroundColor = () => {
    switch (flair) {
      case 'Paid - No AI':
        return '#FF6B35';
      case 'Paid - AI OK':
        return '#FF9800';
      case 'Free':
        return '#4CAF50';
      case 'Solved':
        return '#2196F3';
      default:
        return '#888888';
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: getBackgroundColor()}]}>
      <Text style={styles.text}>{flair}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
