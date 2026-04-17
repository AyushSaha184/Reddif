import React from 'react';
import {
  Alert,
  FlatList,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
    Alert.alert('Remove bookmark', 'Delete this saved lead from your list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeBookmark(post.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>Pinned leads for quick follow-up</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <Icon name="bookmark-multiple" size={20} color={settings.accentColor} />
        </TouchableOpacity>
      </View>

      {bookmarks.length > 0 ? (
        <FlatList
          data={bookmarks}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <PostListItem
              post={item}
              accentColor={settings.accentColor}
              onPress={() => openPost(item)}
              onSecondaryPress={() => handleRemove(item)}
              secondaryIcon="trash-can-outline"
              secondaryTint="#FF6B6B"
              trailingValue="Saved"
              trailingTone="muted"
            />
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No saved chats</Text>
          <Text style={styles.emptySubtitle}>
            Bookmark leads from the main feed and they will show up here.
          </Text>
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    color: '#F5F7FB',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 4,
    color: '#77818D',
    fontSize: 13,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15181C',
  },
  listContent: {
    paddingBottom: 110,
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
    fontSize: 21,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 10,
    color: '#7B8591',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
