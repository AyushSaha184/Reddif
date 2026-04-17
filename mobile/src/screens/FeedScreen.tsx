import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ConnectionBanner } from '../components/ConnectionBanner';
import { PostListItem } from '../components/PostListItem';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../store/useAppStore';
import { Post } from '../types';

const FILTERS = ['All', 'Paid - No AI', 'Paid - AI OK', 'Free'] as const;
type FeedFilter = typeof FILTERS[number];

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

const getAccentForFilter = (filter: FeedFilter) => {
  switch (filter) {
    case 'Paid - No AI':
      return '#A8B8C9';
    case 'Paid - AI OK':
      return '#54B9FF';
    case 'Free':
      return '#BDA7FF';
    default:
      return '#C3CCD7';
  }
};

const getTrailingValue = (post: Post) => {
  if (post.detectedBudget) {
    return 'B';
  }
  return post.status === 'solved' ? 'OK' : 'NEW';
};

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
  const [selectedFilter, setSelectedFilter] = useState<FeedFilter>('All');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    clearExpiredPosts();
    clearUnread();
  }, [clearExpiredPosts, clearUnread]);

  const filteredPosts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return posts.filter(post => {
      const matchesFilter = selectedFilter === 'All' || post.flair === selectedFilter;
      const matchesQuery =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.flair.toLowerCase().includes(query) ||
        post.detectedBudget?.toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [posts, searchText, selectedFilter]);

  const counts = useMemo(
    () => ({
      All: posts.length,
      'Paid - No AI': posts.filter(post => post.flair === 'Paid - No AI').length,
      'Paid - AI OK': posts.filter(post => post.flair === 'Paid - AI OK').length,
      Free: posts.filter(post => post.flair === 'Free').length,
    }),
    [posts],
  );

  const openPost = async (post: Post) => {
    const redditUrl = `reddit://comments/${post.id}`;
    const supported = await Linking.canOpenURL(redditUrl);
    await Linking.openURL(supported ? redditUrl : post.permalink);
  };

  const backgroundColor = getThemeBackground(settings.theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reddif</Text>
          <Text style={styles.headerSubtitle}>Lead alerts, Telegram style</Text>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Icon name="dots-vertical" size={22} color="#F4F7FB" />
        </TouchableOpacity>
      </View>

      {!isConnected ? <ConnectionBanner /> : null}

      <View style={styles.searchShell}>
        <Icon name="magnify" size={20} color="#788390" />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search chats"
          placeholderTextColor="#788390"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={item => item}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const isSelected = item === selectedFilter;
          const tint = getAccentForFilter(item);

          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                isSelected && { backgroundColor: '#23262B', borderColor: tint },
              ]}
              onPress={() => setSelectedFilter(item)}
            >
              <Text style={[styles.filterText, isSelected && { color: tint }]}>
                {item === 'All' ? 'Personal' : item.replace('Paid - ', '')}
              </Text>
              <View
                style={[
                  styles.filterCount,
                  { backgroundColor: isSelected ? tint : '#2B313A' },
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    { color: isSelected ? '#091117' : '#F5F7FB' },
                  ]}
                >
                  {counts[item]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {filteredPosts.length > 0 ? (
        <FlatList
          data={filteredPosts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
                trailingValue={getTrailingValue(item)}
                trailingTone={item.status === 'open' ? 'accent' : 'muted'}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No chats found</Text>
          <Text style={styles.emptySubtitle}>
            {posts.length === 0
              ? 'New Reddit leads will appear here.'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      )}

      <View style={styles.fabStack}>
        <TouchableOpacity style={styles.secondaryFab}>
          <Icon name="bookmark-multiple-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryFab, { backgroundColor: settings.accentColor }]}>
          <Icon name="plus" size={22} color="#0A0A0A" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    color: '#F5F7FB',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#76818D',
    fontSize: 13,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16181C',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#121417',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#F4F7FB',
    fontSize: 15,
  },
  filterList: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16181C',
    borderWidth: 1,
    borderColor: '#16181C',
  },
  filterText: {
    color: '#B3BAC4',
    fontSize: 14,
    fontWeight: '700',
  },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 160,
  },
  separator: {
    height: 1,
    marginLeft: 88,
    backgroundColor: '#14181D',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#F4F7FB',
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 8,
    color: '#798391',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  fabStack: {
    position: 'absolute',
    right: 20,
    bottom: 106,
    gap: 14,
    alignItems: 'center',
  },
  secondaryFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171A1E',
  },
  primaryFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
