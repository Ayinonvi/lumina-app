/**
 * Appels API vers les Netlify Functions
 * Toutes les vérifications sensibles passent par le backend.
 */

import { supabase } from "./supabase";

/** Récupère le token de session Supabase pour les appels authentifiés */
async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ── Vérification clé d'accès ─────────────────────────────────────────────────

export async function verifyAccessKey(
  email: string,
  accessKey: string
): Promise<{ magicLink: string; isFirstAccess: boolean }> {
  const res = await fetch("/api/verify-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, accessKey }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Vérification échouée");
  }

  return res.json();
}

// ── Sauvegarde questionnaire ─────────────────────────────────────────────────

export async function saveQuestionnaireSection(
  section: string,
  data: Record<string, unknown>,
  isComplete = false
): Promise<void> {
  const { error } = await supabase
    .from("questionnaire_responses")
    .upsert(
      {
        user_id: (await supabase.auth.getUser()).data.user?.id,
        section,
        data,
        is_complete: isComplete,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,section" }
    );

  if (error) throw new Error(error.message);
}

export async function getQuestionnaireResponses(): Promise<
  Record<string, unknown>
> {
  const { data, error } = await supabase
    .from("questionnaire_responses")
    .select("section, data, is_complete");

  if (error) throw new Error(error.message);

  const result: Record<string, unknown> = {};
  for (const row of data ?? []) {
    result[row.section] = row.data;
  }
  return result;
}

// ── Génération analyse ───────────────────────────────────────────────────────

export async function generateAnalysis(): Promise<{
  analysisId: string;
  cached?: boolean;
}> {
  const headers = await getAuthHeader();
  const res = await fetch("/api/generate-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Erreur génération");
  }

  return res.json();
}

// ── Récupération analyse ─────────────────────────────────────────────────────

export async function getAnalysis(analysisId?: string): Promise<{
  id: string;
  status: string;
  result: Record<string, unknown> | null;
  pdf_url: string | null;
  email_sent: boolean;
} | null> {
  let query = supabase
    .from("analyses")
    .select("id, status, result, pdf_url, email_sent")
    .order("created_at", { ascending: false })
    .limit(1);

  if (analysisId) {
    query = supabase
      .from("analyses")
      .select("id, status, result, pdf_url, email_sent")
      .eq("id", analysisId)
      .limit(1);
  }

const { data, error } = await query.single();  if (error) return null;
  return data;
}

// ── Profil sacré ─────────────────────────────────────────────────────────────

export async function saveSacredProfile(
  profileData: Record<string, unknown>
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Non authentifié");

  const { error } = await supabase
    .from("sacred_profiles")
    .upsert({ ...profileData, user_id: userId }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}
