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

Vous pouvez configurer des clés d'API (pour le chatbot par exemple) de plusieurs manières :
- **Fichier `.env` (recommandé)** : Copiez `.env.example` en `.env` et ajoutez vos clés (ex: `APIKEY_GEMINI=votre_clé`).
- **Variables d'environnement** : Utilisez des variables préfixées par `APIKEY_` (ex: `APIKEY_GEMINI`).
- **Fichier `apikeys.js`** : Créez ce fichier à la racine (non suivi par Git) avec un `module.exports = { gemini: '...' }`.

> **Note** : Les placeholders dans `api.config.js` ont été supprimés. Utilisez uniquement les méthodes ci-dessus.

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

### Déploiement avec Docker Compose (Serveur Complet avec SSL et DynDNS)

Le projet propose une architecture Docker Compose à deux conteneurs, idéale pour héberger l'application sur une machine virtuelle (VPS) avec gestion automatique du SSL (Let's Encrypt) et mise à jour d'un nom de domaine dynamique (DynDNS) :
- Un conteneur pour l'application Node.js (tournant en mode sans SSL).
- Un conteneur proxy (Nginx) gérant les requêtes HTTPS, les certificats et les redirections vers l'application.

1.  **Configuration :**
    Copiez le fichier d'exemple et renseignez vos informations (domaine, email, et identifiants DynHost si applicable).
    ```sh
    cp .env.example .env
    nano .env
    ```

2.  **Lancement :**
    Démarrez les deux conteneurs en arrière-plan. Le conteneur proxy s'occupera d'obtenir automatiquement le certificat SSL au premier lancement.
    ```sh
    docker-compose up -d --build
    ```

*Note : Le fichier `docker-proxy/entrypoint.sh` contient la logique de démarrage du proxy (Nginx, Certbot, DynDNS) et peut être consulté à titre d'exemple de script de déploiement automatisé.*

### Déploiement avec Docker Simple (Cloud Run, Heroku, etc.)

Si vous déployez sur un environnement managé gérant déjà le SSL (Google Cloud Run, etc.), vous pouvez n'utiliser que le `Dockerfile` à la racine :

1.  **Construire l'image Docker :**
    ```sh
    docker build -t rpg-web-app .
    ```
2.  **Lancer le conteneur :**
    ```sh
    docker run -p 3000:3000 rpg-web-app
    ```

### Déploiement sur Machine Virtuelle (Sans Docker)

Il est possible de déployer facilement l'application sur une machine virtuelle classique (Google Cloud Compute Engine, AWS EC2, DigitalOcean Droplets, etc.) en utilisant un **script de démarrage** (startup script).

Ce script automatise la mise à jour d'un DNS dynamique (ex: OVH), l'installation des prérequis, la configuration du reverse proxy Nginx, la génération d'un certificat SSL avec Let's Encrypt (Certbot), et le lancement de l'application Node.js en arrière-plan sans SSL (car Nginx gère le SSL et redirige vers le port 3000 local).

Voici un exemple de script bash à configurer dans les paramètres de démarrage de votre VM. Il est prévu pour fonctionner avec le DynHost d'OVH, mais il est adaptable à d'autres fournisseurs (ex: API Cloudflare ou No-IP pour le DNS) :

