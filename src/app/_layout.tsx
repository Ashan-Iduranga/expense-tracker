import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { LoadingSplash } from '@/components/loading-splash';
import { ToastView } from '@/components/toast-view';
import { AccountProvider, useAccount } from '@/data/account';
import { BillsProvider, useBills } from '@/data/bills';
import { GoalsProvider } from '@/data/goals';
import { ListsProvider } from '@/data/lists';
import { isSettled, LoansProvider, useLoans } from '@/data/loans';
import { MonthProvider } from '@/data/month';
import { PlansProvider } from '@/data/plans';
import { ToastProvider } from '@/data/toast';
import { TransactionsProvider } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { dayLabel, formatMoney } from '@/lib/format';
import { onReminderTap, syncReminders } from '@/lib/reminders';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ToastProvider>
          <AccountProvider>
            <TransactionsProvider>
              <GoalsProvider>
                <BillsProvider>
                  <LoansProvider>
                    <ListsProvider>
                      <PlansProvider>
                        <MonthProvider>
                          <RootStack fontsReady={fontsLoaded || !!fontError} />
                        </MonthProvider>
                      </PlansProvider>
                    </ListsProvider>
                  </LoansProvider>
                </BillsProvider>
              </GoalsProvider>
            </TransactionsProvider>
          </AccountProvider>
        </ToastProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** Onboarding and setup until the user has a profile (and has seen the setup checklist), then the app. */
function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { profile, status, finishingSetup } = useAccount();
  const ready = fontsReady && status !== 'loading';
  const needsSetup = status === 'ready' && (!profile || finishingSetup);
  const [splashDone, setSplashDone] = useState(false);
  const endSplash = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {ready && <App needsSetup={needsSetup} showReminders={!needsSetup && status === 'ready'} />}
      {/* Takes over from the native splash and covers the app until it's ready. Kept at one spot in the tree so it never restarts. */}
      {!splashDone && <LoadingSplash ready={ready} onDone={endSplash} />}
    </>
  );
}

function App({ needsSetup, showReminders }: { needsSetup: boolean; showReminders: boolean }) {
  const c = useColors();
  return (
    <>
      <StatusBar style={c.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        {/*
          SDK 58: redirectTo picks where a blocked route lands, instead of "first available screen".
          It must be a URL, not a file path: "/(tabs)/index" has no screen (groups vanish from URLs
          and index is "/"), so it showed "Unmatched route" after "Open my strip".
        */}
        <Stack.Protected guard={needsSetup} redirectTo="/">
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="setup" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
        <Stack.Protected guard={!needsSetup} redirectTo="/onboarding">
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="add" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="goals" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="bills" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="loans" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="lists" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="list/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="plans" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="plan/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
      {showReminders && <Reminders />}
      <ToastView />
    </>
  );
}

/** "today" · "on Mon 27 Oct" */
function whenDue(d: Date) {
  const l = dayLabel(d);
  return l === 'Today' ? 'today' : l === 'Yesterday' ? 'yesterday' : `on ${l}`;
}

/** Keeps the on-device reminders in step with bills and loans, and opens the right screen when one is tapped. */
function Reminders() {
  const { bills } = useBills();
  const { loans } = useLoans();
  const { profile } = useAccount();
  const currency = profile?.currency;

  useEffect(() => onReminderTap((url) => router.push(url as never)), []);

  useEffect(() => {
    const t = setTimeout(() => {
      syncReminders([
        ...bills
          .filter((b) => b.remind)
          .map((b) => ({ id: `b-${b.id}`, title: `${b.name} is due ${whenDue(b.nextDue)}`, body: `${formatMoney(b.amount, currency)}. Tap to mark it paid.`, due: b.nextDue, url: '/bills' })),
        ...loans
          .filter((l) => l.remind && l.due && !isSettled(l))
          .map((l) => ({
            id: `l-${l.id}`,
            title: l.direction === 'lent' ? `${l.person} is due to pay you back` : `Time to pay back ${l.person}`,
            body: `${formatMoney(l.amount - l.paid, currency)} left, due ${whenDue(l.due!)}.`,
            due: l.due!,
            url: '/loans',
          })),
      ]);
    }, 800); // Debounced: snapshots often arrive in quick bursts.
    return () => clearTimeout(t);
  }, [bills, loans, currency]);

  return null;
}
