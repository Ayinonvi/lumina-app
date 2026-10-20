export default function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "32px",
          color: "#c9a96e",
          letterSpacing: "8px",
        }}
      >
        LUMINA
      </div>
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "2px solid rgba(201,169,110,0.2)",
          borderTop: "2px solid #c9a96e",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
