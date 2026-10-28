import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import { useTrips } from '@/store/trips';

import { planReminders, type Reminder } from './reminders';

const CHANNEL = 'trip-reminders';
const MAX = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Trip reminders',
    // eslint-disable-next-line import/namespace -- re-exported via `export *`, rule can't follow it
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#F59E0B',
  });
}

export async function notificationsGranted() {
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Ask once; returns whether we may post notifications. */
export async function requestNotifications() {
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  useSession.getState().setReminders({ asked: true });
  return res.granted;
}

/** Everything that would be scheduled right now, across all upcoming / active trips. */
export function upcomingReminders(): Reminder[] {
  const { trips } = useTrips.getState();
  const { me, reminders } = useSession.getState();
  const marks = useLedger.getState().checklist;
  if (!reminders.on) return [];
  const now = Date.now();
  return Object.values(trips)
    .filter((t) => Date.parse(`${t.endDate}T23:59:59Z`) > now)
    .flatMap((trip) => planReminders({ trip, me: me[trip.id], now, enabled: reminders.kinds, done: (k) => Boolean(marks[k]?.done) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Wipes and re-creates all local reminders (debounced). Safe to call often. */
export function rescheduleReminders() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      if (!(await notificationsGranted())) return;
      await ensureChannel();
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const r of upcomingReminders()) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, data: { url: r.url }, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL, delivery: r.kind === 'flights' || r.kind === 'hotels' ? 'alarmClock' : 'bestEffort' },
        });
      }
    } catch {
      // never block the app on scheduling
    }
  }, 800);
}

export async function sendTestNotification() {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: '🧭 Trip Buddy reminders are on', body: 'You’ll get check-in, airport, check-out and morning-plan reminders — even offline.', data: { url: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL },
  });
}

/** Reschedules on relevant changes and routes notification taps. Returns cleanup. */
export function startReminders() {
  rescheduleReminders();
  const unTrips = useTrips.subscribe((s, p) => s.trips !== p.trips && rescheduleReminders());
  const unSession = useSession.subscribe((s, p) => (s.me !== p.me || s.reminders !== p.reminders) && rescheduleReminders());
  const unLedger = useLedger.subscribe((s, p) => s.checklist !== p.checklist && rescheduleReminders());
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const url = resp.notification.request.content.data?.url;
    if (typeof url === 'string') setTimeout(() => router.push(url as never), 300);
  });
  return () => {
    unTrips();
    unSession();
    unLedger();
    sub.remove();
  };
}

