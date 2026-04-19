import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
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

interface PostListItemProps {
  post: Post;
  accentColor: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

const getRelativeTime = (createdAt: number) => {
  const deltaMs = Date.now() - createdAt;
  interface CarouselImageProps {
    uri: string;
    postId: string;
  }

  const buildImageCandidates = (uri: string, postId: string): string[] => {
    const candidates = new Set<string>();
    const trimmed = uri.trim();
    if (trimmed.length === 0) {
      return [];
    }

    candidates.add(trimmed);

    const noQuery = trimmed.split('?')[0];
    if (noQuery) {
      candidates.add(noQuery);
    }

    if (noQuery.includes('preview.redd.it') || noQuery.includes('external-preview.redd.it')) {
      candidates.add(noQuery.replace('preview.redd.it', 'i.redd.it'));
      candidates.add(noQuery.replace('external-preview.redd.it', 'i.redd.it'));
    }

    candidates.add(`https://i.redd.it/${postId}.jpg`);
    candidates.add(`https://i.redd.it/${postId}.png`);

    return Array.from(candidates).filter(value => /^https?:\/\//i.test(value));
  };

  function CarouselImage({ uri, postId }: CarouselImageProps) {
    const [candidateIndex, setCandidateIndex] = useState(0);
    const candidates = useMemo(() => buildImageCandidates(uri, postId), [uri, postId]);
    const hasValidSource = candidates.length > 0;
    const activeCandidate = hasValidSource ? candidates[Math.min(candidateIndex, candidates.length - 1)] : '';

    useEffect(() => {
      setCandidateIndex(0);
    }, [uri, postId]);

    if (!hasValidSource) {
      return (
        <View style={[styles.cardImage, styles.imageUnavailable]}>
          <Icon name="image-broken-variant" size={22} color="#5E6875" />
        </View>
      );
    }

    return (
      <Image
        source={{ uri: activeCandidate }}
        style={styles.cardImage}
        resizeMode="contain"
        onError={() => {
          setCandidateIndex(prev => (prev < candidates.length - 1 ? prev + 1 : prev));
        }}
      />
    );
  }
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
  const imageListRef = useRef<FlatList<string>>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [hasBodyOverflow, setHasBodyOverflow] = useState(false);

  const hasImages = post.imageUrls.length > 0;
  const hasMultipleImages = post.imageUrls.length > 1;
  const hasBody = Boolean(post.body && post.body.trim().length > 0);
    const normalizedImageUrls = post.imageUrls
      .map(url => url?.replace(/&amp;/g, '&'))
      .map(url => (url?.startsWith('//') ? `https:${url}` : url))
      .filter((url): url is string => Boolean(url));

    const hasImages = normalizedImageUrls.length > 0;
    const hasMultipleImages = normalizedImageUrls.length > 1;
    const hasBody = Boolean(post.body && post.body.trim().length > 0);
    const shouldShowBodyExpand = hasBodyOverflow || (post.body?.trim().length ?? 0) > 180;
    .map(url => (url?.startsWith('//') ? `https:${url}` : url))
    .filter((url): url is string => Boolean(url));

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
    imageListRef.current?.scrollToOffset({ offset: 0, animated: false });
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
        <FlatList
          ref={imageListRef}
          data={normalizedImageUrls}
          keyExtractor={(uri, index) => `${post.id}-${index}-${uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          nestedScrollEnabled
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleImageMomentumEnd}
              <CarouselImage uri={item} postId={post.id} />
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.cardImage} resizeMode="contain" />
          )}
          style={styles.imageStrip}
        />
      ) : (
        <View style={[styles.emptyMedia, { backgroundColor: `${accentColor}33` }]}>
          <Icon name="image-outline" size={26} color={accentColor} />
        </View>
      )}

      {hasMultipleImages ? (
        <View style={styles.dotsRow}>
          {normalizedImageUrls.map((_, index) => (
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
              style={[styles.bodyText, styles.bodyMeasure]}
              onTextLayout={handleBodyTextLayout}
            >
              {post.body}
            </Text>
            <Text
              style={styles.bodyText}
              numberOfLines={isBodyExpanded ? undefined : 3}
            >
              {shouldShowBodyExpand ? (
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
          <TouchableOpacity onPress={onToggleBookmark} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: isBookmarked ? accentColor : '#A6AFBB' }]}> 
              Bookmark
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleOpenInReddit} style={styles.actionButton}>
            <Text style={styles.actionText}>Reddit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Text style={styles.actionText}>Share</Text>
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
    height: DEFAULT_IMAGE_HEIGHT,
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
  bodyMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
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
    minHeight: 26,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#A6AFBB',
    fontSize: 13,
    imageUnavailable: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontWeight: '600',
  },
});
