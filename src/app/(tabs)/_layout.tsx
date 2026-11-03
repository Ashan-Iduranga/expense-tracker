import { Tabs } from 'expo-router';

import { PillNav } from '@/components/pill-nav';
import { useColors } from '@/hooks/use-colors';

/** Home, History, Plan and Stats share the floating pill nav. */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => <PillNav state={props.state} emitter={props.emitter} navigateToTab={props.navigateToTab} />}
      screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="hub" options={{ title: 'Plan' }} />
      <Tabs.Screen name="insights" options={{ title: 'Stats' }} />
    </Tabs>
  );
}
