/**
 * Interface admin — accessible uniquement à naomi.kpoviessi@gmail.com
 * Vue sur les achats, les analyses, les erreurs.
 */

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface Props {
  session: Session;
}

type Purchase = {
  id: string;
  email: string;
  gumroad_sale_id: string;
  status: string;
  purchase_date: string;
  access_key_prefix: string;
  used_at: string | null;
  created_at: string;
};

type Analysis = {
  id: string;
  user_id: string;
  status: string;
  email_sent: boolean;
  created_at: string;
  ai_model: string | null;
  generation_time_ms: number | null;
  error_message: string | null;
};

export default function AdminPage({ session }: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"purchases" | "analyses">("purchases");

  useEffect(() => {
    async function load() {
      const [p, a] = await Promise.all([
        supabase
          .from("purchases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("analyses")
          .select("id, user_id, status, email_sent, created_at, ai_model, generation_time_ms, error_message")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setPurchases((p.data as Purchase[]) ?? []);
      setAnalyses((a.data as Analysis[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const S = {
    page: {
      minHeight: "100vh",
      background: "#0a0a14",
      color: "#e8e0d4",
      fontFamily: "'DM Sans', sans-serif",
      padding: "24px",
    } as React.CSSProperties,
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: "13px",
    } as React.CSSProperties,
    th: {
      textAlign: "left" as const,
      padding: "10px 12px",
      background: "#141420",
      borderBottom: "1px solid #2a2840",
      color: "#8a7f72",
      fontSize: "11px",
      letterSpacing: "1px",
      textTransform: "uppercase" as const,
    } as React.CSSProperties,
    td: {
      padding: "10px 12px",
      borderBottom: "1px solid #1a1a2e",
      color: "#b8b0a4",
    } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", color: "#c9a96e", margin: 0 }}>
              LUMINA Admin
            </h1>
            <p style={{ color: "#8a7f72", fontSize: "12px", marginTop: "4px" }}>
              Connectée en tant que {session.user.email}
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "1px solid #2a2840", color: "#8a7f72", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
          >
            Déconnexion
          </button>
        </div>

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          {[
            { label: "Achats total", value: purchases.length },
            { label: "Actifs", value: purchases.filter((p) => p.status === "active").length },
            { label: "Utilisés", value: purchases.filter((p) => p.used_at).length },
            { label: "Analyses générées", value: analyses.filter((a) => a.status === "complete").length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#141420", border: "1px solid #2a2840", borderRadius: "8px", padding: "20px" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "32px", color: "#c9a96e" }}>{value}</div>
              <div style={{ fontSize: "11px", color: "#8a7f72", marginTop: "4px", letterSpacing: "1px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
          {(["purchases", "analyses"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? "#c9a96e" : "transparent",
                color: tab === t ? "#0a0a14" : "#8a7f72",
                border: "1px solid " + (tab === t ? "#c9a96e" : "#2a2840"),
                borderRadius: "6px",
                padding: "8px 20px",
                fontSize: "12px",
                letterSpacing: "1px",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {t === "purchases" ? "Achats" : "Analyses"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#8a7f72", padding: "40px" }}>Chargement…</div>
        ) : tab === "purchases" ? (
          <div style={{ background: "#141420", border: "1px solid #2a2840", borderRadius: "12px", overflow: "hidden" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Statut</th>
                  <th style={S.th}>Date achat</th>
                  <th style={S.th}>Clé (préfixe)</th>
                  <th style={S.th}>Utilisée le</th>
                  <th style={S.th}>Gumroad ID</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td style={S.td}>{p.email}</td>
                    <td style={S.td}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        background: p.status === "active" ? "rgba(120,200,120,0.1)" : "rgba(200,80,80,0.1)",
                        color: p.status === "active" ? "#7ac87a" : "#c87a7a",
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={S.td}>{new Date(p.purchase_date).toLocaleDateString("fr-FR")}</td>
<td style={{ ...S.td, fontFamily: "monospace", color: "#c9a96e" }}>{p.access_key_prefix}…</td>                    <td style={S.td}>{p.used_at ? new Date(p.used_at).toLocaleDateString("fr-FR") : "—"}</td>
                    <td style={S.td} style={{ fontSize: "11px", color: "#4a4560", ...S.td }}>{p.gumroad_sale_id}</td>
<td style={{ ...S.td, fontSize: "11px", color: "#4a4560" }}>{p.gumroad_sale_id}</td>                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ background: "#141420", border: "1px solid #2a2840", borderRadius: "12px", overflow: "hidden" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Statut</th>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Modèle</th>
                  <th style={S.th}>Temps</th>
                  <th style={S.th}>Email envoyé</th>
                  <th style={S.th}>Erreur</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => (
                  <tr key={a.id}>
                    <td style={S.td}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        background: a.status === "complete" ? "rgba(120,200,120,0.1)" : a.status === "error" ? "rgba(200,80,80,0.1)" : "rgba(200,180,80,0.1)",
                        color: a.status === "complete" ? "#7ac87a" : a.status === "error" ? "#c87a7a" : "#c8c07a",
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={S.td}>{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                    <td style={S.td} style={{ fontSize: "11px", ...S.td }}>{a.ai_model ?? "—"}</td>
                    <td style={S.td}>{a.generation_time_ms ? `${(a.generation_time_ms / 1000).toFixed(1)}s` : "—"}</td>
                    <td style={S.td}>{a.email_sent ? "✓" : "—"}</td>
                    <td style={{ ...S.td, color: "#c87a7a", fontSize: "11px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
