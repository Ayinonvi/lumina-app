/**
 * Page résultats — affiche l'analyse LUMINA ENGINE
 * Polling automatique pendant la génération, puis affichage complet.
 */

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { getAnalysis } from "../lib/api";

interface Props {
  session: Session;
}

type AnalysisResult = {
  profil?: {
    essence?: string;
    forces_cardinales?: string[];
    zones_ombre?: string[];
    signature_energetique?: string;
  };
  synthese?: {
    titre?: string;
    texte_principal?: string;
    message_cle?: string;
  };
  organisation?: {
    style_naturel?: string;
    rituels_matinaux?: string[];
    rituels_soir?: string[];
    outils_cles?: string[];
    structure_semaine?: string;
  };
  productivite?: {
    energie_chronotype?: string;
    mode_travail_optimal?: string;
    techniques_recommandees?: Array<{ nom?: string; description?: string; pourquoi?: string }>;
    pieges_a_eviter?: string[];
  };
  systeme_3_mois?: {
    vision_globale?: string;
    mois_1?: { theme?: string; focus?: string; objectifs?: string[]; actions_semaine_1?: string[] };
    mois_2?: { theme?: string; focus?: string; objectifs?: string[] };
    mois_3?: { theme?: string; focus?: string; objectifs?: string[] };
  };
  priorites?: Array<{
    rang?: number;
    domaine?: string;
    titre?: string;
    description?: string;
    premiere_action?: string;
  }>;
  actions?: Array<{
    titre?: string;
    categorie?: string;
    description?: string;
    impact?: string;
    difficulte?: string;
  }>;
  recommandations?: Array<{
    type?: string;
    titre?: string;
    description?: string;
    urgence?: string;
  }>;
  message_lumina?: string;
};

const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0a14",
    color: "#e8e0d4",
    fontFamily: "'DM Sans', sans-serif",
    padding: "24px 24px 80px",
  } as React.CSSProperties,
  container: { maxWidth: "760px", margin: "0 auto" } as React.CSSProperties,
  card: {
    background: "#141420",
    border: "1px solid #2a2840",
    borderRadius: "12px",
    padding: "32px",
    marginBottom: "24px",
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "20px",
    color: "#c9a96e",
    letterSpacing: "2px",
    borderBottom: "1px solid #2a2840",
    paddingBottom: "12px",
    marginBottom: "20px",
  } as React.CSSProperties,
  tag: {
    background: "rgba(201,169,110,0.1)",
    border: "1px solid rgba(201,169,110,0.3)",
    color: "#c9a96e",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    display: "inline-block",
    margin: "4px",
  } as React.CSSProperties,
};

