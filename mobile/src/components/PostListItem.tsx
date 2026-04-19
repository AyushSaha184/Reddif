import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Post } from '../types';

const CARD_WIDTH = Dimensions.get('window').width - 32;

interface PostListItemProps {
  post: Post;
  accentColor: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
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
  isBookmarked,
  onToggleBookmark,
}: PostListItemProps) {
  const appearAnim = useRef(new Animated.Value(0)).current;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);

  const hasImages = post.imageUrls.length > 0;
  const hasMultipleImages = post.imageUrls.length > 1;
  const hasBody = Boolean(post.body && post.body.trim().length > 0);
  const shouldShowBodyExpand = useMemo(() => {
    return (post.body || '').trim().length > 140;
  }, [post.body]);

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [appearAnim, post.id]);

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

  const handleImageMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index !== currentImageIndex) {
      setCurrentImageIndex(index);
    }
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
      {hasImages ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleImageMomentumEnd}
          decelerationRate="fast"
          style={styles.imageStrip}
        >
          {post.imageUrls.map((uri, index) => (
            <Image
              key={`${post.id}-${index}`}
              source={{ uri }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyMedia, { backgroundColor: `${accentColor}33` }]}>
          <Icon name="image-outline" size={26} color={accentColor} />
        </View>
      )}

      {hasMultipleImages ? (
        <View style={styles.dotsRow}>
          {post.imageUrls.map((_, index) => (
            <View
              key={`${post.id}-dot-${index}`}
              style={[
                styles.dot,
                index === currentImageIndex
                  ? { backgroundColor: accentColor, borderColor: accentColor }
                  : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.metaRow}>
          <View style={[styles.flairChip, { backgroundColor: getFlairBackground(post.flair) }]}>
            <Text style={styles.flairText}>{post.flair}</Text>
          </View>
          <Text style={styles.time}>{getRelativeTime(post.createdAt)}</Text>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {hasBody ? (
          <>
            <Text style={styles.bodyText} numberOfLines={isBodyExpanded ? undefined : 3}>
              {post.body}
            </Text>
            {shouldShowBodyExpand ? (
              <TouchableOpacity
                onPress={() => setIsBodyExpanded(prev => !prev)}
                style={styles.expandButton}
              >
                <Icon
                  name={isBodyExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#A6AFBB"
                />
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Icon name="share-variant-outline" size={18} color="#A6AFBB" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onToggleBookmark} style={styles.actionButton}>
            <Icon
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? accentColor : '#A6AFBB'}
            />
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#0A0D12',
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
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dotInactive: {
    backgroundColor: '#323943',
    borderColor: '#4C5562',
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
  },
  expandButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 2,
    paddingRight: 6,
  },
  time: {
    color: '#7E8793',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#33404D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171D25',
  },
});
