import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface BudgetBadgeProps {
  budget: string;
}

export function BudgetBadge({budget}: BudgetBadgeProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{budget}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  text: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
