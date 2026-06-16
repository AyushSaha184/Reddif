import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConnectionBanner } from '../components/ConnectionBanner';
import { FilterBar } from '../components/FilterBar';
import { PostListItem } from '../components/PostListItem';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../store/useAppStore';

const FLAIRS = ['All', 'Paid - No AI', 'Paid - AI OK', 'Free'] as const;
type FlairFilter = typeof FLAIRS[number];

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

export function FeedScreen() {
  const {
    posts,
    settings,
    addBookmark,
    removeBookmark,
    isBookmarked,
    clearExpiredPosts,
    clearUnread,
  } = useAppStore();
  const isConnected = useNetworkStatus();
  const [selectedFlair, setSelectedFlair] = useState<FlairFilter>('All');

  useEffect(() => {
    clearExpiredPosts();
    clearUnread();
  }, [clearExpiredPosts, clearUnread]);

  const filteredPosts = useMemo(() => {
    if (selectedFlair === 'All') {
      return posts;
    }
    return posts.filter(post => post.flair === selectedFlair);
  }, [posts, selectedFlair]);

  const renderPost = useCallback(({ item }: { item: typeof posts[number] }) => {
    const bookmarked = isBookmarked(item.id);

    return (
      <PostListItem
        post={item}
        accentColor={settings.accentColor}
        isBookmarked={bookmarked}
        onToggleBookmark={() => {
          if (bookmarked) {
            removeBookmark(item.id);
            return;
          }
          addBookmark(item);
        }}
      />
    );
  }, [addBookmark, isBookmarked, removeBookmark, settings.accentColor]);

  const backgroundColor = getThemeBackground(settings.theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      {!isConnected ? <ConnectionBanner /> : null}

      <FilterBar
        flairs={FLAIRS}
        selectedFlair={selectedFlair}
        onSelectFlair={setSelectedFlair}
      />

      {filteredPosts.length > 0 ? (
        <FlatList
          data={filteredPosts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={32}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={6}
          renderItem={renderPost}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>New posts will appear here</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 110,
  },
  separator: {
    height: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
});
