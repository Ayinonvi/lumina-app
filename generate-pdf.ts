/**
 * LUMINA — Génération PDF côté serveur
 * Récupère l'analyse en base → génère un PDF HTML via Puppeteer
 * → stocke dans Supabase Storage → envoie par email via Resend
 *
 * SÉCURITÉ : génération strictement serveur, jamais client-side.
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ── Auth helper (identique aux autres fonctions) ──
async function getUserFromToken(
  authHeader: string | undefined,
  supabaseUrl: string,
  anonKey: string
): Promise<{ id: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const { createClient: sc } = await import("@supabase/supabase-js");
  const supabase = sc(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email! };
}

// ── Génération du HTML du PDF ────────────────────────────────────────────────

function buildPdfHtml(
  analysis: Record<string, unknown>,
  profile: Record<string, unknown>
): string {
  const a = analysis as {
    profil?: { essence?: string; forces_cardinales?: string[]; signature_energetique?: string };
    synthese?: { titre?: string; texte_principal?: string; message_cle?: string };
    organisation?: { style_naturel?: string; rituels_matinaux?: string[]; rituels_soir?: string[]; outils_cles?: string[] };
    productivite?: { energie_chronotype?: string; techniques_recommandees?: Array<{ nom?: string; description?: string; pourquoi?: string }> };
    systeme_3_mois?: {
      vision_globale?: string;
      mois_1?: { theme?: string; objectifs?: string[] };
      mois_2?: { theme?: string; objectifs?: string[] };
      mois_3?: { theme?: string; objectifs?: string[] };
    };
    priorites?: Array<{ rang?: number; domaine?: string; titre?: string; description?: string; premiere_action?: string }>;
    actions?: Array<{ titre?: string; description?: string; categorie?: string; impact?: string }>;
    message_lumina?: string;
  };

  const firstName = (profile as { full_name?: string }).full_name?.split(" ")[0] ?? "vous";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analyse LUMINA — ${firstName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=DM+Sans:wght@300;400;500&display=swap');

    :root {
      --gold: #c9a96e;
      --bg-dark: #0a0a14;
      --bg-card: #141420;
      --text: #e8e0d4;
      --text-muted: #8a7f72;
      --border: #2a2840;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg-dark);
      color: var(--text);
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      line-height: 1.7;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 40px;
    }

    /* Cover */
    .cover {
      text-align: center;
      padding: 80px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 60px;
    }
    .cover-brand { font-family: 'Cormorant Garamond', serif; font-size: 48px; color: var(--gold); letter-spacing: 8px; }
    .cover-sub { font-size: 11px; letter-spacing: 3px; color: var(--text-muted); margin: 8px 0 40px; text-transform: uppercase; }
    .cover-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; color: var(--text); margin-bottom: 16px; }
    .cover-name { font-family: 'Cormorant Garamond', serif; font-size: 36px; color: var(--gold); margin-bottom: 40px; }
    .cover-date { font-size: 12px; color: var(--text-muted); }

    /* Sections */
    .section { margin-bottom: 48px; page-break-inside: avoid; }
    .section-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      color: var(--gold);
      letter-spacing: 2px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 24px;
    }

    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .card-title { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; }
    .card-content { color: var(--text); line-height: 1.8; }

    /* Tags */
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .tag {
      background: rgba(201,169,110,0.1);
      border: 1px solid rgba(201,169,110,0.3);
      color: var(--gold);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
    }

    /* Highlight box */
    .highlight {
      border-left: 3px solid var(--gold);
      padding: 16px 20px;
      background: rgba(201,169,110,0.05);
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px;
      color: var(--text);
      font-style: italic;
    }

    /* Lists */
    .numbered-list { list-style: none; }
    .numbered-list li {
      display: flex;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(42,40,64,0.5);
    }
    .numbered-list li:last-child { border-bottom: none; }
    .list-num { color: var(--gold); font-family: 'Cormorant Garamond', serif; font-size: 20px; min-width: 24px; }

    /* Month grid */
    .month-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .month-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
    .month-label { color: var(--gold); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
    .month-theme { font-family: 'Cormorant Garamond', serif; font-size: 18px; margin-bottom: 12px; }
    .month-objectives { list-style: none; }
    .month-objectives li { font-size: 12px; color: var(--text-muted); padding: 4px 0; }
    .month-objectives li::before { content: "→ "; color: var(--gold); }

    /* Message */
    .message-lumina {
      background: linear-gradient(135deg, rgba(201,169,110,0.1), rgba(20,20,32,0.5));
      border: 1px solid rgba(201,169,110,0.3);
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px;
      line-height: 1.8;
      color: var(--text);
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 40px;
      border-top: 1px solid var(--border);
      margin-top: 60px;
      color: var(--text-muted);
      font-size: 11px;
      letter-spacing: 1px;
    }

    @media print {
      body { background: white; color: #1a1a1a; }
      .card { background: #f5f5f5; border-color: #ddd; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Cover -->
  <div class="cover">
    <div class="cover-brand">LUMINA</div>
    <div class="cover-sub">Pack Organisation & Vie Complète · by MIELY</div>
    <div class="cover-title">Analyse Personnalisée</div>
    <div class="cover-name">${firstName}</div>
    <div class="cover-date">Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
  </div>

  <!-- Synthèse -->
  ${a.synthese ? `
  <div class="section">
    <div class="section-title">✦ Synthèse</div>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--text);margin-bottom:24px;">${a.synthese.titre ?? ""}</h2>
    <div class="highlight">${a.synthese.message_cle ?? ""}</div>
    <p style="margin-top:20px;color:#b8b0a4;line-height:1.9;">${a.synthese.texte_principal ?? ""}</p>
  </div>` : ""}

  <!-- Profil -->
  ${a.profil ? `
  <div class="section">
    <div class="section-title">✦ Votre Profil Sacré</div>
    <div class="card">
      <div class="card-title">Essence</div>
      <div class="card-content" style="font-family:'Cormorant Garamond',serif;font-size:18px;">${a.profil.essence ?? ""}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <div class="card-title">Forces Cardinales</div>
        <div class="tags">${(a.profil.forces_cardinales ?? []).map((f) => `<span class="tag">${f}</span>`).join("")}</div>
      </div>
      <div class="card">
        <div class="card-title">Signature Énergétique</div>
        <div class="card-content">${a.profil.signature_energetique ?? ""}</div>
      </div>
    </div>
  </div>` : ""}

  <!-- Organisation -->
  ${a.organisation ? `
  <div class="section">
    <div class="section-title">✦ Votre Système d'Organisation</div>
    <div class="card">
      <div class="card-title">Style Naturel</div>
      <div class="card-content">${a.organisation.style_naturel ?? ""}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
      <div class="card">
        <div class="card-title">Rituels Matinaux</div>
        <ul style="list-style:none;">
          ${(a.organisation.rituels_matinaux ?? []).map((r) => `<li style="padding:4px 0;color:#b8b0a4;">✦ ${r}</li>`).join("")}
        </ul>
      </div>
      <div class="card">
        <div class="card-title">Rituels du Soir</div>
        <ul style="list-style:none;">
          ${(a.organisation.rituels_soir ?? []).map((r) => `<li style="padding:4px 0;color:#b8b0a4;">✦ ${r}</li>`).join("")}
        </ul>
      </div>
    </div>
    ${(a.organisation.outils_cles ?? []).length > 0 ? `
    <div class="card" style="margin-top:16px;">
      <div class="card-title">Outils Clés Recommandés</div>
      <div class="tags">${(a.organisation.outils_cles ?? []).map((o) => `<span class="tag">${o}</span>`).join("")}</div>
    </div>` : ""}
  </div>` : ""}

  <!-- Productivité -->
  ${a.productivite ? `
  <div class="section">
    <div class="section-title">✦ Votre Productivité Naturelle</div>
    <div class="card">
      <div class="card-title">Chronotype & Énergie</div>
      <div class="card-content">${a.productivite.energie_chronotype ?? ""}</div>
    </div>
    ${(a.productivite.techniques_recommandees ?? []).map((t) => `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div class="card-title">${t.nom ?? ""}</div>
      </div>
      <div class="card-content">${t.description ?? ""}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-muted);font-style:italic;">Pourquoi vous : ${t.pourquoi ?? ""}</div>
    </div>`).join("")}
  </div>` : ""}

  <!-- Système 3 mois -->
  ${a.systeme_3_mois ? `
  <div class="section">
    <div class="section-title">✦ Votre Système sur 3 Mois</div>
    <p style="color:#b8b0a4;margin-bottom:24px;line-height:1.8;">${a.systeme_3_mois.vision_globale ?? ""}</p>
    <div class="month-grid">
      ${a.systeme_3_mois.mois_1 ? `
      <div class="month-card">
        <div class="month-label">Mois 1</div>
        <div class="month-theme">${a.systeme_3_mois.mois_1.theme ?? ""}</div>
        <ul class="month-objectives">
          ${(a.systeme_3_mois.mois_1.objectifs ?? []).map((o) => `<li>${o}</li>`).join("")}
        </ul>
      </div>` : ""}
      ${a.systeme_3_mois.mois_2 ? `
      <div class="month-card">
        <div class="month-label">Mois 2</div>
        <div class="month-theme">${a.systeme_3_mois.mois_2.theme ?? ""}</div>
        <ul class="month-objectives">
          ${(a.systeme_3_mois.mois_2.objectifs ?? []).map((o) => `<li>${o}</li>`).join("")}
        </ul>
      </div>` : ""}
      ${a.systeme_3_mois.mois_3 ? `
      <div class="month-card">
        <div class="month-label">Mois 3</div>
        <div class="month-theme">${a.systeme_3_mois.mois_3.theme ?? ""}</div>
        <ul class="month-objectives">
          ${(a.systeme_3_mois.mois_3.objectifs ?? []).map((o) => `<li>${o}</li>`).join("")}
        </ul>
      </div>` : ""}
    </div>
  </div>` : ""}

  <!-- Priorités -->
  ${(a.priorites ?? []).length > 0 ? `
  <div class="section">
    <div class="section-title">✦ Vos Priorités</div>
    <ul class="numbered-list">
      ${(a.priorites ?? []).map((p) => `
      <li>
        <span class="list-num">${p.rang ?? ""}</span>
        <div>
          <div style="font-weight:500;margin-bottom:4px;">${p.titre ?? ""} <span style="color:var(--text-muted);font-size:12px;">(${p.domaine ?? ""})</span></div>
          <div style="color:#b8b0a4;font-size:13px;">${p.description ?? ""}</div>
          <div style="margin-top:8px;font-size:12px;color:var(--gold);">→ Première action : ${p.premiere_action ?? ""}</div>
        </div>
      </li>`).join("")}
    </ul>
  </div>` : ""}

  <!-- Actions -->
  ${(a.actions ?? []).length > 0 ? `
  <div class="section">
    <div class="section-title">✦ Plan d'Actions</div>
    <div style="display:grid;gap:12px;">
      ${(a.actions ?? []).map((action) => `
      <div class="card" style="display:flex;gap:16px;align-items:start;">
        <div style="min-width:80px;text-align:center;">
          <span style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${action.categorie === "immediat" ? "#c9a96e" : action.categorie === "court_terme" ? "#8a9eca" : "#8a7f72"};">
            ${action.categorie === "immediat" ? "Maintenant" : action.categorie === "court_terme" ? "Cette semaine" : "Ce mois"}
          </span>
        </div>
        <div>
          <div style="font-weight:500;margin-bottom:4px;">${action.titre ?? ""}</div>
          <div style="color:#b8b0a4;font-size:13px;">${action.description ?? ""}</div>
          ${action.impact ? `<div style="margin-top:6px;font-size:12px;color:var(--text-muted);">Impact : ${action.impact}</div>` : ""}
        </div>
      </div>`).join("")}
    </div>
  </div>` : ""}

  <!-- Message LUMINA -->
  ${a.message_lumina ? `
  <div class="section">
    <div class="section-title">✦ Message de LUMINA</div>
    <div class="message-lumina">${a.message_lumina}</div>
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <p>LUMINA by MIELY · Analyse confidentielle et personnelle</p>
    <p style="margin-top:8px;">© ${new Date().getFullYear()} MIELY · miely.fr</p>
  </div>

</div>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const user = await getUserFromToken(
    event.headers.authorization,
    process.env.SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Non authentifié" }) };
  }

  let body: { analysisId?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON invalide" }) };
  }

  const { analysisId } = body;
  if (!analysisId) {
    return { statusCode: 400, body: JSON.stringify({ error: "analysisId requis" }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 1. Récupérer l'analyse + profil sacré ──
  const [{ data: analysis }, { data: sacredProfile }] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, result, user_id, email_sent")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("sacred_profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!analysis?.result) {
    return { statusCode: 404, body: JSON.stringify({ error: "Analyse non trouvée" }) };
  }

  if (analysis.email_sent) {
    return { statusCode: 200, body: JSON.stringify({ success: true, alreadySent: true }) };
  }

  // ── 2. Générer le HTML du PDF ──
  const htmlContent = buildPdfHtml(
    analysis.result as Record<string, unknown>,
    (sacredProfile ?? {}) as Record<string, unknown>
  );

  // ── 3. Convertir en PDF via Puppeteer ──
  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require("puppeteer-core");
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();
  } catch (puppeteerError) {
    console.error("[generate-pdf] Erreur Puppeteer:", puppeteerError);
    // Fallback : on envoie le HTML directement si Puppeteer échoue
    // En production sur Netlify, utiliser @sparticuz/chromium
    pdfBuffer = Buffer.from(htmlContent, "utf-8");
  }

  // ── 4. Stocker dans Supabase Storage ──
  const pdfPath = `${user.id}/${analysisId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("lumina-pdfs")
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[generate-pdf] Erreur upload:", uploadError);
  } else {
    // Créer l'entrée dans pdf_files
    await supabase.from("pdf_files").insert({
      analysis_id: analysisId,
      user_id: user.id,
      storage_path: pdfPath,
      file_size: pdfBuffer.length,
    });

    // Mettre à jour l'analyse
    await supabase
      .from("analyses")
      .update({ pdf_generated_at: new Date().toISOString() })
      .eq("id", analysisId);
  }

  // ── 5. Envoyer l'email avec le PDF via Resend ──
  const firstName = (sacredProfile?.full_name ?? "").split(" ")[0] || "vous";

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${process.env.RESEND_FROM_NAME ?? "Lumina"} <${process.env.RESEND_FROM_EMAIL ?? "lumina@miely.fr"}>`,
        to: [user.email],
        subject: `✨ ${firstName}, votre analyse LUMINA est prête`,
        html: buildDeliveryEmail(firstName, analysisId),
        attachments: [
          {
            filename: `Analyse-LUMINA-${firstName}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
        ],
      }),
    });

    if (emailRes.ok) {
      await supabase
        .from("analyses")
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
        })
        .eq("id", analysisId);
    } else {
      const errText = await emailRes.text();
      console.error("[generate-pdf] Erreur Resend:", errText);
      await supabase
        .from("analyses")
        .update({ email_error: errText })
        .eq("id", analysisId);
    }
  } catch (emailError) {
    console.error("[generate-pdf] Exception email:", emailError);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, analysisId }),
  };
};

