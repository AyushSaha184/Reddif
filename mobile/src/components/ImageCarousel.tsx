import React, {useState, useEffect} from 'react';
import {View, ScrollView, StyleSheet, Dimensions} from 'react-native';
import FastImage from 'react-native-fast-image';

const {width} = Dimensions.get('window');

interface ImageCarouselProps {
  images: string[];
  height: number;
}

export function ImageCarousel({images, height}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length > 1) {
      FastImage.preload(
        images.slice(0, 3).map(uri => ({uri}))
      );
    }
  }, [images]);

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <View style={[styles.container, {height}]}>
        <FastImage
          source={{uri: images[0]}}
          style={[styles.image, {height}]}
          resizeMode={FastImage.resizeMode.contain}
          cacheControl={FastImage.cacheControl.cacheFirst}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, {height}]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}>
        {images.map((uri, index) => (
          <FastImage
            key={index}
            source={{uri}}
            style={[styles.image, {height, width}]}
            resizeMode={FastImage.resizeMode.contain}
            cacheControl={FastImage.cacheControl.cacheFirst}
          />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#007AFF',
  },
});