import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation } from 'react-native';
import { useAppStore } from '../store/useAppStore';

interface FilterBarProps {
  flairs: readonly string[];
  selectedFlair: string;
  onSelectFlair: (flair: string) => void;
}

export function FilterBar({ flairs, selectedFlair, onSelectFlair }: FilterBarProps) {
  const { settings } = useAppStore();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {flairs.map((flair) => (
          <TouchableOpacity
            key={flair}
            style={[
              styles.chip,
              selectedFlair === flair && { backgroundColor: settings.accentColor },
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onSelectFlair(flair);
            }}
          >
            <Text
              style={[
                styles.chipText,
                selectedFlair === flair && styles.selectedChipText,
              ]}
            >
              {flair}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 4,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  chipText: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#FFFFFF',
  },
});
