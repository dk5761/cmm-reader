import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Global app settings state
 * Persisted to AsyncStorage
 */
type AppSettingsState = {
  showNsfwSources: boolean;
};

/**
 * Actions to modify app settings
 */
type AppSettingsActions = {
  setShowNsfwSources: (enabled: boolean) => void;
  toggleNsfwSources: () => void;
};

type AppSettingsStore = AppSettingsState & AppSettingsActions;

const initialState: AppSettingsState = {
  showNsfwSources: false,
};

/**
 * Global app settings store
 * Use this for app-level preferences like NSFW content, theme, reading modes, etc.
 */
export const useAppSettingsStore = create<AppSettingsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setShowNsfwSources: (enabled: boolean) => {
        set({ showNsfwSources: enabled });
      },

      toggleNsfwSources: () => {
        set({ showNsfwSources: !get().showNsfwSources });
      },
    }),
    {
      name: "app-settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
