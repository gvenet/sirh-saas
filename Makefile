.PHONY: help install start stop restart logs clean dev-front dev-back dev-all db-up db-down db-logs migrate migrate-reset

help:
	@echo "SIRH - Commandes disponibles:"
	@echo ""
	@echo "  make install      - Installer toutes les dépendances (front + back)"
	@echo "  make dev-all      - Lancer tous les services (DB + Back + Front)"
	@echo "  make dev-front    - Lancer le frontend Angular"
	@echo "  make dev-back     - Lancer le backend AdonisJS"
	@echo "  make migrate      - Lancer les migrations AdonisJS"
	@echo "  make migrate-reset- Reset les migrations (drop all + re-run)"
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
	cd sirh-adonis && npm install
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
	@echo "🟢 Démarrage du backend AdonisJS..."
	lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
	cd sirh-adonis && node ace serve --hmr --no-clear

migrate:
	@echo "🔄 Exécution des migrations AdonisJS..."
	cd sirh-adonis && node ace migration:run
	@echo "✅ Migrations terminées"

migrate-reset:
	@echo "🔄 Reset des migrations AdonisJS (drop all tables + re-run)..."
	@echo "🧹 Suppression des migrations générées..."
	rm -f sirh-adonis/database/migrations/2026*.ts
	@echo "🧹 Suppression des fichiers d'entités générés..."
	@# Keep only system files, remove generated entities
	@find sirh-adonis/app/models -name "*.ts" ! -name "user.ts" ! -name "entity_page.ts" ! -name "page_field.ts" ! -name "application.ts" ! -name "menu_item.ts" ! -name "menu_page.ts" -delete 2>/dev/null || true
	@find sirh-adonis/app/controllers -name "*_controller.ts" ! -name "generator_controller.ts" ! -name "auth_controller.ts" ! -name "entity_page_controller.ts" ! -name "applications_controller.ts" -delete 2>/dev/null || true
	@find sirh-adonis/app/validators -name "*_validator.ts" ! -name "auth_validator.ts" -delete 2>/dev/null || true
	@echo "🧹 Nettoyage du fichier routes.ts..."
	@cd sirh-adonis && node -e "\
		const fs=require('fs');\
		let c=fs.readFileSync('start/routes.ts','utf8');\
		c=c.replace(/const (?!Generator|Auth|EntityPage|Application)\\w+Controller = \\(\\) => import\\('#controllers\\/[^']+_controller'\\)\\n/g,'');\
		c=c.replace(/\\n\\/\\/ (?!Auth|Generator|Entity Pages|Application)\\w+ routes[\\s\\S]*?\\.prefix\\('\\/[^']+'\\)/g,'');\
		fs.writeFileSync('start/routes.ts',c);\
	"
	cd sirh-adonis && node ace migration:fresh
	@echo "✅ Migrations reset terminées"

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
