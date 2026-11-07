import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { IconButton, PrimaryButton, Switch } from '@/components/controls';
import { KeyboardBar } from '@/components/keyboard-bar';
import { Enter } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { Fonts, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { AnonymousName, ReviewTextMax, useMyReview } from '@/data/reviews';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';

const Words = ['', 'Not for me', 'Needs work', 'It’s okay', 'I like it', 'Love it'];
const STAR = 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z';

function Star({ on, size = 44 }: { on: boolean; size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={STAR} fill={on ? c.lime : 'none'} stroke={on ? c.inkFixed : c.line2} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Rate the app and, optionally, say why. Approved reviews appear on the website. */
export default function Rate() {
  const c = useColors();
  const mine = useMyReview();
  // Wait for the earlier review (from the phone, so this is quick), so the form opens on it.
  if (!mine.loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.ink3} />
      </View>
    );
  }
  return <RateForm {...mine} />;
}

function RateForm({ review, save }: ReturnType<typeof useMyReview>) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { profile: p } = useProfile();
  const { showToast } = useToast();
  const first = (p.name || '').trim().split(/\s+/)[0] ?? '';

  const [rating, setRating] = useState(review?.rating ?? 0);
  const [text, setText] = useState(review?.text ?? '');
  const [showName, setShowName] = useState(!!review && review.name !== AnonymousName);

  const trimmed = text.trim();
  const unchanged = !!review && review.rating === rating && review.text === trimmed && (review.name !== AnonymousName) === showName;

  function submit() {
    try {
      save({ rating, text: trimmed, name: showName && first ? first : AnonymousName });
      hapticSuccess();
      showToast(trimmed ? 'Thanks! Your words will show once they’re approved.' : 'Thanks for rating Daily Strip!');
      router.back();
    } catch {
      showToast('Couldn’t save. Please try again.');
    }
  }

  let i = 0;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAwareScrollView
        bottomOffset={62}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(28, insets.bottom + 20) }]}>
        <Enter index={i++} style={styles.head}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
          <Txt variant="title" role="heading">
            Rate it
          </Txt>
        </Enter>

        <Enter index={i++} style={[styles.card, { backgroundColor: c.surface }]}>
          <Txt variant="bodySemi">How is Daily Strip working for you?</Txt>
          <View style={styles.stars} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <PressableScale
                key={n}
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}, ${Words[n]}`}
                scaleTo={0.85}
                hitSlop={4}
                onPress={() => {
                  hapticSelection();
                  setRating(n);
                }}>
                <Star on={n <= rating} />
              </PressableScale>
            ))}
          </View>
          <Txt variant="smallBold" color={rating ? 'ink' : 'ink3'} style={{ textAlign: 'center' }}>
            {rating ? Words[rating] : 'Tap a star'}
          </Txt>
        </Enter>

        <Enter index={i++} style={[styles.card, { backgroundColor: c.surface }]}>
          <Txt variant="bodySemi">Tell us more (optional)</Txt>
          <TextInput
            maxFontSizeMultiplier={1.3}
            value={text}
            onChangeText={(t) => setText(t.slice(0, ReviewTextMax))}
            multiline
            maxLength={ReviewTextMax}
            placeholder="What do you like? What should change?"
            placeholderTextColor={c.ink3}
            aria-label="Your feedback"
            style={[styles.input, { color: c.ink, borderColor: c.line2, backgroundColor: c.bg }]}
          />
          <Txt variant="caption" color="ink3" style={{ textAlign: 'right' }}>
            {text.length}/{ReviewTextMax}
          </Txt>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodySemi">Show my first name</Txt>
              <Txt variant="caption" color="ink3">
                {showName && first ? `Shown as “${first}”` : `Shown as “${AnonymousName}”`}
              </Txt>
            </View>
            <Switch value={showName} onChange={setShowName} label="Show my first name" />
          </View>
        </Enter>

        <Enter index={i++} style={{ gap: 12 }}>
          <Txt variant="small" color="ink2">
            Your stars count on the Daily Strip website straight away. Anything you write appears there after a quick check, and you can change it any time.
          </Txt>
          <PrimaryButton label={review ? 'Update my rating' : 'Send rating'} icon="check" disabled={!rating || unchanged} onPress={submit} />
          {review?.status === 'pending' && (
            <Txt variant="caption" color="ink3" style={{ textAlign: 'center' }}>
              Your words are waiting for approval.
            </Txt>
          )}
        </Enter>
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter, gap: 20, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderRadius: Radius.card, padding: 16, gap: 12 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  input: { minHeight: 110, borderWidth: 1.5, borderRadius: 14, padding: 12, textAlignVertical: 'top', fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
});
