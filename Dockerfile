# Étape 1 : Utiliser une image Node.js officielle et légère
FROM node:18-slim

# Créer un répertoire pour l'application
WORKDIR /app

# Créez le répertoire que l'application doit écrire
RUN mkdir -p /app/wiki

# Copier les fichiers de définition des dépendances
COPY package.json package-lock.json ./

# Installer les dépendances de manière propre et reproductible
# L'option --only=production pourrait être utilisée, mais les dépendances de dev ne sont pas présentes dans ce projet.
RUN npm ci

# Copier le reste du code de l'application
COPY . .

# Créer un utilisateur non-root pour des raisons de sécurité
RUN useradd -m nodeuser
USER nodeuser

# Exposer le port sur lequel l'application s'exécute
EXPOSE 3000

# Définir la variable d'environnement pour s'assurer que l'application écoute sur le bon port
ENV PORT=3000

# Commande pour démarrer le serveur en mode HTTP (sans SSL)
CMD ["npm", "start"]
