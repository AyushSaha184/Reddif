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
  trailingValue?: string;
  trailingTone?: 'accent' | 'muted';
}

const FLARE_LABELS: Record<string, string> = {
  All: 'All leads',
  'Paid - No AI': 'Manual work only',
  'Paid - AI OK': 'AI workflow accepted',
  Free: 'Free request',
};

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
  const flairLabel = FLARE_LABELS[post.flair] ?? post.flair;
  const budget = post.detectedBudget ? ` • ${post.detectedBudget}` : '';
  return `${flairLabel}${budget}`;
};

export function PostListItem({
  post,
  accentColor,
  onPress,
  onSecondaryPress,
  secondaryIcon = 'bookmark-outline',
  secondaryTint = '#7F8791',
  trailingValue,
  trailingTone = 'muted',
}: PostListItemProps) {
  const previewImage = post.imageUrls[0];
  const bubbleColor = trailingTone === 'accent' ? accentColor : '#2B313A';
  const bubbleTextColor = trailingTone === 'accent' ? '#061018' : '#F4F7FB';

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

          <View style={styles.trailingArea}>
            {trailingValue ? (
              <View style={[styles.trailingBubble, { backgroundColor: bubbleColor }]}>
                <Text style={[styles.trailingText, { color: bubbleTextColor }]}>
                  {trailingValue}
                </Text>
              </View>
            ) : null}
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
  trailingArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  trailingBubble: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  trailingText: {
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryButton: {
    width: 26,
    alignItems: 'center',
  },
});
