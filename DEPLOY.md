# LUMINA — Guide de déploiement complet

## Vue d'ensemble

```
Acheteur Gumroad → Webhook → Netlify Function → Supabase DB + Resend Email
     ↓
Acheteur reçoit email avec clé d'accès
     ↓
/acces → email + clé → Netlify Function → Magic Link Supabase → Session Auth
     ↓
Questionnaire (auto-save Supabase)
     ↓
Génération → Claude API → JSON → Résultats
     ↓
PDF Server-side → Supabase Storage → Resend Email
```

---

## 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter `supabase/schema.sql` en entier
3. Récupérer dans **Settings > API** :
   - `Project URL` → `VITE_SUPABASE_URL` et `SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

4. Dans **Authentication > URL Configuration** :
   - Site URL : `https://lumina.miely.fr`
   - Redirect URLs : `https://lumina.miely.fr/app`

---

## 2. Gumroad

1. Aller sur [app.gumroad.com/settings/advanced](https://app.gumroad.com/settings/advanced)
2. Créer une **Application OAuth** → récupérer l'**Access Token** → `GUMROAD_ACCESS_TOKEN`
3. Dans **Webhooks** (sur la page produit LUMINA) :
   - URL : `https://lumina.miely.fr/.netlify/functions/gumroad-webhook`
   - Choisir un secret → `GUMROAD_WEBHOOK_SECRET`
4. L'ID produit est `lumina` (visible dans l'URL gumroad.com/l/lumina) → `GUMROAD_PRODUCT_ID=lumina`

---

## 3. Resend

1. Créer un compte sur [resend.com](https://resend.com)
2. Vérifier le domaine `miely.fr` (ajouter les enregistrements DNS dans votre hébergeur)
3. Créer une clé API → `RESEND_API_KEY`
4. `RESEND_FROM_EMAIL=lumina@miely.fr`

---

## 4. Anthropic

1. Aller sur [console.anthropic.com](https://console.anthropic.com)
2. Créer une clé API → `ANTHROPIC_API_KEY`
3. Modèle recommandé : `claude-opus-4-5` (meilleure qualité) ou `claude-sonnet-4-5` (plus rapide)

---

## 5. Netlify

1. Créer un compte sur [netlify.com](https://netlify.com)
2. **Add new site > Import from Git** → connecter GitHub → sélectionner `lumina-app`
3. Build settings (normalement auto-détectés depuis `netlify.toml`) :
   - Build command : `npm run build`
   - Publish directory : `dist`
   - Functions directory : `netlify/functions`

4. **Site settings > Environment variables** — ajouter TOUTES les variables de `.env.example` :
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_URL
   GUMROAD_ACCESS_TOKEN
   GUMROAD_WEBHOOK_SECRET
   GUMROAD_PRODUCT_ID=lumina
   RESEND_API_KEY
   RESEND_FROM_EMAIL=lumina@miely.fr
   RESEND_FROM_NAME=Lumina by MIELY
   ANTHROPIC_API_KEY
   ANTHROPIC_MODEL=claude-opus-4-5
   ADMIN_EMAIL=naomi.kpoviessi@gmail.com
   VITE_APP_URL=https://lumina.miely.fr
   JWT_SECRET=<généré avec: openssl rand -hex 32>
   ```

5. **Domain management** : ajouter `lumina.miely.fr` et configurer le DNS chez votre hébergeur

---

## 6. GitHub

```bash
cd lumina-app
git init
git add .
git commit -m "Initial commit — LUMINA app"
git remote add origin https://github.com/VOTRE_COMPTE/lumina-app.git
git push -u origin main
```

Netlify déploiera automatiquement à chaque push.

---

## 7. Test de bout en bout

1. **Tester le webhook** : Gumroad propose un test dans les settings webhook
   - Vérifier dans Supabase Table Editor > `purchases` qu'une ligne apparaît
   - Vérifier que vous recevez l'email avec la clé

2. **Tester l'accès** : aller sur `lumina.miely.fr/acces`
   - Email d'achat + clé reçue → doit rediriger vers `/app`

3. **Tester le questionnaire** : remplir les 6 sections
   - Vérifier dans Supabase > `questionnaire_responses` que les données sont sauvegardées

4. **Tester la génération** : cliquer "Générer mon analyse"
   - Vérifier dans Supabase > `analyses` que status passe à `complete`
   - Vérifier que l'email avec PDF arrive

---

## URLs importantes

| Fonction | URL |
|----------|-----|
| Landing page | https://miely.fr (ou votre domaine) |
| Accès acheteurs | https://lumina.miely.fr/acces |
| Interface admin | https://lumina.miely.fr/admin |
| Webhook Gumroad | https://lumina.miely.fr/.netlify/functions/gumroad-webhook |
| Gumroad produit | https://miely.gumroad.com/l/lumina |

---

## Sécurité — Points clés

- ✅ Aucune clé API dans le frontend
- ✅ Vérification d'achat 100% côté serveur
- ✅ Clé d'accès hachée en base (SHA-256)
- ✅ RLS activé sur toutes les tables Supabase
- ✅ Chaque utilisateur ne voit que ses propres données
- ✅ Admin accessible uniquement à naomi.kpoviessi@gmail.com

---

## Dépannage

**Le webhook Gumroad ne fonctionne pas ?**
→ Vérifier que `GUMROAD_WEBHOOK_SECRET` correspond au secret configuré dans Gumroad
→ Vérifier les logs Netlify Functions dans le dashboard Netlify

**L'email avec la clé n'arrive pas ?**
→ Vérifier que le domaine `miely.fr` est vérifié dans Resend
→ Vérifier les logs Resend

**La génération d'analyse échoue ?**
→ Vérifier que `ANTHROPIC_API_KEY` est valide
→ Vérifier que les données du questionnaire + profil sacré existent en base
