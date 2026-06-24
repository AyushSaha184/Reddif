import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Post } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useExpiry } from '../hooks/useExpiry';
import { ImageCarousel } from './ImageCarousel';
import { FlairChip } from './FlairChip';
import { BudgetBadge } from './BudgetBadge';
import { apiService } from '../services/apiService';

const { width } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  isActive: boolean;
}

const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => {
  const iconMap: Record<string, string> = {
    bookmark: 'bookmark',
    'bookmark-outline': 'bookmark-outline',
    eye: 'eye',
    'eye-off': 'eye-off',
    share: 'share-variant',
    'open-in-new': 'open-in-new',
    clock: 'clock-outline',
    link: 'link',
    check: 'check',
  };

  return (
    <Icon name={iconMap[name] || 'link'} size={size} color={color} />
  );
};

export function PostCard({ post, isActive }: PostCardProps) {
  const { settings, addBookmark, removeBookmark, isBookmarked, toggleTrackedPost, isTracked } =
    useAppStore();
  const expiry = useExpiry(post.createdAt);
  const [isExpanded, setIsExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this Photoshop Request: ${post.title}\n${post.permalink}`,
        url: post.permalink,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(post.permalink);
  };

  // Issue #37: Update local state on success, not just tracked status
  const handleMarkSolved = async () => {
    const success = await apiService.markSolved(post.id);
    if (success) {
      toggleTrackedPost(post.id);
      useAppStore.getState().updatePostFlair(post.id, 'Solved');
    }
  };

  const bookmarked = isBookmarked(post.id);
  const tracked = isTracked(post.id);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => setIsExpanded(!isExpanded)}>
        <ImageCarousel images={post.imageUrls} height={300} />

        <View style={styles.content}>
          <View style={styles.header}>
            <FlairChip flair={post.flair} />
            {post.detectedBudget && <BudgetBadge budget={post.detectedBudget} />}
            {!expiry.expired && (
              <View style={styles.expiryContainer}>
                <Icon name="clock" size={14} color="#666" />
                <Text style={styles.expiryText}>{`${expiry.hours}h ${expiry.minutes}m`}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title} numberOfLines={isExpanded ? undefined : 2}>
            {post.title}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => bookmarked ? removeBookmark(post.id) : addBookmark(post)}>
              <Icon
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={bookmarked ? '#007AFF' : '#666'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Icon name="share" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleCopyLink}>
              <Icon name="link" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.solvedButton} onPress={handleMarkSolved}>
              <Icon name="check" size={20} color={tracked ? "#4CD964" : "#999"} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontSize: 12,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
  solvedButton: {
    padding: 8,
    marginLeft: 'auto',
  },
});