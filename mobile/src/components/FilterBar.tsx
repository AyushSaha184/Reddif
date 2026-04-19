import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAppStore } from '../store/useAppStore';

interface FilterBarProps {
  flairs: readonly string[];
  selectedFlair: string;
  onSelectFlair: (flair: string) => void;
}

export function FilterBar({ flairs, selectedFlair, onSelectFlair }: FilterBarProps) {
  const { settings } = useAppStore();
  const shellColor = settings.theme === 'amoled' ? '#17191D' : '#232428';

  return (
    <View style={styles.container}>
      <View style={[styles.shell, { backgroundColor: shellColor }]}> 
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
                selectedFlair === flair && { backgroundColor: settings.accentColor + '18' },
              ]}
              onPress={() => onSelectFlair(flair)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedFlair === flair && { color: settings.accentColor },
                ]}
              >
                {flair}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 22,
  },
  shell: {
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  chipText: {
    color: '#98A1AB',
    fontSize: 13,
    fontWeight: '700',
  },
});
