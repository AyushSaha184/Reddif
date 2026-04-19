import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextLayoutEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Post } from '../types';

const CARD_WIDTH = Dimensions.get('window').width - 32;
const DEFAULT_IMAGE_HEIGHT = 220;
const MIN_IMAGE_HEIGHT = 180;
const MAX_IMAGE_HEIGHT = 320;
const REDDIT_LOGO_URI = 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png';
const SHARE_ICON_URI = 'https://img.icons8.com/ios/50/share.png';
const BOOKMARK_ICON_URI = 'https://img.icons8.com/ios-filled/50/bookmark.png';
const BOOKMARK_OUTLINE_ICON_URI = 'https://img.icons8.com/ios/50/bookmark--edge.png';

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
  const imageScrollRef = useRef<ScrollView>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [hasBodyOverflow, setHasBodyOverflow] = useState(false);
  const [imageHeights, setImageHeights] = useState<Record<number, number>>({});
  const [showRedditLogoFallback, setShowRedditLogoFallback] = useState(false);
  const [showShareIconFallback, setShowShareIconFallback] = useState(false);
  const [showBookmarkIconFallback, setShowBookmarkIconFallback] = useState(false);

  const hasImages = post.imageUrls.length > 0;
  const hasMultipleImages = post.imageUrls.length > 1;
  const hasBody = Boolean(post.body && post.body.trim().length > 0);
  const activeImageHeight = imageHeights[currentImageIndex] ?? DEFAULT_IMAGE_HEIGHT;

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [appearAnim, post.id]);

  useEffect(() => {
    setHasBodyOverflow(false);
    setIsBodyExpanded(false);
    setCurrentImageIndex(0);
    setImageHeights({});
    setShowRedditLogoFallback(false);
    setShowShareIconFallback(false);
    setShowBookmarkIconFallback(false);
    imageScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [post.id, post.body]);

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

  const handleOpenInReddit = async () => {
    const redditUrl = `reddit://comments/${post.id}`;
    try {
      await Linking.openURL(redditUrl);
    } catch {
      try {
        await Linking.openURL(post.permalink);
      } catch {
        // no-op
      }
    }
  };

  const handleImageMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index !== currentImageIndex) {
      setCurrentImageIndex(index);
    }
  };

  const handleImageLoad = (
    index: number,
    event: NativeSyntheticEvent<{ source: { width: number; height: number } }>
  ) => {
    const width = event.nativeEvent.source?.width;
    const height = event.nativeEvent.source?.height;
    if (!width || !height) {
      return;
    }

    const scaledHeight = (CARD_WIDTH * height) / width;
    const boundedHeight = Math.max(MIN_IMAGE_HEIGHT, Math.min(MAX_IMAGE_HEIGHT, scaledHeight));

    setImageHeights(prev => {
      if (prev[index] === boundedHeight) {
        return prev;
      }
      return {
        ...prev,
        [index]: boundedHeight,
      };
    });
  };

  const handleBodyTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    setHasBodyOverflow(event.nativeEvent.lines.length > 3);
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
          ref={imageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleImageMomentumEnd}
          nestedScrollEnabled
          scrollEventThrottle={16}
          decelerationRate="fast"
          style={[styles.imageStrip, { height: activeImageHeight }]}
        >
          {post.imageUrls.map((uri, index) => (
            <Image
              key={`${post.id}-${index}`}
              source={{ uri }}
              onLoad={event => handleImageLoad(index, event)}
              style={[styles.cardImage, { height: activeImageHeight }]}
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
            <Text
              style={styles.bodyText}
              numberOfLines={isBodyExpanded ? undefined : 3}
              onTextLayout={handleBodyTextLayout}
            >
              {post.body}
            </Text>
            {hasBodyOverflow ? (
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
          <TouchableOpacity onPress={handleOpenInReddit} style={styles.actionButton}>
            {showRedditLogoFallback ? (
              <Icon name="open-in-new" size={19} color="#A6AFBB" />
            ) : (
              <Image
                source={{ uri: REDDIT_LOGO_URI }}
                onError={() => setShowRedditLogoFallback(true)}
                style={styles.redditLogo}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            {showShareIconFallback ? (
              <Icon name="share-variant-outline" size={19} color="#A6AFBB" />
            ) : (
              <Image
                source={{ uri: SHARE_ICON_URI }}
                onError={() => setShowShareIconFallback(true)}
                style={[styles.actionRemoteIcon, { tintColor: '#A6AFBB' }]}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onToggleBookmark} style={styles.actionButton}>
            {showBookmarkIconFallback ? (
              <Icon
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={19}
                color={isBookmarked ? accentColor : '#A6AFBB'}
              />
            ) : (
              <Image
                source={{ uri: isBookmarked ? BOOKMARK_ICON_URI : BOOKMARK_OUTLINE_ICON_URI }}
                onError={() => setShowBookmarkIconFallback(true)}
                style={[
                  styles.actionRemoteIcon,
                  { tintColor: isBookmarked ? accentColor : '#A6AFBB' },
                ]}
                resizeMode="contain"
              />
            )}
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
    gap: 8,
    marginTop: 6,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redditLogo: {
    width: 19,
    height: 19,
  },
  actionRemoteIcon: {
    width: 19,
    height: 19,
  },
});
