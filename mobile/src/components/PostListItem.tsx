import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Post } from '../types';

interface PostListItemProps {
  post: Post;
  accentColor: string;
  onPress: () => void;
  onSecondaryPress?: () => void;
  secondaryIcon?: string;
  secondaryTint?: string;
}

const getRelativeTime = (createdAt: number) => {
  const deltaMs = Date.now() - createdAt;
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const getSubtitle = (post: Post) => {
  return post.detectedBudget
    ? `${post.flair} - ${post.detectedBudget}`
    : post.flair;
};

export function PostListItem({
  post,
  accentColor,
  onPress,
  onSecondaryPress,
  secondaryIcon = 'bookmark-outline',
  secondaryTint = '#7F8791',
}: PostListItemProps) {
  const previewImage = post.imageUrls[0];

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.avatarShell}>
        {previewImage ? (
          <Image source={{ uri: previewImage }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarFallbackText}>
              {post.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.textBlock}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {post.title}
          </Text>
          <Text style={styles.time}>{getRelativeTime(post.createdAt)}</Text>
        </View>

        <View style={styles.subtitleRow}>
          <Text numberOfLines={2} style={styles.subtitle}>
            {getSubtitle(post)}
          </Text>

          {onSecondaryPress ? (
            <TouchableOpacity
              onPress={onSecondaryPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.secondaryButton}
            >
              <Icon name={secondaryIcon} size={18} color={secondaryTint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
  },
  avatarShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#121821',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#F5F7FB',
    fontSize: 17,
    fontWeight: '700',
  },
  time: {
    color: '#7E8793',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  subtitle: {
    flex: 1,
    color: '#8490A1',
    fontSize: 14,
    lineHeight: 19,
  },
  secondaryButton: {
    width: 26,
    alignItems: 'center',
  },
});
