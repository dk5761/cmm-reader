import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Trigger haptic feedback
 * @param style - The style of feedback (Light, Medium, Heavy, etc.)
 */
export async function triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(style);
  } catch (e) {
    // Ignore errors on unsupported devices
  }
}

/**
 * Trigger notification feedback (Success, Warning, Error)
 */
export async function triggerNotification(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(type);
  } catch (e) {
    // Ignore
  }
}

/**
 * Trigger selection feedback (for sliders, pickers)
 */
export async function triggerSelection() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.selectionAsync();
  } catch (e) {
    // Ignore
  }
}
