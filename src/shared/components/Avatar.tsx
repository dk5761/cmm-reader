/**
 * Avatar - Compound component for displaying user/source avatars
 * Supports images with text fallback
 *
 * Usage:
 * <Avatar size="lg">
 *   <Avatar.Image source={logoImage} />
 *   <Avatar.Fallback>KM</Avatar.Fallback>
 * </Avatar>
 */

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  ImageStyle,
  ViewStyle,
  TextStyle,
  StyleSheet,
} from "react-native";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AvatarSize = "sm" | "md" | "lg" | "xl";
type AvatarShape = "circle" | "rounded";

interface AvatarContextValue {
  size: AvatarSize;
  shape: AvatarShape;
  imageLoaded: boolean;
  setImageLoaded: (loaded: boolean) => void;
}

interface AvatarProps {
  size?: AvatarSize;
  shape?: AvatarShape;
  children: ReactNode;
  className?: string;
}

interface AvatarImageProps {
  source: ImageSourcePropType;
  className?: string;
}

interface AvatarFallbackProps {
  children: ReactNode;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Size Configuration
// ─────────────────────────────────────────────────────────────

const SIZES = {
  sm: { container: 32, fontSize: 12 },
  md: { container: 40, fontSize: 14 },
  lg: { container: 48, fontSize: 18 },
  xl: { container: 64, fontSize: 24 },
} as const;

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error("Avatar.* must be used within an Avatar component");
  }
  return context;
}

// ─────────────────────────────────────────────────────────────
// Avatar Root
// ─────────────────────────────────────────────────────────────

function AvatarRoot({ size = "lg", shape = "rounded", children }: AvatarProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const contextValue = useMemo(
    () => ({
      size,
      shape,
      imageLoaded,
      setImageLoaded,
    }),
    [size, shape, imageLoaded]
  );

  const sizeValue = SIZES[size].container;
  const borderRadius = shape === "circle" ? sizeValue / 2 : 8;

  return (
    <AvatarContext.Provider value={contextValue}>
      <View
        style={[
          styles.container,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius,
          },
        ]}
      >
        {children}
      </View>
    </AvatarContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar Image
// ─────────────────────────────────────────────────────────────

function AvatarImage({ source }: AvatarImageProps) {
  const { size, shape, setImageLoaded } = useAvatarContext();
  const sizeValue = SIZES[size].container;
  const borderRadius = shape === "circle" ? sizeValue / 2 : 8;

  return (
    <Image
      source={source}
      style={[
        styles.image,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius,
        },
      ]}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(false)}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar Fallback
// ─────────────────────────────────────────────────────────────

function AvatarFallback({ children }: AvatarFallbackProps) {
  const { size, shape, imageLoaded } = useAvatarContext();

  // Don't render if image loaded successfully
  if (imageLoaded) return null;

  const sizeValue = SIZES[size].container;
  const fontSize = SIZES[size].fontSize;
  const borderRadius = shape === "circle" ? sizeValue / 2 : 8;

  return (
    <View
      style={[
        styles.fallback,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius,
        },
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize }]}>{children}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#27272a", // bg-surface
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  fallback: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#e4e4e7", // zinc-200
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#3f3f46", // zinc-700
    fontWeight: "700",
  },
});

// ─────────────────────────────────────────────────────────────
// Compound Export
// ─────────────────────────────────────────────────────────────

export const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
});
