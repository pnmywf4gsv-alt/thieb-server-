# Rentabilité Thieb — serveur partagé avec base de données

## Ce que ça fait
- Une page web (le calculateur) que toute l'équipe ouvre avec le même lien.
- Les lots sont stockés dans une vraie base PostgreSQL — plus de perte de
  données lors des redéploiements.
- Protection par un code PIN partagé (`TEAM_PIN`) pour consulter et ajouter
  des lots.
- Un code PIN admin séparé (`ADMIN_PIN`) pour modifier ou supprimer un lot
  déjà enregistré — le reste de l'équipe ne peut ni l'un ni l'autre.
- Chaque lot de l'historique est cliquable et affiche le détail complet des
  chiffres (coûts, marge, seuil de rentabilité, invendus…).

## Déployer sur Render.com (recommandé, gratuit pour démarrer)

1. Crée un compte sur https://render.com
2. Mets ce dossier sur GitHub (crée un repo, pousse ces fichiers dedans).
   Si tu ne sais pas faire, dis-le-moi, je te guide pas à pas.
3. **Crée d'abord la base** : sur Render → **New +** → **PostgreSQL**.
   - Donne-lui un nom (ex. `thieb-db`), plan **Free**.
   - Une fois créée, copie la valeur **Internal Database URL**.
4. **Crée le service web** : **New +** → **Web Service** → connecte ton repo.
   - Build command : `npm install`
   - Start command : `npm start`
5. Dans l'onglet **Environment** du service web, ajoute **les trois** variables :
   - `DATABASE_URL` = l'URL copiée à l'étape 3
   - `TEAM_PIN` = le code que toute l'équipe utilisera pour ouvrir la page (ex. `4821`)
   - `ADMIN_PIN` = un code différent, connu uniquement de l'admin, pour modifier/supprimer un lot (ex. `9034`)

   ⚠️ Si `TEAM_PIN` n'est pas défini ici, le serveur laisse passer tout le
   monde même sans code — c'est ce qui se passait avant. Vérifie bien que la
   variable est enregistrée et que le service a redémarré après l'ajout.
   Même chose pour `ADMIN_PIN` : sans lui, personne ne peut modifier ou
   supprimer un lot, même toi.
6. **Create Web Service**. Au premier lancement, le serveur crée automatiquement
   la table dans la base. Au bout de 2-3 minutes tu as ton URL, ex.
   `https://thieb-server.onrender.com` — c'est le lien à partager.

Note plan gratuit Render : la base gratuite expire au bout de 90 jours (il
faudra la recréer ou passer sur un plan payant ~7$/mois pour la garder
indéfiniment). Le web service gratuit se met en veille après 15 min
d'inactivité et redémarre en ~30s au prochain accès — sans perte de données
cette fois, puisqu'elles sont dans la base et non plus dans un fichier.

## Utiliser le mode admin

Sur la page, en haut à droite, il y a un bouton **Mode admin**. En cliquant
dessus, un petit panneau demande le code `ADMIN_PIN`. Une fois validé :
- des icônes ✎ (modifier) et ✕ (supprimer) apparaissent sur chaque lot de
  l'historique ;
- cliquer sur ✎ recharge le formulaire du haut avec les valeurs du lot pour
  les corriger, puis "Mettre à jour ce lot" enregistre la modification ;
- le code admin reste mémorisé sur l'appareil jusqu'à ce qu'on désactive le
  mode admin (même bouton) ou qu'on efface les données du site.

Sans mode admin activé, tout le monde peut toujours consulter le détail
complet de chaque lot (clic sur le lot pour dérouler) et en ajouter de
nouveaux — mais pas modifier ni supprimer ceux déjà enregistrés.

## Déployer sur Railway.app (alternative)

1. Compte sur https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Dans le même projet, clique **New** → **Database** → **PostgreSQL**.
   Railway relie automatiquement `DATABASE_URL` à ton service.
4. Dans les **Variables** du service web, ajoute `TEAM_PIN` et `ADMIN_PIN`.
5. Railway te donne une URL publique dans **Settings** → **Domains**.

## Tester en local avant de déployer

Il faut un Postgres local ou distant. Le plus simple : crée une base
gratuite sur https://neon.tech ou https://supabase.com, récupère son URL de
connexion, puis :

```bash
npm install
DATABASE_URL="postgresql://..." TEAM_PIN=4821 ADMIN_PIN=9034 npm start
```

Puis ouvre http://localhost:3000 dans ton navigateur.
