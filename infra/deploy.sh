#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Atualizando repositório..."
git pull

echo "Subindo containers..."
docker compose -f infra/docker-compose.yml up -d --build --force-recreate

echo " "
echo "Deploy concluído. Últimos logs:"
docker compose -f infra/docker-compose.yml logs --tail=20 extra-web
