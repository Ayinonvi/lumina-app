/**
 * LUMINA — Vérification de la clé d'accès
 * Reçoit { email, accessKey } → vérifie en base → retourne un token de session.
 *
 * SÉCURITÉ : la clé n'est JAMAIS vérifiable côté client.
 * Le frontend reçoit uniquement un token signé Supabase.
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ── 1. Parse du body ──
  let body: { email?: string; accessKey?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "JSON invalide" }),
    };
  }

  const { email, accessKey } = body;

  if (!email || !accessKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email et clé d'accès requis" }),
    };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedKey = accessKey.trim();

  // ── 2. Vérification en base ──
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const keyHash = hashKey(normalizedKey);

  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("id, email, status, access_key_hash, user_id, used_at")
    .eq("email", normalizedEmail)
    .eq("access_key_hash", keyHash)
    .single();

  if (error || !purchase) {
    // Réponse identique que l'email soit mauvais ou la clé mauvaise
    // → pas d'énumération possible
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Email ou clé d'accès incorrects" }),
    };
  }

  // ── 3. Vérifier le statut de l'achat ──
  if (purchase.status !== "active") {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: `Accès non disponible (statut: ${purchase.status})`,
      }),
    };
  }

  // ── 4. Créer ou récupérer le compte Supabase Auth ──
  let userId = purchase.user_id;

  if (!userId) {
    // Premier accès : on crée le compte Auth
    const tempPassword = crypto.randomBytes(32).toString("hex");

    const { data: authUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // Email déjà validé via Gumroad
        user_metadata: {
          lumina_purchase_id: purchase.id,
        },
      });

    if (createError) {
      // Si l'utilisateur existe déjà (re-tentative)
      if (createError.message?.includes("already")) {
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const found = existingUser?.users?.find(
          (u) => u.email === normalizedEmail
        );
        if (found) {
          userId = found.id;
        }
      } else {
        console.error("[verify-access] Erreur création user:", createError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Erreur serveur" }),
        };
      }
    } else {
      userId = authUser.user?.id;
    }

    // Lier l'achat à l'utilisateur
    if (userId) {
      await supabase
        .from("purchases")
        .update({ user_id: userId, used_at: new Date().toISOString() })
        .eq("id", purchase.id);
    }
  }

  if (!userId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Impossible de créer le compte" }),
    };
  }

  // ── 5. Générer un lien de connexion magique ──
  const { data: magicLink, error: magicError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo: `${process.env.VITE_APP_URL ?? "https://lumina.miely.fr"}/app`,
      },
    });

  if (magicError || !magicLink) {
    console.error("[verify-access] Erreur magic link:", magicError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur génération de session" }),
    };
  }

  // ── 6. Réponse : on retourne le lien de connexion ──
  // Le frontend redirige l'utilisateur vers ce lien
  // Supabase échange le token automatiquement et crée la session
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      isFirstAccess: !purchase.used_at,
      magicLink: magicLink.properties?.action_link,
    }),
  };
};
