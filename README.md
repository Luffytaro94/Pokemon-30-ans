# 30th Anniversary Celebration — Masterset Tracker

Une web app statique (HTML/CSS/JS vanilla, sans framework ni build) pour suivre
votre progression de collection dans le set Pokémon TCG **30th Anniversary
Celebration**.

## Comment ça marche

Au chargement, `app.js` :

1. Interroge `GET https://api.pokemontcg.io/v2/sets` et cherche, parmi les
   sets retournés, celui dont le nom contient « 30th ».
2. Récupère ensuite toutes les cartes de ce set via
   `GET https://api.pokemontcg.io/v2/cards?q=set.id:<id>` (avec pagination
   automatique si le set dépasse 250 cartes).
3. Affiche les vraies cartes : nom, numéro, rareté et image officielle
   (`images.large`, avec repli sur `images.small`), telles que renvoyées par
   l'API — aucune carte ni donnée n'est inventée.

**Important :** ce set étant très récent, il se peut que la base de données
communautaire qui alimente l'API publique n'ait pas encore indexé le set au
moment où vous ouvrez l'app. Dans ce cas, l'app l'indique clairement plutôt
que d'afficher de fausses cartes, et propose un bouton « Réessayer ».

## Fonctionnalités

- Suivi OWNED / MISSING par carte, cliquable sur la grille ou en grand dans
  la fiche détaillée (modal).
- Sauvegarde automatique dans `localStorage` (seuls les identifiants des
  cartes possédées sont stockés) — la progression est conservée entre deux
  visites.
- Compteur global, pourcentage de complétion et barre de progression en
  temps réel.
- Recherche instantanée (nom, numéro, rareté).
- Filtres par statut (Toutes / Possédées / Manquantes) et par rareté
  (générés dynamiquement à partir des données réelles du set).
- Tri par numéro (croissant/décroissant) ou par nom (A→Z / Z→A).
- Bouton « Réinitialiser la collection » avec confirmation.
- Grille responsive (2 colonnes en mobile, jusqu'à 6 en grand écran),
  images en `loading="lazy"`.
- Modal accessible : fermeture via le bouton ✕, clic à l'extérieur, ou
  touche <kbd>Échap</kbd>.

## Structure du projet

```
/
├── index.html   → structure de la page
├── style.css    → design (thème clair, cartes arrondies, accents dorés)
├── app.js       → appels API, filtres, tri, persistance, modal
└── README.md
```

Aucune dépendance, aucun backend, aucune authentification : tout tourne
côté navigateur.

## Déployer sur GitHub Pages

1. Créez un nouveau dépôt GitHub et poussez-y ces 4 fichiers (à la racine).
2. Dans le dépôt : **Settings → Pages**.
3. Sous « Build and deployment », choisissez **Source: Deploy from a
   branch**, puis **Branch: main** (dossier `/root`), et cliquez sur
   **Save**.
4. Après 1 à 2 minutes, votre app est en ligne à l'adresse indiquée en haut
   de cette page (généralement
   `https://<votre-utilisateur>.github.io/<nom-du-dépôt>/`).

Aucune étape de build n'est nécessaire : ce sont des fichiers statiques.
