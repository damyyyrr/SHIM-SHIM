import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { colors as c } from './theme';

export function Pet({
  size = 180,
  mood = 'happy',
  onPress,
}: {
  size?: number;
  mood?: 'happy' | 'celebrate' | 'rest';
  onPress?: () => void;
}) {
  const bounce = useRef(new Animated.Value(0)).current;
  async function hop() {
    if (await AccessibilityInfo.isReduceMotionEnabled()) return;
    Animated.sequence([
      Animated.timing(bounce, { toValue: -12, duration: 150, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 0, useNativeDriver: true, friction: 4 }),
    ]).start();
  }
  useEffect(() => {
    if (mood === 'celebrate') void hop();
  }, [mood]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Saludar a Mimo, tu compañero virtual"
      onPress={() => {
        void hop();
        onPress?.();
      }}
      style={{ width: size, height: size * 1.06 }}
    >
      <View style={s.shadow} />
      <Animated.View style={[s.figure, { transform: [{ translateY: bounce }] }]}>
        <View style={[s.ear, s.earLeft]} />
        <View style={[s.ear, s.earRight]} />
        <View style={[s.arm, { left: '10%', transform: [{ rotate: '-28deg' }] }]} />
        <View style={[s.arm, { right: '10%', transform: [{ rotate: '28deg' }] }]} />
        <View style={[s.foot, { left: '25%' }]} />
        <View style={[s.foot, { right: '25%' }]} />
        <View style={s.body}>
          <View style={s.shine} />
          <View style={s.face}>
            <View style={[s.eye, mood === 'rest' && s.closedEye]} />
            <View style={[s.eye, mood === 'rest' && s.closedEye]} />
          </View>
          <View style={s.cheeks}>
            <View style={s.cheek} />
            <View style={s.cheek} />
          </View>
          <View
            style={[
              s.smile,
              mood === 'celebrate' && {
                height: '12%',
                backgroundColor: '#49395E',
                borderRadius: 12,
              },
            ]}
          />
        </View>
        {mood !== 'rest' && (
          <View style={s.dumbbell}>
            <View style={s.bar} />
            <View style={[s.plate, { left: '8%' }]} />
            <View style={[s.plate, { right: '8%' }]} />
            <View style={[s.cap, { left: '1%' }]} />
            <View style={[s.cap, { right: '1%' }]} />
          </View>
        )}
        {mood === 'celebrate' && (
          <>
            <View
              style={[
                s.confetti,
                {
                  top: '8%',
                  left: '3%',
                  backgroundColor: c.yellow,
                  transform: [{ rotate: '25deg' }],
                },
              ]}
            />
            <View
              style={[
                s.confetti,
                {
                  top: '23%',
                  right: '1%',
                  backgroundColor: c.pink,
                  transform: [{ rotate: '-30deg' }],
                },
              ]}
            />
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  figure: { width: '100%', height: '100%', position: 'relative' },
  shadow: {
    position: 'absolute',
    bottom: '4%',
    left: '18%',
    width: '64%',
    height: '9%',
    borderRadius: 100,
    backgroundColor: '#B2C3B34D',
  },
  body: {
    position: 'absolute',
    top: '23%',
    left: '20%',
    width: '60%',
    height: '61%',
    borderRadius: 47,
    backgroundColor: c.lilac,
    borderBottomWidth: 5,
    borderRightWidth: 4,
    borderColor: '#A18BCB',
  },
  shine: {
    position: 'absolute',
    top: '11%',
    left: '13%',
    width: '18%',
    height: '11%',
    borderRadius: 100,
    backgroundColor: '#CDBDEB',
  },
  ear: {
    position: 'absolute',
    top: '9%',
    width: '19%',
    height: '36%',
    backgroundColor: c.lilac,
    borderRadius: 50,
  },
  earLeft: { left: '21%', transform: [{ rotate: '-19deg' }] },
  earRight: { right: '21%', transform: [{ rotate: '19deg' }] },
  face: {
    position: 'absolute',
    top: '33%',
    left: '25%',
    right: '25%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: '14%',
  },
  eye: { width: '16%', height: '100%', borderRadius: 100, backgroundColor: '#49395E' },
  closedEye: { height: '25%', marginTop: '10%' },
  cheeks: {
    position: 'absolute',
    top: '51%',
    left: '13%',
    right: '13%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cheek: { width: '18%', height: 7, borderRadius: 10, backgroundColor: '#E6AAC0' },
  smile: {
    position: 'absolute',
    top: '51%',
    left: '43%',
    width: '16%',
    height: '10%',
    borderBottomWidth: 3,
    borderColor: '#49395E',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  arm: {
    position: 'absolute',
    top: '48%',
    width: '18%',
    height: '29%',
    borderRadius: 30,
    backgroundColor: '#A995D0',
  },
  foot: {
    position: 'absolute',
    bottom: '9%',
    width: '19%',
    height: '14%',
    borderRadius: 18,
    backgroundColor: '#A995D0',
  },
  dumbbell: {
    position: 'absolute',
    left: '15%',
    bottom: '23%',
    width: '70%',
    height: '22%',
    transform: [{ rotate: '-8deg' }],
  },
  bar: {
    position: 'absolute',
    width: '100%',
    height: '20%',
    top: '40%',
    borderRadius: 4,
    backgroundColor: '#4F6259',
  },
  plate: {
    position: 'absolute',
    width: '15%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#4F6259',
  },
  cap: {
    position: 'absolute',
    width: '9%',
    height: '65%',
    top: '17%',
    borderRadius: 3,
    backgroundColor: '#718879',
  },
  confetti: { position: 'absolute', width: '5%', height: '11%', borderRadius: 3 },
});
