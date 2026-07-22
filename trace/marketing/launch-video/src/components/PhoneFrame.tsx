type PhoneFrameProps = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  showStatusBar?: boolean;
};

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  width = 390,
  height = 844,
  showStatusBar = true,
}) => {
  const bezel = 14;
  const outerW = width + bezel * 2;
  const outerH = height + bezel * 2;

  return (
    <div
      style={{
        width: outerW,
        height: outerH,
        borderRadius: 52,
        background: "#1a1a1a",
        padding: bezel,
        boxShadow: "0 32px 80px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: 40,
          overflow: "hidden",
          background: "#f0f0f0",
          position: "relative",
        }}
      >
        {showStatusBar && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 44,
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 120,
                height: 28,
                borderRadius: 20,
                background: "#0a0a0a",
              }}
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};