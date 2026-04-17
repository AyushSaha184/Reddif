import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {useAppStore} from '../store/useAppStore';

interface FilterBarProps {
  flairs: readonly string[];
  selectedFlair: string;
  onSelectFlair: (flair: string) => void;
}

export function FilterBar({flairs, selectedFlair, onSelectFlair}: FilterBarProps) {
  const {settings} = useAppStore();

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
              selectedFlair === flair && {backgroundColor: settings.accentColor},
            ]}
            onPress={() => onSelectFlair(flair)}
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
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
