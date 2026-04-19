import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostListItem } from '../components/PostListItem';
import { useAppStore } from '../store/useAppStore';

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

export function BookmarksScreen() {
  const { bookmarks, removeBookmark, settings } = useAppStore();
  const backgroundColor = getThemeBackground(settings.theme);
  const sortedBookmarks = [...bookmarks].sort((a, b) => b.createdAt - a.createdAt);

  if (bookmarks.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={styles.emptyText}>No bookmarks yet</Text>
        <Text style={styles.emptySubtext}>
          Bookmark posts to save them for later
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <FlatList
        data={sortedBookmarks}
        renderItem={({ item }) => (
          <PostListItem
            post={item}
            accentColor={settings.accentColor}
            isBookmarked
            onToggleBookmark={() => removeBookmark(item.id)}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        removeClippedSubviews={false}
        maxToRenderPerBatch={8}
        windowSize={7}
        decelerationRate="fast"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 110,
  },
  separator: {
    height: 14,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
