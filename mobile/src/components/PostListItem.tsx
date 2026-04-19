import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';

import { Post } from '../types';
import { useAppStore } from '../store/useAppStore';

const CARD_WIDTH = Dimensions.get('window').width - 32;

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

const getFlairBackground = (flair: string) => {
  switch (flair) {
    case 'Paid - No AI':
      return '#E86D3B';
    case 'Paid - AI OK':
      return '#F6A13B';
    case 'Free':
      return '#47B56A';
    case 'Solved':
      return '#4A84E8';
    default:
      return '#7E8793';
  }
};

export function PostListItem({
  post,
  accentColor,
  onPress,
  onSecondaryPress,
  secondaryIcon = 'bookmark-outline',
  secondaryTint = '#7F8791',
}: PostListItemProps) {
  const { toggleTrackedPost, isTracked } = useAppStore();
  const tracked = isTracked(post.id);
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [appearAnim, post.id]);

  const handleOpen = async () => {
    const redditUrl = `reddit://comments/${post.id}`;
    try {
      await Linking.openURL(redditUrl);
    } catch {
      await Linking.openURL(post.permalink);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.title}\n${post.permalink}`,
        url: post.permalink,
      });
    } catch {
      // no-op
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(post.permalink);
    Alert.alert('Link copied', 'Post link has been copied to clipboard.');
  };

  const handleTrackSolved = async () => {
    toggleTrackedPost(post.id);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: appearAnim,
          transform: [
            {
              translateY: appearAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {post.imageUrls.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageStrip}
        >
          {post.imageUrls.map((uri, index) => (
            <Image
              key={`${post.id}-${index}`}
              source={{ uri }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyMedia, { backgroundColor: `${accentColor}33` }]}>
          <Icon name="image-outline" size={26} color={accentColor} />
        </View>
      )}

      <TouchableOpacity style={styles.content} activeOpacity={0.9} onPress={onPress}>
        <View style={styles.metaRow}>
          <View style={[styles.flairChip, { backgroundColor: getFlairBackground(post.flair) }]}>
            <Text style={styles.flairText}>{post.flair}</Text>
          </View>
          <Text style={styles.time}>{getRelativeTime(post.createdAt)}</Text>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {post.body ? (
          <Text style={styles.bodyText}>{post.body}</Text>
        ) : null}

        <Text style={styles.subtitle}>{getSubtitle(post)}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleOpen} style={styles.actionButton}>
            <Icon name="open-in-new" size={18} color="#A6AFBB" />
            <Text style={styles.actionLabel}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Icon name="share-variant-outline" size={18} color="#A6AFBB" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCopyLink} style={styles.actionButton}>
            <Icon name="link-variant" size={18} color="#A6AFBB" />
            <Text style={styles.actionLabel}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleTrackSolved} style={styles.actionButton}>
            <Icon
              name={tracked ? 'bell-check-outline' : 'bell-outline'}
              size={18}
              color={tracked ? accentColor : '#A6AFBB'}
            />
            <Text style={[styles.actionLabel, tracked && { color: accentColor }]}>Solved</Text>
          </TouchableOpacity>

          {onSecondaryPress ? (
            <TouchableOpacity onPress={onSecondaryPress} style={styles.actionButton}>
              <Icon name={secondaryIcon} size={18} color={secondaryTint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: '#1E242D',
  },
  imageStrip: {
    width: '100%',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: 220,
    backgroundColor: '#0D1016',
  },
  emptyMedia: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flairChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  flairText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: '#F5F7FB',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  bodyText: {
    color: '#CED5DE',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  time: {
    color: '#7E8793',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    color: '#99A3B2',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  actionLabel: {
    color: '#A6AFBB',
    fontSize: 12,
    fontWeight: '600',
  },
});