export default function ResultsPage({ session }: Props) {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<{
    id: string;
    status: string;
    result: AnalysisResult | null;
    pdf_url: string | null;
    email_sent: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"synthese" | "organisation" | "productivite" | "3mois" | "actions">("synthese");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      const data = await getAnalysis(id);
      setAnalysis(data as typeof analysis);

      if (data?.status === "generating" || data?.status === "pending") {
        // Polling toutes les 3 secondes
        pollRef.current = setInterval(async () => {
          const updated = await getAnalysis(id);
          setAnalysis(updated as typeof analysis);
          if (updated?.status !== "generating" && updated?.status !== "pending") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 3000);
      }
    }

    fetchAnalysis();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const result = analysis?.result as AnalysisResult | null;

  // ── Loading ──
  if (!analysis || analysis.status === "pending" || analysis.status === "generating") {
    return (
      <div
        style={{
          ...S.page,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", color: "#c9a96e", letterSpacing: "6px" }}>
          LUMINA ENGINE
        </div>
        <div style={{ color: "#b8b0a4", maxWidth: "400px", lineHeight: 1.8 }}>
          Votre analyse est en cours de génération…
          <br />
          LUMINA croise vos données et tisse votre portrait.
        </div>
        <div
          style={{
            width: "60px",
            height: "60px",
            border: "2px solid rgba(201,169,110,0.2)",
            borderTop: "2px solid #c9a96e",
            borderRadius: "50%",
            animation: "spin 1.5s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ color: "#4a4560", fontSize: "12px" }}>
          Cela peut prendre jusqu'à 60 secondes…
        </div>
      </div>
    );
  }

  // ── Erreur ──
  if (analysis.status === "error" || !result) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "48px", marginBottom: "24px" }}>⚠️</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#c9a96e", marginBottom: "16px" }}>
            Erreur de génération
          </h2>
          <p style={{ color: "#b8b0a4", marginBottom: "24px" }}>
            Une erreur est survenue. Veuillez réessayer ou contacter le support.
          </p>
          <a href="/app" style={{ color: "#c9a96e", textDecoration: "underline" }}>
            ← Retour au questionnaire
          </a>
        </div>
      </div>
    );
  }

  // ── Résultats ──
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* En-tête */}
        <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", color: "#c9a96e", letterSpacing: "6px", marginBottom: "8px" }}>
            LUMINA
          </div>
          {result.synthese?.titre && (
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px", color: "#e8e0d4", fontWeight: 400, margin: "0 0 16px" }}>
              {result.synthese.titre}
            </h1>
          )}
          {result.synthese?.message_cle && (
            <div
              style={{
                borderLeft: "3px solid #c9a96e",
                padding: "12px 20px",
                textAlign: "left",
                background: "rgba(201,169,110,0.05)",
                borderRadius: "0 8px 8px 0",
                maxWidth: "600px",
                margin: "0 auto",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "18px",
                fontStyle: "italic",
                color: "#e8e0d4",
              }}
            >
              {result.synthese.message_cle}
            </div>
          )}

          {/* Notification email */}
          {analysis.email_sent && (
            <div style={{ marginTop: "16px", fontSize: "12px", color: "#7a9e7a" }}>
              ✓ Analyse et PDF envoyés à {session.user.email}
            </div>
          )}
        </div>

        {/* Navigation onglets */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "#141420",
            border: "1px solid #2a2840",
            borderRadius: "10px",
            padding: "6px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { key: "synthese", label: "Synthèse" },
              { key: "organisation", label: "Organisation" },
              { key: "productivite", label: "Productivité" },
              { key: "3mois", label: "3 Mois" },
              { key: "actions", label: "Actions" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                minWidth: "80px",
                background: activeTab === key ? "#c9a96e" : "transparent",
                color: activeTab === key ? "#0a0a14" : "#8a7f72",
                border: "none",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "12px",
                letterSpacing: "1px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontWeight: activeTab === key ? 500 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Onglet : Synthèse */}
        {activeTab === "synthese" && (
          <>
            {result.profil && (
              <div style={S.card}>
                <div style={S.sectionTitle}>✦ Votre Profil Sacré</div>
                {result.profil.essence && (
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", color: "#e8e0d4", marginBottom: "24px", fontStyle: "italic" }}>
                    {result.profil.essence}
                  </p>
                )}
                {(result.profil.forces_cardinales ?? []).length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#8a7f72", marginBottom: "10px" }}>Forces Cardinales</div>
                    <div>{(result.profil.forces_cardinales ?? []).map((f) => <span key={f} style={S.tag}>{f}</span>)}</div>
                  </div>
                )}
                {result.profil.signature_energetique && (
                  <p style={{ color: "#b8b0a4", lineHeight: 1.8 }}>{result.profil.signature_energetique}</p>
                )}
              </div>
            )}
            {result.synthese?.texte_principal && (
              <div style={S.card}>
                <div style={S.sectionTitle}>✦ Analyse</div>
                <p style={{ color: "#b8b0a4", lineHeight: 1.9, fontSize: "14px" }}>
                  {result.synthese.texte_principal}
                </p>
              </div>
            )}
          </>
        )}

        {/* Onglet : Organisation */}
        {activeTab === "organisation" && result.organisation && (
          <>
            <div style={S.card}>
              <div style={S.sectionTitle}>✦ Votre Style Naturel</div>
              <p style={{ color: "#b8b0a4", lineHeight: 1.8 }}>{result.organisation.style_naturel}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {(result.organisation.rituels_matinaux ?? []).length > 0 && (
                <div style={S.card}>
                  <div style={S.sectionTitle}>Rituels Matinaux</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {(result.organisation.rituels_matinaux ?? []).map((r, i) => (
                      <li key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(42,40,64,0.5)", color: "#b8b0a4", fontSize: "13px" }}>
                        <span style={{ color: "#c9a96e", marginRight: "8px" }}>✦</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(result.organisation.rituels_soir ?? []).length > 0 && (
                <div style={S.card}>
                  <div style={S.sectionTitle}>Rituels du Soir</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {(result.organisation.rituels_soir ?? []).map((r, i) => (
                      <li key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(42,40,64,0.5)", color: "#b8b0a4", fontSize: "13px" }}>
                        <span style={{ color: "#c9a96e", marginRight: "8px" }}>✦</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {result.organisation.structure_semaine && (
              <div style={S.card}>
                <div style={S.sectionTitle}>Structure de la Semaine</div>
                <p style={{ color: "#b8b0a4", lineHeight: 1.8 }}>{result.organisation.structure_semaine}</p>
              </div>
            )}
          </>
        )}

        {/* Onglet : Productivité */}
        {activeTab === "productivite" && result.productivite && (
          <>
            <div style={S.card}>
              <div style={S.sectionTitle}>✦ Votre Énergie & Chronotype</div>
              <p style={{ color: "#b8b0a4", lineHeight: 1.8 }}>{result.productivite.energie_chronotype}</p>
            </div>
            {(result.productivite.techniques_recommandees ?? []).map((t, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 500, marginBottom: "8px", color: "#e8e0d4" }}>{t.nom}</div>
                <p style={{ color: "#b8b0a4", fontSize: "13px", marginBottom: "12px", lineHeight: 1.7 }}>{t.description}</p>
                <div style={{ fontSize: "12px", color: "#8a7f72", fontStyle: "italic" }}>Pourquoi vous : {t.pourquoi}</div>
              </div>
            ))}
          </>
        )}

        {/* Onglet : 3 Mois */}
        {activeTab === "3mois" && result.systeme_3_mois && (
          <>
            {result.systeme_3_mois.vision_globale && (
              <div style={S.card}>
                <div style={S.sectionTitle}>✦ Vision sur 3 Mois</div>
                <p style={{ color: "#b8b0a4", lineHeight: 1.8 }}>{result.systeme_3_mois.vision_globale}</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {(["mois_1", "mois_2", "mois_3"] as const).map((m, i) => {
                const mois = result.systeme_3_mois?.[m];
                if (!mois) return null;
                return (
                  <div key={m} style={S.card}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#c9a96e", textTransform: "uppercase", marginBottom: "8px" }}>
                      Mois {i + 1}
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", marginBottom: "12px", color: "#e8e0d4" }}>
                      {mois.theme}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {(mois.objectifs ?? []).map((o, j) => (
                        <li key={j} style={{ fontSize: "12px", color: "#8a7f72", padding: "4px 0" }}>
                          → {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Onglet : Actions */}
        {activeTab === "actions" && (
          <>
            {(result.priorites ?? []).length > 0 && (
              <div style={S.card}>
                <div style={S.sectionTitle}>✦ Vos Priorités</div>
                {(result.priorites ?? []).map((p) => (
                  <div key={p.rang} style={{ display: "flex", gap: "16px", padding: "12px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", color: "#c9a96e", minWidth: "32px" }}>
                      {p.rang}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: "4px" }}>{p.titre}</div>
                      <div style={{ fontSize: "13px", color: "#8a7f72", marginBottom: "8px" }}>{p.description}</div>
                      <div style={{ fontSize: "12px", color: "#c9a96e" }}>→ {p.premiere_action}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(result.actions ?? []).length > 0 && (
              <div style={S.card}>
                <div style={S.sectionTitle}>✦ Plan d'Actions</div>
                {(result.actions ?? []).map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: "16px", padding: "12px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <div style={{
                      minWidth: "80px",
                      fontSize: "10px",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: action.categorie === "immediat" ? "#c9a96e" : action.categorie === "court_terme" ? "#8a9eca" : "#8a7f72",
                    }}>
                      {action.categorie === "immediat" ? "Maintenant" : action.categorie === "court_terme" ? "Cette sem." : "Ce mois"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: "4px" }}>{action.titre}</div>
                      <div style={{ fontSize: "13px", color: "#8a7f72" }}>{action.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Message LUMINA */}
        {result.message_lumina && (
          <div
            style={{
              ...S.card,
              background: "linear-gradient(135deg, rgba(201,169,110,0.08), rgba(20,20,32,0.5))",
              border: "1px solid rgba(201,169,110,0.2)",
              textAlign: "center",
            }}
          >
            <div style={S.sectionTitle}>✦ Message de LUMINA</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", lineHeight: 1.9, color: "#e8e0d4", fontStyle: "italic" }}>
              {result.message_lumina}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4a4560", fontSize: "12px" }}>
          <p>LUMINA by MIELY · Analyse confidentielle</p>
        </div>
      </div>
    </div>
  );
}
