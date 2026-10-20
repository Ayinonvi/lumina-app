/**
 * LUMINA — Webhook Gumroad
 * Reçoit la notification d'achat, génère une clé d'accès unique,
 * l'enregistre en base (hachée), et envoie un email à l'acheteur.
 *
 * SÉCURITÉ : toute la logique est côté serveur.
 * Le frontend ne participe jamais à la validation d'un achat.
 */

import { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Génère une clé d'accès aléatoire de 32 caractères hex */
function generateAccessKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Hash la clé avec SHA-256 avant stockage (bcrypt non dispo en edge sans npm, SHA-256 suffisant ici) */
function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Vérifie la signature Gumroad (si secret configuré) */
function verifyGumroadSignature(
  body: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/** Parse le body URL-encoded de Gumroad */
function parseGumroadBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  // Seule méthode POST acceptée
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const rawBody = event.body ?? "";

  // ── 1. Vérification signature Gumroad (si configurée) ──
  const webhookSecret = process.env.GUMROAD_WEBHOOK_SECRET ?? "";
  if (webhookSecret) {
    const signature =
      event.headers["x-gumroad-signature"] ??
      event.headers["X-Gumroad-Signature"];
    if (!verifyGumroadSignature(rawBody, signature, webhookSecret)) {
      console.error("[webhook] Signature invalide");
      return { statusCode: 401, body: "Unauthorized" };
    }
  }

  // ── 2. Parsing du payload ──
  let data: Record<string, string>;
  try {
    // Gumroad envoie soit URL-encoded, soit JSON selon la config
    const contentType = event.headers["content-type"] ?? "";
    if (contentType.includes("application/json")) {
      data = JSON.parse(rawBody);
    } else {
      data = parseGumroadBody(rawBody);
    }
  } catch (e) {
    console.error("[webhook] Parsing échoué", e);
    return { statusCode: 400, body: "Bad Request" };
  }

  // ── 3. Validation des champs essentiels ──
  const {
    sale_id,
    email,
    product_id,
    product_permalink,
    sale_timestamp,
    refunded,
    disputed,
    test,
  } = data;

  // En production, ignorer les achats test
  if (test === "true" && process.env.NODE_ENV === "production") {
    console.log("[webhook] Achat test ignoré en production");
    return { statusCode: 200, body: "OK (test ignored)" };
  }

  // Refus si champs manquants
  if (!sale_id || !email) {
    console.error("[webhook] Champs manquants:", { sale_id, email });
    return { statusCode: 400, body: "Missing required fields" };
  }

  // Vérification que c'est bien le bon produit
  const expectedProductId = process.env.GUMROAD_PRODUCT_ID ?? "lumina";
  const isCorrectProduct =
    product_id === expectedProductId ||
    product_permalink === expectedProductId ||
    product_permalink?.includes(expectedProductId);

  if (!isCorrectProduct) {
    console.log("[webhook] Produit différent, ignoré:", product_permalink);
    return { statusCode: 200, body: "OK (wrong product)" };
  }

  // ── 4. Connexion Supabase (service role — accès total) ──
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 5. Vérifier si cet achat existe déjà (idempotence) ──
  const { data: existing } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("gumroad_sale_id", sale_id)
    .single();

  if (existing) {
    // Mise à jour si remboursement/litige arrive après
    if (refunded === "true" || disputed === "true") {
      const newStatus = refunded === "true" ? "refunded" : "disputed";
      await supabase
        .from("purchases")
        .update({ status: newStatus })
        .eq("gumroad_sale_id", sale_id);
      console.log(`[webhook] Achat ${sale_id} mis à jour: ${newStatus}`);
    } else {
      console.log("[webhook] Achat déjà enregistré:", sale_id);
    }
    return { statusCode: 200, body: "OK" };
  }

  // ── 6. Générer la clé d'accès unique ──
  const accessKey = generateAccessKey();
  const accessKeyHash = hashKey(accessKey);
  const accessKeyPrefix = accessKey.substring(0, 8).toUpperCase();

  // ── 7. Enregistrer l'achat en base ──
  const { error: insertError } = await supabase.from("purchases").insert({
    gumroad_sale_id: sale_id,
    email: email.toLowerCase().trim(),
    product_id: product_id ?? expectedProductId,
    purchase_date: sale_timestamp
      ? new Date(sale_timestamp).toISOString()
      : new Date().toISOString(),
    status: "active",
    access_key_hash: accessKeyHash,
    access_key_prefix: accessKeyPrefix,
  });

  if (insertError) {
    console.error("[webhook] Erreur insertion:", insertError);
    return { statusCode: 500, body: "Database error" };
  }

  // ── 8. Envoyer l'email avec la clé d'accès via Resend ──
  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${process.env.RESEND_FROM_NAME ?? "Lumina"} <${process.env.RESEND_FROM_EMAIL ?? "lumina@miely.fr"}>`,
        to: [email],
        subject: "✨ Bienvenue dans Lumina — Votre clé d'accès",
        html: buildAccessKeyEmail(email, accessKey),
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("[webhook] Erreur Resend:", errText);
      // On ne fait pas échouer le webhook pour autant — l'achat est enregistré
    } else {
      console.log("[webhook] Email envoyé à", email);
    }
  } catch (emailError) {
    console.error("[webhook] Exception envoi email:", emailError);
    // Idem — l'achat reste valide
  }

  console.log(
    `[webhook] ✅ Achat enregistré: ${sale_id} pour ${email} (prefix: ${accessKeyPrefix})`
  );
  return { statusCode: 200, body: "OK" };
};

// ─── Template email ──────────────────────────────────────────────────────────

function buildAccessKeyEmail(email: string, accessKey: string): string {
  const appUrl = process.env.VITE_APP_URL ?? "https://lumina.miely.fr";
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue dans Lumina</title>
</head>
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
        <p style="font-size:18px;color:#e8e0d4;margin-bottom:24px;">Bienvenue,</p>
        <p style="color:#b8b0a4;line-height:1.7;margin-bottom:24px;">
          Merci pour votre confiance. Votre Pack Organisation & Vie Complète est prêt.
          Voici votre clé d'accès personnelle et non transférable :
        </p>

        <!-- Clé d'accès -->
        <div style="background:#0a0a14;border:1px solid #c9a96e;border-radius:8px;padding:24px;text-align:center;margin:32px 0;">
          <p style="color:#8a7f72;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Votre clé d'accès</p>
          <code style="font-size:20px;color:#c9a96e;letter-spacing:4px;font-family:monospace;">${accessKey}</code>
        </div>

        <p style="color:#b8b0a4;line-height:1.7;margin-bottom:8px;">
          Pour accéder à votre outil :
        </p>
        <ol style="color:#b8b0a4;line-height:2;margin-bottom:32px;">
          <li>Rendez-vous sur <a href="${appUrl}/acces" style="color:#c9a96e;">${appUrl}/acces</a></li>
          <li>Entrez votre email : <strong style="color:#e8e0d4;">${email}</strong></li>
          <li>Collez votre clé d'accès ci-dessus</li>
          <li>Créez votre compte Lumina</li>
        </ol>

        <div style="background:#1a1a2e;border-left:3px solid #c9a96e;padding:16px;border-radius:0 8px 8px 0;margin-bottom:32px;">
          <p style="color:#8a7f72;font-size:12px;margin:0;">
            ⚠️ Cette clé est personnelle. Conservez cet email précieusement —
            vous en aurez besoin lors de votre première connexion uniquement.
          </p>
        </div>

        <p style="color:#b8b0a4;line-height:1.7;">
          Si vous avez la moindre question, répondez simplement à cet email.
          Naomi sera ravie de vous aider.
        </p>

        <p style="color:#e8e0d4;margin-top:32px;">
          Avec lumière,<br>
          <strong style="color:#c9a96e;">Naomi — MIELY</strong>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-top:32px;">
        <p style="color:#4a4560;font-size:11px;">
          © MIELY · <a href="https://miely.fr" style="color:#4a4560;">miely.fr</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