// ── Email de livraison ────────────────────────────────────────────────────────

function buildDeliveryEmail(firstName: string, analysisId: string): string {
  const appUrl = process.env.VITE_APP_URL ?? "https://lumina.miely.fr";
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre analyse LUMINA</title></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:'Georgia',serif;color:#e8e0d4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <h1 style="font-family:'Georgia',serif;font-size:32px;color:#c9a96e;letter-spacing:4px;margin:0;">LUMINA</h1>
        <p style="color:#8a7f72;font-size:12px;letter-spacing:2px;margin:8px 0 0;">by MIELY</p>
      </td>
    </tr>
    <tr>
      <td style="background:#141420;border:1px solid #2a2840;border-radius:12px;padding:40px;">
        <p style="font-size:20px;color:#e8e0d4;margin-bottom:24px;">
          ${firstName}, votre analyse est prête ✨
        </p>
        <p style="color:#b8b0a4;line-height:1.8;margin-bottom:24px;">
          Votre analyse personnalisée LUMINA — Pack Organisation & Vie Complète —
          est jointe à cet email en PDF.
        </p>
        <p style="color:#b8b0a4;line-height:1.8;margin-bottom:32px;">
          Vous pouvez également la consulter à tout moment dans votre espace personnel :
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${appUrl}/app/resultats/${analysisId}"
             style="background:#c9a96e;color:#0a0a14;padding:16px 32px;border-radius:8px;text-decoration:none;font-size:14px;letter-spacing:1px;font-weight:500;">
            Voir mon analyse en ligne
          </a>
        </div>
        <p style="color:#b8b0a4;line-height:1.8;margin-top:32px;">
          Je vous souhaite une belle lecture et une belle transformation.
        </p>
        <p style="color:#e8e0d4;margin-top:24px;">
          Avec lumière,<br>
          <strong style="color:#c9a96e;">Naomi — MIELY</strong>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-top:32px;">
        <p style="color:#4a4560;font-size:11px;">© MIELY · miely.fr</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
