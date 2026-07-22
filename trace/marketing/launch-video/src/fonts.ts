import { loadFont as loadIBMPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadIBMPlexSerif } from "@remotion/google-fonts/IBMPlexSerif";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

/** App body/UI — matches trace FontFamily */
export const { fontFamily: sans } = loadIBMPlexSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/** App headlines — matches trace FontFamilySerif */
export const { fontFamily: serif } = loadIBMPlexSerif("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

/** Marketing display type for reel hooks */
export const { fontFamily: display } = loadOutfit("normal", {
  weights: ["300", "400", "600", "700", "800"],
  subsets: ["latin"],
});