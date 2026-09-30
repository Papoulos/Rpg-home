FROM nginx:latest

# Installation des paquets nécessaires
RUN apt-get update && \
    apt-get install -y curl certbot python3-certbot-nginx cron && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copie du script d'entrée
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Définir le point d'entrée
ENTRYPOINT ["/entrypoint.sh"]
