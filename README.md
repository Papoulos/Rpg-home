# Application Web JDR (RPG Web Application)

Cette application web est conçue pour jouer à des jeux de rôle (JDR) sur table en ligne avec vos amis. Elle fournit un ensemble d'outils interactifs pour faciliter les parties à distance, construite avec un backend Node.js et un frontend en JavaScript vanilla.

## Installation

Ces instructions vous permettront d'obtenir une copie du projet et de le faire tourner sur votre machine locale ou de le déployer.

### Prérequis

Vous devez avoir [Node.js](https://nodejs.org/) et [npm](https://www.npmjs.com/) installés sur votre machine.

Si vous prévoyez d'utiliser Docker, assurez-vous d'avoir [Docker](https://www.docker.com/) installé.

1.  **Cloner le dépôt** (ou téléchargez-le) et placez-vous dans le répertoire du projet.

2.  **Installer les dépendances**
    ```sh
    npm install
    ```
    *Note: Si vous rencontrez des problèmes lors de l'installation de dépendances liées aux images (comme `canvas`), assurez-vous d'installer les bibliothèques système requises (ex. `sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev` sous Debian/Ubuntu).*

### Configuration (Optionnelle)

Vous pouvez configurer des clés d'API (pour le chatbot par exemple) en créant un fichier `apikeys.js` à la racine (non suivi par Git) ou en utilisant des variables d'environnement (ex: `APIKEY_GEMINI`).

## Lancement

### Lancement Local (Standard)

Depuis le répertoire racine du projet, lancez la commande suivante :
```sh
node server.js
```
Le serveur démarrera en mode HTTPS par défaut (en utilisant des certificats auto-signés).
Ouvrez votre navigateur web et naviguez vers `https://localhost:3000`. Vous devrez accepter l'avertissement de sécurité de votre navigateur lié au certificat auto-signé.

### Lancement sans SSL (HTTP)

Si vous exécutez cette application derrière un reverse proxy qui fournit déjà le SSL (comme GitHub Codespaces, Gitpod, ou Nginx en production), utilisez l'indicateur `--nossl` :
```sh
node server.js --nossl
```
Le serveur démarrera en mode HTTP et devrait être accessible via l'URL sécurisée de votre proxy.

### Déploiement avec Docker (Cloud Run, etc.)

Le projet contient un `Dockerfile` prêt à l'emploi.

1.  **Construire l'image Docker :**
    ```sh
    docker build -t rpg-web-app .
    ```
2.  **Lancer le conteneur :**
    ```sh
    docker run -p 3000:3000 rpg-web-app
    ```
Le `Dockerfile` est configuré pour lancer l'application en mode `--nossl`, idéal pour les environnements managés (Google Cloud Run, Heroku, etc.).

## Fonctionnalités

L'application est construite autour d'une interface modulaire conçue pour une session de JDR typique, avec une barre de menu permettant de naviguer entre différentes vues centrales (Carte, PJ, Prez, etc.).

### 1. Tableau Blanc Collaboratif (Carte)
La vue principale permet d'afficher et de dessiner sur une carte commune, propulsée par **Fabric.js** et synchronisée via **WebSockets**.
- **Dessin Libre et Formes** : Tracez des lignes, des rectangles, des cercles, ou dessinez librement en choisissant votre couleur.
- **Pointeur partagé** : Affichez un pointeur visible par tous les joueurs pour montrer des éléments spécifiques sur la carte.
- **Brouillard de Guerre (Fog of War)** : Le Maître du Jeu (MJ) peut activer un brouillard masquant la carte pour les joueurs, puis utiliser une gomme spéciale pour révéler dynamiquement des zones.
- **Ajout d'Images et de Fonds** : Insérez des images comme jetons (tokens) ou définissez l'arrière-plan de la carte. Tout est synchronisé en temps réel sans scintillement.

### 2. Fiches de Personnages (PJ)
Ce module permet d'afficher et de gérer les fiches de personnages des joueurs directement dans l'application.
- **Intégration Google Sheets** : Les fiches sont de simples documents Google Sheets. Vous entrez l'URL publique de la fiche, et elle s'affiche sous forme d'iframe (l'URL est automatiquement formatée).
- **Synchronisation Globale** : La liste des fiches disponibles est partagée et sauvegardée sur le serveur. Lorsqu'une fiche est ajoutée ou supprimée, la liste se met à jour pour tous les joueurs.

### 3. Chat Interactif et Lancer de Dés
La colonne de gauche (rétractable) contient le chat temps réel.
- **Communication Directe** : Messages instantanés entre tous les utilisateurs connectés.
- **Couleurs par Utilisateur** : Chaque joueur se voit attribuer une couleur pour une meilleure lisibilité.
- **Historique Persistant** : L'historique du chat est sauvegardé sur le serveur, permettant aux joueurs se connectant en retard de lire ce qui s'est dit.
- **Roller de Dés Intégré** : Des boutons permettent de lancer des dés standards (d4, d6, d10, d20, d100). Les résultats critiques (1 ou max) sont mis en évidence.
- **Commandes de Système de Jeu** : Des commandes intégrées permettent de lancer des dés avec des règles spécifiques (ex: `/cypher` ou `/c` avec paramètres d'effort et de difficulté).

### 4. Visioconférence
La colonne de droite (rétractable) abrite un système de vidéo-chat P2P.
- **Technologie WebRTC** : Connexions directes entre les pairs pour une faible latence, gérées avec `webrtc-adapter`.
- **Contrôles Locaux** : Possibilité de couper son propre microphone ou sa caméra.
- **Détection Automatique** : Ajustement automatique en cas de déconnexions.

### 5. Lecteur de Musique Ambiante
Un lecteur audio contrôlé par le MJ et synchronisé avec tous les joueurs.
- **Basé sur l'API YouTube Iframe** : Le MJ ajoute des URLs de vidéos YouTube pour construire une playlist.
- **Contrôle Global** : Le MJ lance la musique, change de piste ou met en pause, et la lecture se synchronise instantanément sur les navigateurs de tous les joueurs.
- **Gestion Avancée** : Réorganisation de la playlist (glisser-déposer), mode boucle (loop) et ajustement individuel du volume pour chaque joueur.

### 6. Wiki Intégré
Un module complet pour la prise de notes ou la documentation de la campagne.
- **Format Markdown** : Les pages sont écrites en Markdown avec l'éditeur EasyMDE. L'affichage est assuré par Showdown.js.
- **Organisation Hierarchique** : Les pages peuvent être organisées en dossiers virtuels (en utilisant des `/` dans les titres).
- **Sections MJ vs Publics** : Le MJ dispose d'un espace privé pour ses notes et ses pages cachées, distinct des pages publiques visibles par tous.

### 7. Gestionnaire d'Images (Prez)
Une galerie rapide pour partager des aides de jeu.
- Le MJ (ou un joueur disposant des droits) peut ajouter des images via leur URL web.
- La liste est synchronisée. Les images sélectionnées s'affichent au centre de l'écran ou de manière superposée pour illustrer l'action.

### 8. Chatbot IA (Optionnel)
Le chat intègre des commandes pour invoquer un assistant IA configuré par le MJ.
- **Personnalisable** : Compatible avec OpenAI, Mistral, Gemini, ou d'autres endpoints compatibles configurables via `api.config.js` et les clés API sécurisées.

