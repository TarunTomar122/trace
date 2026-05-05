import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

export const { fontFamily: sans } = loadOutfit("normal", {
  weights: ["300", "400", "600", "700"],
  subsets: ["latin"],
});

export const { fontFamily: serif } = loadCormorant("italic", {
  weights: ["300", "400"],
  subsets: ["latin"],
});
