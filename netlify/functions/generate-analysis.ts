/**
 * LUMINA ENGINE — Génération de l'analyse IA
 * Reçoit l'ID utilisateur authentifié → récupère questionnaire + profil sacré
 * → appelle Claude API → stocke le résultat JSON → déclenche la génération PDF
 *
 * SÉCURITÉ : l'utilisateur doit être authentifié via le token Supabase.
 * Aucune clé API n'est exposée au frontend.
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Auth middleware ─────────────────────────────────────────────────────────

async function getUserFromToken(
  authHeader: string | undefined,
  supabaseUrl: string,
  anonKey: string
): Promise<{ id: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];

  const supabase = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email! };
}

// ─── LUMINA ENGINE Prompt ────────────────────────────────────────────────────

function buildLuminaPrompt(
  questionnaire: Record<string, unknown>,
  sacredProfile: Record<string, unknown>
): string {
  return `Tu es LUMINA ENGINE, un oracle analytique de précision au service du développement personnel intégré.

Tu reçois les données complètes d'une personne et tu génères une analyse structurée, profonde et actionnable.

## DONNÉES REÇUES

### Profil Sacré (calculé de manière déterministe)
${JSON.stringify(sacredProfile, null, 2)}

### Réponses au Questionnaire
${JSON.stringify(questionnaire, null, 2)}

## MISSION

Génère une analyse complète en JSON strictement valide selon cette structure :

{
  "profil": {
    "essence": "Une phrase qui capture l'essence profonde de la personne",
    "forces_cardinales": ["force1", "force2", "force3"],
    "zones_ombre": ["zone1", "zone2"],
    "signature_energetique": "Description de l'énergie naturelle de la personne"
  },
  "synthese": {
    "titre": "Titre poétique et personnalisé de l'analyse",
    "texte_principal": "Analyse narrative de 300-400 mots, profonde et personnalisée",
    "message_cle": "Message central court et percutant (1-2 phrases)"
  },
  "organisation": {
    "style_naturel": "Description du style d'organisation naturel selon son profil",
    "defis_principaux": ["défi1", "défi2", "défi3"],
    "systeme_recommande": "Système d'organisation adapté à son énergie",
    "rituels_matinaux": ["rituel1", "rituel2", "rituel3"],
    "rituels_soir": ["rituel1", "rituel2"],
    "structure_semaine": "Structure hebdomadaire recommandée narrative",
    "outils_cles": ["outil1", "outil2", "outil3"]
  },
  "productivite": {
    "energie_chronotype": "Description de son chronotype et pic d'énergie",
    "mode_travail_optimal": "Description du mode de travail qui lui correspond",
    "techniques_recommandees": [
      {
        "nom": "Nom de la technique",
        "description": "Comment l'appliquer concrètement",
        "pourquoi": "Pourquoi cette technique lui correspond"
      }
    ],
    "pieges_a_eviter": ["piège1", "piège2"],
    "environnement_ideal": "Description de son environnement de travail idéal"
  },
  "systeme_3_mois": {
    "vision_globale": "Vision narrative du parcours sur 3 mois",
    "mois_1": {
      "theme": "Thème du mois 1",
      "focus": "Focus principal",
      "objectifs": ["objectif1", "objectif2", "objectif3"],
      "actions_semaine_1": ["action1", "action2", "action3"],
      "actions_semaine_2": ["action1", "action2"],
      "actions_semaine_3": ["action1", "action2"],
      "actions_semaine_4": ["action1", "action2"],
      "indicateurs": ["indicateur1", "indicateur2"]
    },
    "mois_2": {
      "theme": "Thème du mois 2",
      "focus": "Focus principal",
      "objectifs": ["objectif1", "objectif2", "objectif3"],
      "evolution": "Comment les pratiques évoluent depuis le mois 1",
      "indicateurs": ["indicateur1", "indicateur2"]
    },
    "mois_3": {
      "theme": "Thème du mois 3",
      "focus": "Focus principal",
      "objectifs": ["objectif1", "objectif2", "objectif3"],
      "integration": "Comment tout s'intègre pour créer un système durable",
      "indicateurs": ["indicateur1", "indicateur2"]
    },
    "checkpoint_mensuel": "Description du processus de révision mensuelle recommandé"
  },
  "priorites": [
    {
      "rang": 1,
      "domaine": "Domaine (ex: Travail, Santé, Relations...)",
      "titre": "Titre court",
      "description": "Description de cette priorité et pourquoi elle est première",
      "premiere_action": "Action concrète à faire dans les 48h"
    }
  ],
  "actions": [
    {
      "titre": "Titre de l'action",
      "categorie": "immediat | court_terme | moyen_terme",
      "description": "Description détaillée",
      "impact": "Impact attendu",
      "difficulte": "facile | moyen | challenge"
    }
  ],
  "recommandations": [
    {
      "type": "pratique | outil | lecture | habitude",
      "titre": "Titre",
      "description": "Pourquoi et comment",
      "urgence": "maintenant | cette_semaine | ce_mois"
    }
  ],
  "message_lumina": "Message personnel, chaleureux et encourageant de LUMINA à la personne. Utilise son prénom. 100-150 mots."
}

## INSTRUCTIONS ESSENTIELLES

1. Utilise le prénom de la personne (depuis le questionnaire) dans l'analyse
2. Croise TOUJOURS les données astrologiques, Human Design ET numérologie pour personnaliser chaque section
3. Les recommandations doivent être CONCRÈTES, pas génériques
4. Le ton est : profond, bienveillant, précis, jamais moralisateur
5. Évite les platitudes — chaque phrase doit apporter de la valeur
6. Le système 3 mois doit respecter l'énergie et le rythme naturel de la personne
7. Génère UNIQUEMENT le JSON, sans texte avant ou après`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ── 1. Authentification ──
  const user = await getUserFromToken(
    event.headers.authorization,
    process.env.SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Non authentifié" }),
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 2. Vérifier l'achat actif ──
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!purchase) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Aucun achat actif trouvé" }),
    };
  }

  // ── 3. Vérifier qu'une analyse n'est pas déjà en cours ──
  const { data: existing } = await supabase
    .from("analyses")
    .select("id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing?.status === "generating") {
    return {
      statusCode: 409,
      body: JSON.stringify({
        error: "Analyse déjà en cours",
        analysisId: existing.id,
      }),
    };
  }

  if (existing?.status === "complete") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId: existing.id,
        cached: true,
      }),
    };
  }

  // ── 4. Récupérer les données nécessaires ──
  const [questionnaireRes, sacredProfileRes] = await Promise.all([
    supabase
      .from("questionnaire_responses")
      .select("section, data")
      .eq("user_id", user.id),
    supabase
      .from("sacred_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!sacredProfileRes.data) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Profil sacré manquant. Complétez le questionnaire.",
      }),
    };
  }

  // Assembler les réponses du questionnaire
  const questionnaireData: Record<string, unknown> = {};
  for (const row of questionnaireRes.data ?? []) {
    questionnaireData[row.section] = row.data;
  }

  // ── 5. Créer l'entrée analyse en base ──
  const { data: analysis, error: createError } = await supabase
    .from("analyses")
    .insert({
      user_id: user.id,
      status: "generating",
    })
    .select("id")
    .single();

  if (createError || !analysis) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur création analyse" }),
    };
  }

  const analysisId = analysis.id;

  // ── 6. Appel LUMINA ENGINE (Claude API) ──
  const startTime = Date.now();

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const prompt = buildLuminaPrompt(
      questionnaireData,
      sacredProfileRes.data
    );

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const generationTime = Date.now() - startTime;
    const rawContent = response.content[0];

    if (rawContent.type !== "text") {
      throw new Error("Réponse IA inattendue");
    }

    // Parser le JSON de la réponse
    let result: Record<string, unknown>;
    try {
      // Extraire le JSON même si Claude a ajouté du texte autour
      const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Pas de JSON dans la réponse");
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      throw new Error(`Parsing JSON échoué: ${parseError}`);
    }

    // ── 7. Sauvegarder le résultat ──
    await supabase
      .from("analyses")
      .update({
        status: "complete",
        result,
        ai_model: response.model,
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        generation_time_ms: generationTime,
      })
      .eq("id", analysisId);

    // ── 8. Déclencher la génération PDF (async) ──
    // On ne bloque pas la réponse pour ça
    fetch(
      `${process.env.VITE_APP_URL ?? "https://lumina.miely.fr"}/.netlify/functions/generate-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: event.headers.authorization ?? "",
        },
        body: JSON.stringify({ analysisId }),
      }
    ).catch((err) => console.error("[generate-analysis] PDF trigger error:", err));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        analysisId,
        generationTimeMs: generationTime,
      }),
    };
  } catch (err) {
    console.error("[generate-analysis] Erreur:", err);

    await supabase
      .from("analyses")
      .update({
        status: "error",
        error_message: err instanceof Error ? err.message : "Erreur inconnue",
      })
      .eq("id", analysisId);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur génération analyse" }),
    };
  }
};
