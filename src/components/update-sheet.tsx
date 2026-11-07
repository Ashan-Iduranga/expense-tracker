import type { File } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/controls';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { Radius } from '@/constants/theme';
import { appVersion } from '@/data/reviews';
import { useColors } from '@/hooks/use-colors';
import { canInstallInApp, downloadApk, installApk } from '@/lib/apk-install';
import { type Update } from '@/lib/update-check';

type Step = { kind: 'idle' } | { kind: 'downloading'; progress: number } | { kind: 'ready'; file: File } | { kind: 'error' };

/**
 * What's new in the newer version, and the update. On Android the APK downloads here and Android's
 * installer replaces this app with it, keeping the data. Elsewhere the link opens in the browser.
 */
export function UpdateSheet({ update, visible, onClose }: { update: Update | null; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  if (!update) return null;

  const install = (file: File) => installApk(file).catch(() => setStep({ kind: 'error' }));

  const start = async () => {
    if (!canInstallInApp) {
      Linking.openURL(update.url).catch(() => {});
      onClose();
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStep({ kind: 'downloading', progress: 0 });
    try {
      const file = await downloadApk(update.url, (progress) => setStep({ kind: 'downloading', progress }), controller.signal);
      setStep({ kind: 'ready', file });
      install(file);
    } catch {
      setStep(controller.signal.aborted ? { kind: 'idle' } : { kind: 'error' });
    } finally {
      abort.current = null;
    }
  };

  const cancel = () => abort.current?.abort();
  const close = () => {
    if (step.kind === 'downloading') return; // Cancel first, so a download never runs unseen.
    onClose();
  };

  const pct = step.kind === 'downloading' ? Math.round(step.progress * 100) : 0;

  return (
    <Sheet visible={visible} onClose={close} title={`Version ${update.version}`}>
      <Txt variant="small" color="ink2">
        You have {appVersion() || 'an older version'}. Your data stays: it’s saved to your account.
      </Txt>
      {!!update.notes && (
        <ScrollView style={{ maxHeight: 240 }}>
          <Txt variant="body">{update.notes}</Txt>
        </ScrollView>
      )}

      {step.kind === 'downloading' && (
        <View style={{ gap: 8 }} aria-live="polite">
          <View
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            style={[styles.track, { backgroundColor: c.track }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.lime }]} />
          </View>
          <Txt variant="small" color="ink2">
            Downloading… {pct}%
          </Txt>
        </View>
      )}
      {step.kind === 'ready' && (
        <Txt variant="small" color="ink2">
          Downloaded. Tap Install on the next screen. If Android asks, allow installs from Daily Strip, then come back.
        </Txt>
      )}
      {step.kind === 'error' && (
        <Txt variant="small" color="neg">
          Couldn’t download the update. Check your connection and try again.
        </Txt>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {step.kind === 'downloading' ? (
          <PrimaryButton label="Cancel" tone="soft" onPress={cancel} style={{ flex: 1 }} />
        ) : (
          <PrimaryButton label="Later" tone="soft" onPress={close} style={{ flex: 1 }} />
        )}
        {step.kind === 'ready' ? (
          <PrimaryButton label="Install" icon="download" onPress={() => install(step.file)} style={{ flex: 1 }} />
        ) : (
          <PrimaryButton
            label={step.kind === 'error' ? 'Try again' : 'Update'}
            icon="download"
            busy={step.kind === 'downloading'}
            onPress={start}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
