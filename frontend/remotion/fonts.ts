import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadSpaceMono } from "@remotion/google-fonts/SpaceMono";

export const { fontFamily: fontGrotesk } = loadSpaceGrotesk("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const { fontFamily: fontMono } = loadSpaceMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
