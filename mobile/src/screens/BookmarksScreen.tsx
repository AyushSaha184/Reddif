import React from 'react';
import {
  Alert,
  FlatList,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostListItem } from '../components/PostListItem';
import { useAppStore } from '../store/useAppStore';
import { Post } from '../types';

const getThemeBackground = (theme: 'system' | 'dark' | 'amoled') =>
  theme === 'amoled' ? '#000000' : '#0A0A0A';

export function BookmarksScreen() {
  const { bookmarks, removeBookmark, settings } = useAppStore();
  const backgroundColor = getThemeBackground(settings.theme);

  const openPost = async (post: Post) => {
    const redditUrl = `reddit://comments/${post.id}`;
    const supported = await Linking.canOpenURL(redditUrl);
    await Linking.openURL(supported ? redditUrl : post.permalink);
  };

  const handleRemove = (post: Post) => {
    Alert.alert(
      'Remove Bookmark',
      'Are you sure you want to remove this bookmark?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeBookmark(post.id),
        },
      ],
    );
  };

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
        data={bookmarks}
        renderItem={({ item }) => (
          <PostListItem
            post={item}
            accentColor={settings.accentColor}
            onPress={() => openPost(item)}
            onSecondaryPress={() => handleRemove(item)}
            secondaryIcon="delete-outline"
            secondaryTint="#FF6B6B"
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingBottom: 110,
  },
  separator: {
    height: 1,
    marginLeft: 88,
    backgroundColor: '#14181D',
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
