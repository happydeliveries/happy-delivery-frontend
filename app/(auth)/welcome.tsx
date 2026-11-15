import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// One background, one accent, one text color.
const BG = '#FFFBF2';
const ACCENT = '#FFCC00';
const INK = '#2B1B0E';
const MUTED = '#8A7B6D';

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  useLogo?: boolean;
};

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Your favorite meals,\ndelivered fast.',
    subtitle: 'Quick delivery from your favorite local restaurants, straight to your door.',
    useLogo: true,
  },
  {
    id: '2',
    title: 'Track every order\nin real time.',
    subtitle: 'Follow your driver from the kitchen to your door.',
    icon: 'location-outline',
  },
  {
    id: '3',
    title: 'Local favorites,\nall in one place.',
    subtitle: 'Browse menus and reorder your go-to meals in a few taps.',
    icon: 'restaurant-outline',
  },
];

const ART_SIZE = Math.min(width * 0.7, 280);

export default function WelcomeScreen() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const skipToEnd = () => {
    listRef.current?.scrollToIndex({ index: SLIDES.length - 1, animated: true });
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <View style={styles.art}>
        {item.useLogo ? (
          <Image
            source={require('../../assets/images/logo-fit.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon!} size={84} color={INK} />
          </View>
        )}
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {index < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={skipToEnd} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Animated.FlatList
        ref={listRef as any}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.carousel}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.25, 1, 0.25],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>

      <View style={styles.bottom}>
        <Link href="/(auth)/register?role=customer" asChild>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Get Started</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.signIn} activeOpacity={0.7}>
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    height: 44,
    paddingHorizontal: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: MUTED,
  },
  carousel: {
    flexGrow: 1,
  },
  slide: {
    width,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: height * 0.04,
    maxHeight: height * 0.34,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  iconCircle: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: ACCENT + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: INK,
    textAlign: 'center',
    lineHeight: 37,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: INK,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },
  signIn: {
    paddingVertical: 16,
  },
  signInText: {
    fontSize: 15,
    color: MUTED,
  },
  signInLink: {
    color: INK,
    fontWeight: '700',
  },
});