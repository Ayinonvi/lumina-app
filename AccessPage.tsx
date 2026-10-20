/**
 * Page d'accès — /acces
 * L'utilisateur entre son email + clé d'accès reçue après achat sur Gumroad.
 * La vérification se fait CÔTÉ SERVEUR uniquement.
 * Le frontend n'a aucun moyen de savoir si une clé est valide sans appel backend.
 */

import { useState } from "react";
import { verifyAccessKey } from "../lib/api";

type Step = "form" | "loading" | "success" | "error";

export default function AccessPage() {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading");
    setErrorMsg("");

    try {
      const { magicLink, isFirstAccess } = await verifyAccessKey(
        email.trim(),
        accessKey.trim()
      );

      if (!magicLink) {
        throw new Error("Lien de connexion non reçu");
      }

      setStep("success");

      // Court délai pour afficher le message de succès, puis redirection
      setTimeout(() => {
        window.location.href = magicLink;
      }, isFirstAccess ? 2000 : 1500);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer."
      );
      setStep("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a14 0%, #141420 50%, #0a0a14 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'DM Sans', sans-serif",
        color: "#e8e0d4",
      }}
    >
      {/* Stars background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              background: "#c9a96e",
              borderRadius: "50%",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "36px",
              color: "#c9a96e",
              letterSpacing: "8px",
              margin: 0,
            }}
          >
            LUMINA
          </h1>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              color: "#8a7f72",
              textTransform: "uppercase",
              margin: "8px 0 0",
            }}
          >
            by MIELY
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#141420",
            border: "1px solid #2a2840",
            borderRadius: "16px",
            padding: "40px",
          }}
        >
          {step === "success" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "24px" }}>✨</div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "24px",
                  color: "#c9a96e",
                  marginBottom: "16px",
                }}
              >
                Bienvenue dans LUMINA
              </h2>
              <p style={{ color: "#b8b0a4", lineHeight: 1.7 }}>
                Vérification réussie. Vous êtes redirigée vers votre espace…
              </p>
              <div
                style={{
                  marginTop: "24px",
                  width: "40px",
                  height: "40px",
                  border: "2px solid rgba(201,169,110,0.2)",
                  borderTop: "2px solid #c9a96e",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "24px auto 0",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "22px",
                  color: "#e8e0d4",
                  marginBottom: "8px",
                  textAlign: "center",
                }}
              >
                Accéder à votre espace
              </h2>
              <p
                style={{
                  color: "#8a7f72",
                  fontSize: "13px",
                  textAlign: "center",
                  marginBottom: "32px",
                  lineHeight: 1.6,
                }}
              >
                Entrez l'email utilisé lors de votre achat et la clé d'accès
                reçue par email.
              </p>

              {step === "error" && (
                <div
                  style={{
                    background: "rgba(220, 80, 80, 0.1)",
                    border: "1px solid rgba(220, 80, 80, 0.3)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    marginBottom: "24px",
                    color: "#e88080",
                    fontSize: "13px",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "#8a7f72",
                      marginBottom: "8px",
                    }}
                  >
                    Email d'achat
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="votre@email.fr"
                    disabled={step === "loading"}
                    style={{
                      width: "100%",
                      background: "#0a0a14",
                      border: "1px solid #2a2840",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      color: "#e8e0d4",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "rgba(201,169,110,0.5)")
                    }
                    onBlur={(e) => (e.target.style.borderColor = "#2a2840")}
                  />
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "#8a7f72",
                      marginBottom: "8px",
                    }}
                  >
                    Clé d'accès
                  </label>
                  <input
                    type="text"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    required
                    placeholder="Collez votre clé ici"
                    disabled={step === "loading"}
                    style={{
                      width: "100%",
                      background: "#0a0a14",
                      border: "1px solid #2a2840",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      color: "#c9a96e",
                      fontSize: "14px",
                      fontFamily: "monospace",
                      letterSpacing: "2px",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "rgba(201,169,110,0.5)")
                    }
                    onBlur={(e) => (e.target.style.borderColor = "#2a2840")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={step === "loading" || !email || !accessKey}
                  style={{
                    width: "100%",
                    background:
                      step === "loading" || !email || !accessKey
                        ? "rgba(201,169,110,0.3)"
                        : "#c9a96e",
                    color: "#0a0a14",
                    border: "none",
                    borderRadius: "8px",
                    padding: "14px",
                    fontSize: "14px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor:
                      step === "loading" || !email || !accessKey
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s",
                    fontWeight: 500,
                  }}
                >
                  {step === "loading" ? "Vérification…" : "Accéder à LUMINA"}
                </button>
              </form>

              <p
                style={{
                  marginTop: "24px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#4a4560",
                  lineHeight: 1.6,
                }}
              >
                Vous n'avez pas reçu votre clé ?{" "}
                <a
                  href="mailto:naomi@miely.fr"
                  style={{ color: "#8a7f72", textDecoration: "underline" }}
                >
                  Contactez-nous
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
