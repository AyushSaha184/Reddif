import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FLAIR_COLORS} from '../constants/colors';

interface FlairChipProps {
  flair: string;
}

export function FlairChip({flair}: FlairChipProps) {
  const backgroundColor = FLAIR_COLORS[flair] || '#888888';

  return (
    <View style={[styles.container, {backgroundColor}]}>
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
