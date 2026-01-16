.PHONY: help install start stop restart logs clean dev-front dev-back dev-all db-up db-down db-logs

help:
	@echo "SIRH - Commandes disponibles:"
	@echo ""
	@echo "  make install      - Installer toutes les dépendances (front + back)"
	@echo "  make dev-all      - Lancer tous les services (DB + Back + Front)"
	@echo "  make dev-front    - Lancer le frontend Angular"
	@echo "  make dev-back     - Lancer le backend NestJS"
	@echo "  make db-up        - Démarrer PostgreSQL et pgAdmin"
	@echo "  make db-down      - Arrêter PostgreSQL et pgAdmin"
	@echo "  make db-logs      - Voir les logs de la base de données"
	@echo "  make stop         - Arrêter tous les services"
	@echo "  make restart      - Redémarrer tous les services"
	@echo "  make logs         - Voir les logs Docker"
	@echo "  make clean        - Nettoyer les containers et volumes"
	@echo ""

# Installation des dépendances
install:
	@echo "📦 Installation des dépendances..."
	cd sirh-front && npm install
	cd sirh-back && npm install
	@echo "✅ Installation terminée"

# Base de données
db-up:
	@echo "🐘 Démarrage de PostgreSQL et pgAdmin..."
	cd docker && docker-compose up -d
	@echo "✅ Base de données démarrée sur localhost:5433"
	@echo "✅ pgAdmin disponible sur http://localhost:5050"

db-down:
	@echo "🛑 Arrêt de PostgreSQL et pgAdmin..."
	cd docker && docker-compose down
	@echo "✅ Base de données arrêtée"

db-logs:
	cd docker && docker-compose logs -f postgres

# Développement
dev-front:
	@echo "🅰️  Démarrage du frontend Angular..."
	lsof -ti:4200 | xargs -r kill -9 && sleep 3 && lsof -ti:4200 && echo "Port still in use" || echo "Port 4200 is now free"
	cd sirh-front && npm start

dev-back:
	@echo "🟢 Démarrage du backend NestJS..."
	lsof -ti:3000 | xargs -r kill -9 && sleep 3 && lsof -ti:3000 && echo "Port still in use" || echo "Port 3000 is now free"
	cd sirh-back && npm run dev

dev-all:
	@echo "🚀 Démarrage de tous les services..."
	@make db-up
	@echo ""
	@echo "Pour lancer le backend et le frontend, ouvrez 2 terminaux:"
	@echo "  Terminal 1: make dev-back"
	@echo "  Terminal 2: make dev-front"
	@echo ""
	@echo "Ou utilisez tmux/screen pour lancer les deux en parallèle"

# Gestion des services
stop:
	@echo "🛑 Arrêt de tous les services..."
	cd docker && docker-compose down
	@echo "✅ Tous les services arrêtés"

restart: stop dev-all

logs:
	cd docker && docker-compose logs -f

# Nettoyage
clean:
	@echo "🧹 Nettoyage des containers et volumes..."
	cd docker && docker-compose down -v
	@echo "✅ Nettoyage terminé"
