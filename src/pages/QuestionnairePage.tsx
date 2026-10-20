/**
 * Questionnaire central multi-étapes avec sauvegarde automatique.
 * Collecte les données nécessaires pour l'analyse LUMINA ENGINE.
 * Calcule la numérologie côté client (déterministe, pas de secrets).
 */

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { saveQuestionnaireSection, saveSacredProfile, generateAnalysis, getQuestionnaireResponses } from "../lib/api";
import { calculateNumerology } from "../lib/numerology";
import { supabase } from "../lib/supabase";

interface Props {
  session: Session;
}

// ── Sections du questionnaire ────────────────────────────────────────────────

const SECTIONS = [
  "identite",
  "naissance",
  "vie_actuelle",
  "organisation",
  "defis",
  "aspirations",
  "recap",
] as const;

type Section = (typeof SECTIONS)[number];

// ── Styles communs ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0a14",
    color: "#e8e0d4",
    fontFamily: "'DM Sans', sans-serif",
    padding: "24px",
  } as React.CSSProperties,

  container: {
    maxWidth: "680px",
    margin: "0 auto",
  } as React.CSSProperties,

  card: {
    background: "#141420",
    border: "1px solid #2a2840",
    borderRadius: "16px",
    padding: "40px",
    marginBottom: "24px",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    color: "#8a7f72",
    marginBottom: "8px",
  } as React.CSSProperties,

  input: {
    width: "100%",
    background: "#0a0a14",
    border: "1px solid #2a2840",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#e8e0d4",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    background: "#0a0a14",
    border: "1px solid #2a2840",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#e8e0d4",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "'DM Sans', sans-serif",
    resize: "vertical" as const,
    minHeight: "100px",
  } as React.CSSProperties,

  btn: {
    background: "#c9a96e",
    color: "#0a0a14",
    border: "none",
    borderRadius: "8px",
    padding: "14px 32px",
    fontSize: "13px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    fontWeight: 500,
  } as React.CSSProperties,

  btnSecondary: {
    background: "transparent",
    color: "#8a7f72",
    border: "1px solid #2a2840",
    borderRadius: "8px",
    padding: "14px 32px",
    fontSize: "13px",
    letterSpacing: "1px",
    cursor: "pointer",
  } as React.CSSProperties,
};

// ── Composant principal ───────────────────────────────────────────────────────

