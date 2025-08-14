#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Pull the latest changes
git pull origin main

# Build images
docker compose -f docker-compose.yml build

# Create dummy cert if missing to allow nginx to start
if [ ! -f ./nginx/letsencrypt/live/pmcs.site/fullchain.pem ]; then
	mkdir -p ./nginx/letsencrypt/live/pmcs.site
	echo "🔏 Creating temporary self-signed certificate to bootstrap nginx..."
	docker run --rm -v "$(pwd)/nginx/letsencrypt:/etc/letsencrypt" alpine:3.20 sh -c "apk add --no-cache openssl >/dev/null && mkdir -p /etc/letsencrypt/live/pmcs.site && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout /etc/letsencrypt/live/pmcs.site/privkey.pem -out /etc/letsencrypt/live/pmcs.site/fullchain.pem -subj '/CN=pmcs.site'"
fi

# Start containers
docker compose -f docker-compose.yml up -d

# Issue Let's Encrypt certs if missing
if [ ! -f ./nginx/letsencrypt/live/pmcs.site/fullchain.pem ]; then
	echo "🔐 Issuing initial Let's Encrypt certificate..."
	# Ensure challenge dir exists and nginx is serving it
	mkdir -p ./nginx/certbot/.well-known/acme-challenge
	chmod -R 755 ./nginx/certbot
	# Attempt issuance
	docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
		-d pmcs.site -d www.pmcs.site \
		--agree-tos -m "${LETSENCRYPT_EMAIL:-admin@pmcs.site}" --non-interactive --rsa-key-size 2048
	# Reload nginx to pick up new certs
	docker compose exec nginx nginx -s reload || true
fi

echo "✅ Deployment completed successfully!"