```bash
#! /bin/bash

# === VARIABLES À PERSONNALISER ===
DOMAIN="jdr.votre-domaine.fr"
EMAIL="votre-email@gmail.com"
DYNHOST_USER="votre-domaine.fr-jdr"
DYNHOST_PASS="le-mot-de-passe-dynhost"

REPO_URL="https://github.com/Papoulos/Rpg-home.git"
APP_DIR="/opt/rpg-home"

# 1. MISE À JOUR DE L'IP (Exemple pour DynHost OVH)
# À adapter selon votre fournisseur DNS (Cloudflare, No-IP, etc.)
curl --user "$DYNHOST_USER:$DYNHOST_PASS" "https://www.ovh.com/nic/update?system=dyndns&hostname=$DOMAIN"

# 2. INSTALLATION DES PRÉREQUIS
apt-get update
apt-get install -y git nodejs npm nginx python3-certbot-nginx

# 3. CONFIGURATION DU REVERSE PROXY NGINX
if [ ! -f /etc/nginx/sites-available/rpg-home ]; then
  cat <<EOF > /etc/nginx/sites-available/rpg-home
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/rpg-home /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  systemctl restart nginx
fi

# 4. GESTION DU CERTIFICAT SSL (Let's Encrypt)
# Nginx est prêt, on peut sécuriser la connexion avant même que Node soit lancé
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  # 1er démarrage : on attend que la nouvelle IP soit propagée
  sleep 30
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
else
  # Redémarrages suivants : renouvellement silencieux si nécessaire
  certbot renew --quiet
fi

# 5. RECUPERATION ET LANCEMENT DU PROJET NODE.JS
if [ ! -d "$APP_DIR" ]; then
  git clone $REPO_URL $APP_DIR
else
  cd $APP_DIR
  git reset --hard
  git pull origin main
fi

cd $APP_DIR
npm install
pkill node
# Lancement de l'application en arrière-plan sans SSL (géré par Nginx)
nohup node server.js --nossl > /var/log/rpg-home.log 2>&1 &
```

## Fonctionnalités

L'application est construite autour d'une interface modulaire conçue pour une session de JDR typique, avec une barre de menu permettant de naviguer entre différentes vues centrales (Carte, PJ, Prez, etc.).

### 1. Tableau Blanc Collaboratif (Carte)
La vue principale permet d'afficher et de dessiner sur une carte commune, propulsée par **Fabric.js** et synchronisée via **WebSockets**.
- **Dessin Libre et Formes** : Tracez des lignes, des rectangles, des cercles, ou dessinez librement en choisissant votre couleur.
- **Pointeur partagé** : Affichez un pointeur visible par tous les joueurs pour montrer des éléments spécifiques sur la carte.
- **Brouillard de Guerre (Fog of War)** : Le Maître du Jeu (MJ) peut activer un brouillard masquant la carte pour les joueurs, puis utiliser une gomme spéciale pour révéler dynamiquement des zones.
- **Ajout d'Images et de Fonds** : Insérez des images comme jetons (tokens) ou définissez l'arrière-plan de la carte. Tout est synchronisé en temps réel et géré via une résolution virtuelle fixe, assurant des coordonnées exactes quelle que soit la taille de l'écran des utilisateurs.

### 2. Fiches de Personnages (PJ)
Ce module propose une fiche de personnage interactive native (actuellement orientée *Cypher System*) gérée directement dans l'application.
- **Interface Ergonomique** : Affichage compact en grille pour les statistiques, présentation en colonnes côte-à-côte pour les compétences et capacités, et descriptions d'inventaire consultables/éditables via des fenêtres modales pour économiser de l'espace. Un encart affiche également le portrait du personnage.
- **Sauvegarde et Import/Export JSON** : Les données des fiches sont enregistrées sur le serveur. Il est possible d'importer ou d'exporter facilement les fiches au format JSON.
- **Synchronisation Globale** : La liste des fiches disponibles est partagée et sauvegardée sur le serveur. Lorsqu'une fiche est ajoutée ou supprimée (action réservée au MJ), la liste se met à jour pour tous les joueurs.

### 3. Chat Interactif et Lancer de Dés
La colonne de gauche (rétractable) contient le chat temps réel.
- **Communication Directe** : Messages instantanés entre tous les utilisateurs connectés. Le MJ dispose d'un bouton "Clear Chat" pour nettoyer l'historique si nécessaire.
- **Couleurs par Utilisateur** : Chaque joueur se voit attribuer une couleur pour une meilleure lisibilité.
- **Historique Persistant** : L'historique du chat est sauvegardé sur le serveur, permettant aux joueurs se connectant en retard de lire ce qui s'est dit.
- **Roller de Dés Intégré** : Des boutons permettent de lancer des dés standards (d4, d6, d10, d20, d100). Les résultats critiques (1 ou max) sont mis en évidence.
- **Commandes et Règles Systèmes Intégrées** : L'application gère des jets spécifiques (ex: `/cypher` ou `/c`). Le système affiche clairement les modificateurs (compétences, statuts) et intègre des règles automatisées (ex: un jet demandant de l'Effort est bloqué si la réserve du personnage est insuffisante).

