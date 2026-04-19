import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Linking,
} from 'react-native';

import { ConnectionBanner } from '../components/ConnectionBanner';
import { FilterBar } from '../components/FilterBar';
import { PostListItem } from '../components/PostListItem';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../store/useAppStore';
import { Post } from '../types';

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
    const sortedByLatest = [...posts].sort((a, b) => b.createdAt - a.createdAt);
    if (selectedFlair === 'All') {
      return sortedByLatest;
    }
    return sortedByLatest.filter(post => post.flair === selectedFlair);
  }, [posts, selectedFlair]);

  const openPost = async (post: Post) => {
    const redditUrl = `reddit://comments/${post.id}`;
    try {
      await Linking.openURL(redditUrl);
    } catch (error) {
      await Linking.openURL(post.permalink);
    }
  };

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
          scrollEventThrottle={16}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          removeClippedSubviews={false}
          maxToRenderPerBatch={8}
          windowSize={7}
          renderItem={({ item }) => {
            const bookmarked = isBookmarked(item.id);

            return (
              <PostListItem
                post={item}
                accentColor={settings.accentColor}
                onPress={() => openPost(item)}
                onSecondaryPress={() => {
                  if (bookmarked) {
                    removeBookmark(item.id);
                    return;
                  }
                  addBookmark(item);
                }}
                secondaryIcon={bookmarked ? 'bookmark' : 'bookmark-outline'}
                secondaryTint={bookmarked ? settings.accentColor : '#717A85'}
              />
            );
          }}
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
