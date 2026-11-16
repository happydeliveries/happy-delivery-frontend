import { AppState, Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

const ORDER_RING_ASSET = require('../assets/sounds/order_ring.wav');
const VIBRATION_PATTERN = [0, 700, 350, 700, 900];
const DRIVER_ORDER_CHANNEL_ID = 'driver-incoming-orders';

let audioModuleCache: any | null | undefined = undefined;
let activePlayer: any | null = null;
let fallbackChimeTimer: ReturnType<typeof setInterval> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let isAlertActive = false;
let channelInitialized = false;
let activeNotificationId: string | null = null;

function getExpoAudioModule(): any | null {
  if (audioModuleCache !== undefined) return audioModuleCache;
  try {
    // Load dynamically so older custom dev binaries without native ExpoAudio still fall back safely
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audioModuleCache = require('expo-audio');
  } catch {
    audioModuleCache = null;
  }
  return audioModuleCache;
}

async function ensureNotificationChannel() {
  if (channelInitialized || Platform.OS === 'web') return;
  channelInitialized = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DRIVER_ORDER_CHANNEL_ID, {
        name: 'Incoming Delivery Orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: VIBRATION_PATTERN,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }
  } catch {
    // Ignore notification channel setup failures on unsupported platforms
  }
}

async function startAudioLoop() {
  const expoAudio = getExpoAudioModule();
  if (expoAudio?.createAudioPlayer) {
    try {
      if (typeof expoAudio.setAudioModeAsync === 'function') {
        await expoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'duckOthers',
          shouldRouteThroughEarpiece: false,
        });
      }

      if (!activePlayer) {
        activePlayer = expoAudio.createAudioPlayer(ORDER_RING_ASSET, {
          updateInterval: 500,
          keepAudioSessionActive: true,
        });
      }
      activePlayer.loop = true;
      activePlayer.volume = 1.0;
      activePlayer.muted = false;
      activePlayer.play();
      return;
    } catch (err) {
      console.warn('[DriverOrderAlert] expo-audio playback failed, using notification chime fallback:', err);
    }
  }

  // Fallback repeating sound if expo-audio native player isn't available
  if (!fallbackChimeTimer) {
    const pingChime = () => {
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Delivery Request',
          body: 'Tap to accept or decline incoming order',
          sound: 'default',
        },
        trigger: null,
      }).catch(() => {});
    };
    pingChime();
    fallbackChimeTimer = setInterval(pingChime, 2500);
  }
}

function startContinuousVibration() {
  if (Platform.OS === 'web') return;
  try {
    // Cancel any existing pattern first so repeated triggers re-sync cleanly
    Vibration.cancel();
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } catch (err) {
    console.warn('[DriverOrderAlert] Vibration failed:', err);
  }
}

/**
 * Starts continuous phone ringing (looping audio) and continuous vibration
 * until stopDriverOrderAlert() is explicitly called.
 */
export async function startDriverOrderAlert(meta?: { title?: string; body?: string }) {
  const alreadyActive = isAlertActive;
  isAlertActive = true;

  await ensureNotificationChannel();
  startContinuousVibration();
  await startAudioLoop();

  if (!alreadyActive) {
    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener('change', (state) => {
        if (!isAlertActive) return;
        if (state === 'active') {
          startContinuousVibration();
          if (activePlayer && !activePlayer.playing) {
            try {
              activePlayer.play();
            } catch {
              // ignore
            }
          }
        }
      });
    }

    if (!watchdogTimer) {
      watchdogTimer = setInterval(() => {
        if (!isAlertActive) return;
        if (activePlayer && !activePlayer.playing) {
          try {
            activePlayer.loop = true;
            activePlayer.play();
          } catch {
            // ignore
          }
        }
      }, 3000);
    }
  }

  // If app is currently backgrounded, also post a high-priority local notification
  if (AppState.currentState !== 'active' && Platform.OS !== 'web' && meta?.title) {
    try {
      if (activeNotificationId) {
        await Notifications.dismissNotificationAsync(activeNotificationId).catch(() => {});
      }
      activeNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: meta.title,
          body: meta.body || 'Open Happy Delivery to accept or decline.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
    } catch {
      // ignore if notifications permission wasn't granted
    }
  }
}

/**
 * Immediately stops ringing sound, stops continuous vibration, and cleans up timers.
 */
export async function stopDriverOrderAlert() {
  isAlertActive = false;

  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }

  if (fallbackChimeTimer) {
    clearInterval(fallbackChimeTimer);
    fallbackChimeTimer = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (Platform.OS !== 'web') {
    try {
      Vibration.cancel();
    } catch {
      // ignore
    }
  }

  if (activePlayer) {
    try {
      activePlayer.loop = false;
      activePlayer.pause();
      await activePlayer.seekTo(0).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (activeNotificationId) {
    const idToDismiss = activeNotificationId;
    activeNotificationId = null;
    Notifications.dismissNotificationAsync(idToDismiss).catch(() => {});
  }
}

export async function releaseDriverOrderAlertResources() {
  await stopDriverOrderAlert();
  if (activePlayer) {
    try {
      activePlayer.remove();
    } catch {
      // ignore
    }
    activePlayer = null;
  }
}