### 4. Visioconférence
La colonne de droite (rétractable) abrite un système de vidéo-chat P2P (chargé de manière différée pour optimiser la connexion initiale).
- **Technologie WebRTC** : Connexions directes entre les pairs pour une faible latence, gérées avec `webrtc-adapter`.
- **Contrôles Locaux et Confidentialité** : La caméra et le micro sont coupés par défaut à la connexion, vous devez les activer manuellement.
- **Indicateurs visuels** : Un encadré visuel s'illumine automatiquement autour des joueurs lorsqu'ils parlent.
- **Détection Automatique** : Ajustement automatique en cas de déconnexions.

### 5. Lecteur de Musique Ambiante
Un lecteur audio contrôlé par le MJ et synchronisé avec tous les joueurs.
- **Support Multi-Sources** : Le MJ peut ajouter des musiques via des URLs de vidéos YouTube ou en téléversant (upload) des fichiers MP3 locaux directement sur le serveur.
- **Contrôle Global et Précis** : Le MJ lance la musique, change de piste, et met en pause (le suivi de progression est conservé). Tout est synchronisé instantanément sur les navigateurs de tous les joueurs.
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



### 9. Performances et Stabilité
Le backend et le frontend intègrent de nombreuses optimisations pour garantir des sessions fluides.
- Utilisation de WebSockets avec mécanisme de pulsation (*heartbeat*) pour empêcher les déconnexions intempestives.
- Chemins relatifs pour les APIs pour une meilleure compatibilité des environnements de déploiement.

### 10. Optimisations de Rapidité et Cache
Les dernières mises à jour ont apporté des améliorations significatives pour la performance :

#### Self-Hosting des Bibliothèques
- **Fabric.js** (993 Ko) : Chargé localement depuis `/libs/fabric/fabric.js` au lieu de Cloudflare CDN.
- **EasyMDE** (319 Ko JS + 13 Ko CSS) : Chargé localement depuis `/libs/easymde/` au lieu de unpkg CDN.
- **Showdown.js** (74 Ko) : Chargé localement depuis `/libs/showdown/showdown.min.js` au lieu de Cloudflare CDN.
- **Avantage** : Zéro dépendance externe, chargement plus rapide, pas de risque de CDN indisponible.

#### Minification des Assets
- **script.js** : 42 Ko → **19 Ko** (-55%)
- **style.css** : 17 Ko → **11 Ko** (-35%)
- **Avantage** : Réduction de la taille des transferts et du temps de chargement.

#### Cache Optimisé
- **Fichiers minifiés** : Cache `immutable` de **1 an** (`max-age=31536000, immutable`)
- **Bibliothèques** (`/libs/`) : Cache `immutable` de **1 an**
- **MP3** : Cache `immutable` de **1 an**
- **Autres fichiers statiques** : Cache de **1 jour**
- **Avantage** : Les visiteurs récurrents ne rechargent jamais les assets statiques.

#### Preloading et Preconnect
- **Preloading** des ressources critiques (Fabric.js, EasyMDE, script.min.js, style.min.css)
- **Preconnect** vers Google Fonts, Google Static, YouTube
- **Avantage** : Le navigateur commence à charger les ressources dès qu'il voit le HTML.

#### Content Security Policy (CSP)
- **CSP strict** appliqué via `helmet` pour bloquer les chargements non autorisés.
- **Avantage** : Protection contre les attaques XSS et les injections de scripts malveillants.
- **Compression activée** pour toutes les réponses HTTP via `compression` middleware.
- **Avantage** : Réduction de 60-80% de la taille des transferts.
- Gestion robuste et centralisée des erreurs de connexion (caméra, fichiers manquants, placeholders, etc.).
