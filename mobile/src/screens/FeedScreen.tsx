import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Text,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import {useAppStore} from '../store/useAppStore';
import {PostCard} from '../components/PostCard';
import {FilterBar} from '../components/FilterBar';
import {ConnectionBanner} from '../components/ConnectionBanner';
import {useNetworkStatus} from '../hooks/useNetworkStatus';

const FLAIRS = ['All', 'Paid - No AI', 'Paid - AI OK', 'Free'] as const;
type FlairFilter = typeof FLAIRS[number];

export function FeedScreen() {
  const {posts, clearExpiredPosts, settings} = useAppStore();
  const isConnected = useNetworkStatus();
  const [selectedFlair, setSelectedFlair] = useState<FlairFilter>('All');
  const [loading, setLoading] = useState(true);

  // Clear expired posts on mount
  useEffect(() => {
    clearExpiredPosts();
    setLoading(false);
  }, [clearExpiredPosts]);

  // Use useMemo for efficient filtering
  const filteredPosts = useMemo(() => {
    if (selectedFlair === 'All') {
      return posts;
    }
    return posts.filter((post) => post.flair === selectedFlair);
  }, [posts, selectedFlair]);

  const getThemeBackground = () => {
    switch (settings.theme) {
      case 'dark':
        return '#121212';
      case 'amoled':
        return '#000000';
      default:
        return '#121212';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, {backgroundColor: getThemeBackground()}]}>
        <ActivityIndicator size="large" color={settings.accentColor} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: getThemeBackground()}]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={getThemeBackground()}
      />
      
      {!isConnected && <ConnectionBanner />}
      
      <FilterBar
        flairs={FLAIRS}
        selectedFlair={selectedFlair}
        onSelectFlair={setSelectedFlair}
      />

      {filteredPosts.length > 0 ? (
        <PagerView
          style={styles.pager}
          orientation="vertical"
          initialPage={0}
        >
          {filteredPosts.map((post, index) => (
            <View key={post.id} style={styles.page}>
              <PostCard post={post} isActive={index === 0} />
            </View>
          ))}
        </PagerView>
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
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
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