export default function QuestionnairePage({ session }: Props) {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState<Section>("identite");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Données des sections
  const [identite, setIdentite] = useState({
    prenom: "",
    nom: "",
    email: session.user.email ?? "",
  });

  const [naissance, setNaissance] = useState({
    date_naissance: "",
    heure_naissance: "",
    ville_naissance: "",
    pays_naissance: "France",
  });

  const [vieActuelle, setVieActuelle] = useState({
    situation_pro: "",
    situation_perso: "",
    domicile: "",
    rythme_vie: "",
  });

  const [organisation, setOrganisation] = useState({
    style_actuel: "",
    outils_actuels: "",
    difficultes: "",
    ce_qui_marche: "",
  });

  const [defis, setDefis] = useState({
    defi_principal: "",
    blocages: "",
    energie_naturelle: "",
    chronotype: "",
  });

  const [aspirations, setAspirations] = useState({
    objectif_3_mois: "",
    vision_ideale: "",
    valeurs_importantes: "",
    message_a_soi: "",
  });

  // ── Chargement des réponses existantes ────────────────────────────────────

  useEffect(() => {
    getQuestionnaireResponses().then((responses) => {
      if (responses.identite)
        setIdentite(responses.identite as typeof identite);
      if (responses.naissance)
        setNaissance(responses.naissance as typeof naissance);
      if (responses.vie_actuelle)
        setVieActuelle(responses.vie_actuelle as typeof vieActuelle);
      if (responses.organisation)
        setOrganisation(responses.organisation as typeof organisation);
      if (responses.defis) setDefis(responses.defis as typeof defis);
      if (responses.aspirations)
        setAspirations(responses.aspirations as typeof aspirations);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // ── Auto-save ────────────────────────────────────────────────────────────

  const autoSave = useCallback(
    async (section: Section, data: Record<string, unknown>) => {
      setSaving(true);
      try {
        await saveQuestionnaireSection(section, data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error("Auto-save error:", e);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  const sectionIndex = SECTIONS.indexOf(currentSection);

  async function goNext() {
    // Sauvegarder la section actuelle
    const sectionData = getSectionData(currentSection);
    await autoSave(currentSection, sectionData);

    if (currentSection === "naissance" && identite.prenom && naissance.date_naissance) {
      // Calcul numérologie + sauvegarde profil sacré
      const fullName = `${identite.prenom} ${identite.nom}`.trim();
      const numerology = calculateNumerology(fullName, naissance.date_naissance);
      await saveSacredProfile({
        full_name: fullName,
        birth_date: naissance.date_naissance,
        birth_time: naissance.heure_naissance || null,
        birth_city: naissance.ville_naissance,
        birth_country: naissance.pays_naissance,
        numerology,
      });
    }

    const nextSection = SECTIONS[sectionIndex + 1];
    if (nextSection) setCurrentSection(nextSection);
  }

  async function goPrev() {
    const prevSection = SECTIONS[sectionIndex - 1];
    if (prevSection) setCurrentSection(prevSection);
  }

  function getSectionData(section: Section): Record<string, unknown> {
    switch (section) {
      case "identite": return identite;
      case "naissance": return naissance;
      case "vie_actuelle": return vieActuelle;
      case "organisation": return organisation;
      case "defis": return defis;
      case "aspirations": return aspirations;
      default: return {};
    }
  }

  // ── Génération de l'analyse ────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { analysisId } = await generateAnalysis();
      navigate(`/app/resultats/${analysisId}`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Erreur lors de la génération"
      );
      setGenerating(false);
    }
  }

  if (!loaded) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e" }}>
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px", paddingTop: "24px" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", letterSpacing: "6px" }}>
            LUMINA
          </div>
          <div style={{ fontSize: "12px", color: "#8a7f72", marginTop: "4px" }}>
            Questionnaire central
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: "#8a7f72" }}>
              Étape {sectionIndex + 1} / {SECTIONS.length}
            </span>
            {saving && (
              <span style={{ fontSize: "12px", color: "#8a7f72" }}>Sauvegarde…</span>
            )}
            {saved && !saving && (
              <span style={{ fontSize: "12px", color: "#7a9e7a" }}>✓ Sauvegardé</span>
            )}
          </div>
          <div style={{ height: "2px", background: "#2a2840", borderRadius: "2px" }}>
            <div
              style={{
                height: "100%",
                background: "#c9a96e",
                borderRadius: "2px",
                width: `${((sectionIndex + 1) / SECTIONS.length) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Section : Identité */}
        {currentSection === "identite" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Qui êtes-vous ?
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Ces informations permettront de personnaliser toute votre analyse.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={S.label}>Prénom *</label>
                <input
                  style={S.input}
                  value={identite.prenom}
                  onChange={(e) => setIdentite({ ...identite, prenom: e.target.value })}
                  placeholder="Votre prénom"
                  required
                />
              </div>
              <div>
                <label style={S.label}>Nom</label>
                <input
                  style={S.input}
                  value={identite.nom}
                  onChange={(e) => setIdentite({ ...identite, nom: e.target.value })}
                  placeholder="Votre nom de naissance"
                />
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={S.label}>Email</label>
              <input
                style={{ ...S.input, color: "#8a7f72" }}
                value={identite.email}
                disabled
              />
            </div>
          </div>
        )}

        {/* Section : Naissance */}
        {currentSection === "naissance" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Votre carte du ciel
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Ces données permettent de calculer votre numérologie, votre thème
              astrologique et votre Human Design.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={S.label}>Date de naissance *</label>
                <input
                  style={S.input}
                  type="date"
                  value={naissance.date_naissance}
                  onChange={(e) => setNaissance({ ...naissance, date_naissance: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={S.label}>Heure de naissance</label>
                <input
                  style={S.input}
                  type="time"
                  value={naissance.heure_naissance}
                  onChange={(e) => setNaissance({ ...naissance, heure_naissance: e.target.value })}
                  placeholder="Si connue"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={S.label}>Ville de naissance *</label>
                <input
                  style={S.input}
                  value={naissance.ville_naissance}
                  onChange={(e) => setNaissance({ ...naissance, ville_naissance: e.target.value })}
                  placeholder="Paris, Lyon, Abidjan…"
                  required
                />
              </div>
              <div>
                <label style={S.label}>Pays</label>
                <input
                  style={S.input}
                  value={naissance.pays_naissance}
                  onChange={(e) => setNaissance({ ...naissance, pays_naissance: e.target.value })}
                  placeholder="France"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section : Vie actuelle */}
        {currentSection === "vie_actuelle" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Votre vie aujourd'hui
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Une photo honnête de votre situation actuelle — sans filtre.
            </p>

            {[
              { key: "situation_pro", label: "Situation professionnelle", placeholder: "Votre métier, secteur, statut (salarié, freelance, entrepreneur…)" },
              { key: "situation_perso", label: "Situation personnelle", placeholder: "Votre contexte de vie (famille, relationnel, contexte important…)" },
              { key: "domicile", label: "Environnement de travail habituel", placeholder: "Télétravail, bureau, café, maison…" },
              { key: "rythme_vie", label: "Décrivez votre rythme de vie en 3 mots", placeholder: "Ex : intense, créatif, chaotique…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: "20px" }}>
                <label style={S.label}>{label}</label>
                <textarea
                  style={S.textarea}
                  value={(vieActuelle as Record<string, string>)[key]}
                  onChange={(e) => setVieActuelle({ ...vieActuelle, [key]: e.target.value })}
                  placeholder={placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {/* Section : Organisation */}
        {currentSection === "organisation" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Votre organisation actuelle
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Soyez honnête — c'est la clé d'une recommandation pertinente.
            </p>

            {[
              { key: "style_actuel", label: "Comment vous organisez-vous aujourd'hui ?", placeholder: "To-do lists, calendrier, à vue, dans votre tête…" },
              { key: "outils_actuels", label: "Quels outils utilisez-vous (ou avez essayé) ?", placeholder: "Notion, Trello, agenda papier, Google Calendar, aucun…" },
              { key: "difficultes", label: "Qu'est-ce qui ne fonctionne pas ?", placeholder: "Je commence mais n'arrive pas à maintenir, je suis dispersée, je procrastine…" },
              { key: "ce_qui_marche", label: "Qu'est-ce qui a déjà fonctionné pour vous ?", placeholder: "Même brièvement, même partiellement…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: "20px" }}>
                <label style={S.label}>{label}</label>
                <textarea
                  style={S.textarea}
                  value={(organisation as Record<string, string>)[key]}
                  onChange={(e) => setOrganisation({ ...organisation, [key]: e.target.value })}
                  placeholder={placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {/* Section : Défis */}
        {currentSection === "defis" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Vos défis & votre énergie
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Pour adapter le système à votre rythme naturel.
            </p>

            {[
              { key: "defi_principal", label: "Quel est votre défi principal en ce moment ?", placeholder: "Ce qui vous pèse le plus, ce sur quoi vous tournez en rond…" },
              { key: "blocages", label: "Qu'est-ce qui vous bloque ou vous freine ?", placeholder: "Peur, manque de temps, trop d'idées, perfectionnisme…" },
              { key: "energie_naturelle", label: "Comment décririez-vous votre énergie naturelle ?", placeholder: "En vagues, constante, explosive au démarrage, en montée progressive…" },
              { key: "chronotype", label: "Vous êtes plutôt…", placeholder: "Lève-tôt & productif le matin / Noctambule & créatif le soir / Variable selon les jours" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: "20px" }}>
                <label style={S.label}>{label}</label>
                <textarea
                  style={S.textarea}
                  value={(defis as Record<string, string>)[key]}
                  onChange={(e) => setDefis({ ...defis, [key]: e.target.value })}
                  placeholder={placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {/* Section : Aspirations */}
        {currentSection === "aspirations" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Votre vision & vos aspirations
            </h2>
            <p style={{ color: "#8a7f72", fontSize: "13px", marginBottom: "32px", lineHeight: 1.6 }}>
              Où voulez-vous aller ? C'est ici que LUMINA puise pour créer votre système sur 3 mois.
            </p>

            {[
              { key: "objectif_3_mois", label: "Dans 3 mois, qu'est-ce que vous voulez avoir accompli ?", placeholder: "Soyez précise et concrète — un projet lancé, une habitude installée, un résultat mesurable…" },
              { key: "vision_ideale", label: "À quoi ressemble votre vie idéale organisée ?", placeholder: "Décrivez votre journée idéale, votre semaine rêvée…" },
              { key: "valeurs_importantes", label: "Quelles valeurs guident vos décisions ?", placeholder: "Liberté, famille, impact, créativité, connexion, excellence…" },
              { key: "message_a_soi", label: "Quel message aimeriez-vous vous envoyer à vous-même ?", placeholder: "Quelque chose que vous avez besoin d'entendre…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: "20px" }}>
                <label style={S.label}>{label}</label>
                <textarea
                  style={S.textarea}
                  value={(aspirations as Record<string, string>)[key]}
                  onChange={(e) => setAspirations({ ...aspirations, [key]: e.target.value })}
                  placeholder={placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
        )}

        {/* Section : Récapitulatif & génération */}
        {currentSection === "recap" && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", color: "#c9a96e", marginBottom: "8px" }}>
              Tout est prêt ✨
            </h2>
            <p style={{ color: "#b8b0a4", lineHeight: 1.8, marginBottom: "32px" }}>
              {identite.prenom}, votre questionnaire est complet. LUMINA ENGINE va maintenant
              analyser l'ensemble de vos données — profil sacré, organisation actuelle,
              défis et aspirations — pour créer votre analyse personnalisée et votre
              système sur 3 mois.
            </p>

            <div
              style={{
                background: "rgba(201,169,110,0.05)",
                border: "1px solid rgba(201,169,110,0.2)",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "32px",
              }}
            >
              <p style={{ color: "#c9a96e", fontSize: "13px", letterSpacing: "1px", marginBottom: "16px" }}>
                Ce que vous allez recevoir :
              </p>
              {[
                "Analyse de votre profil sacré (numérologie, astrologie, Human Design)",
                "Votre système d'organisation sur-mesure",
                "Votre plan de productivité adapté à votre énergie",
                "Un programme détaillé semaine par semaine sur 3 mois",
                "Vos priorités et actions concrètes",
                "Un PDF complet envoyé à " + session.user.email,
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: "12px", marginBottom: "10px", color: "#b8b0a4", fontSize: "13px" }}>
                  <span style={{ color: "#c9a96e" }}>✦</span>
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                ...S.btn,
                width: "100%",
                opacity: generating ? 0.7 : 1,
                cursor: generating ? "wait" : "pointer",
              }}
            >
              {generating ? "Génération en cours…" : "Générer mon analyse LUMINA"}
            </button>

            {generating && (
              <p style={{ textAlign: "center", color: "#8a7f72", fontSize: "12px", marginTop: "16px" }}>
                Cela peut prendre 30 à 60 secondes. Ne fermez pas cette page.
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          {sectionIndex > 0 && currentSection !== "recap" && (
            <button style={S.btnSecondary} onClick={goPrev}>
              ← Retour
            </button>
          )}
          <div style={{ flex: 1 }} />
          {currentSection !== "recap" && (
            <button style={S.btn} onClick={goNext}>
              {sectionIndex === SECTIONS.length - 2 ? "Voir le récapitulatif →" : "Continuer →"}
            </button>
          )}
        </div>

        {/* Déconnexion */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "none", color: "#4a4560", fontSize: "12px", cursor: "pointer" }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
