import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {useAppStore} from '../store/useAppStore';
import {Post} from '../types';
import {ImageCarousel} from '../components/ImageCarousel';
import {FlairChip} from '../components/FlairChip';
import {BudgetBadge} from '../components/BudgetBadge';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export function BookmarksScreen() {
  const {bookmarks, removeBookmark, settings} = useAppStore();

  const handleDelete = (post: Post) => {
    Alert.alert(
      'Remove Bookmark',
      'Are you sure you want to remove this bookmark?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeBookmark(post.id),
        },
      ]
    );
  };

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

  const renderItem = ({item}: {item: Post}) => {
    return (
      <Swipeable
        renderRightActions={() => (
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => handleDelete(item)}
          >
            <Icon name="delete" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      >
        <View style={[styles.card, {backgroundColor: getThemeBackground()}]}>
          {item.imageUrls.length > 0 && (
            <View style={styles.imageContainer}>
              <ImageCarousel images={item.imageUrls} height={200} />
            </View>
          )}
          
          <View style={styles.content}>
            <View style={styles.header}>
              <FlairChip flair={item.flair} />
              {item.detectedBudget && (
                <BudgetBadge budget={item.detectedBudget} />
              )}
            </View>
            
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  if (bookmarks.length === 0) {
    return (
      <View style={[styles.container, {backgroundColor: getThemeBackground()}]}>
        <Text style={styles.emptyText}>No bookmarks yet</Text>
        <Text style={styles.emptySubtext}>
          Bookmark posts to save them for later
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: getThemeBackground()}]}>
      <FlatList
        data={bookmarks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
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
