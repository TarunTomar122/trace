import React from "react";
import { LandingDemoFrame } from "../components/LandingDemoFrame";
import { GlossHeadline, Stage, Sub, useReveal } from "../components/AppleKit";

/**
 * The email screen renders the homepage's own email demo, so the video and the
 * site can never show different products.
 */
export const AppleEmailScene: React.FC<{ fadeOutAt?: number }> = ({ fadeOutAt }) => {
  const heading = useReveal(2, { y: 20 });
  const demo = useReveal(9, { y: 28, duration: 32 });
  const caption = useReveal(34, { y: 16 });

  return (
    <Stage fadeOutAt={fadeOutAt}>

      <div style={{ ...heading, marginTop: 96, marginBottom: 28, textAlign: "center" }}>
        <GlossHeadline size={52}>10 big things in tech and AI, every morning</GlossHeadline>
      </div>

      <div style={demo}>
        <LandingDemoFrame kind="email" width={700} height={520} scale={1.16} radius={24} />
      </div>

      <div style={{ ...caption, marginTop: 24 }}>
        <Sub size={26}>In your inbox at 10:30 Berlin.</Sub>
      </div>
    </Stage>
  );
};
