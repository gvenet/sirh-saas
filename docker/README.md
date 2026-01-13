# Docker Configuration SIRH

Ce dossier contient la configuration Docker pour le projet SIRH.

## Services

### PostgreSQL
- **Port:** 5433 (mappé vers 5432 interne)
- **Base de données:** sirh_db
- **Utilisateur:** sirh_user
- **Mot de passe:** sirh_password

### pgAdmin
- **URL:** http://localhost:5050
- **Email:** admin@admin.com
- **Mot de passe:** admin

## Commandes

### Démarrer les services
```bash
cd docker
docker-compose up -d
```

### Arrêter les services
```bash
docker-compose down
```

### Arrêter et supprimer les volumes (données)
```bash
docker-compose down -v
```

### Voir les logs
```bash
docker-compose logs -f
```

### Voir les logs d'un service spécifique
```bash
docker-compose logs -f postgres
docker-compose logs -f pgadmin
```

## Configuration de la connexion dans pgAdmin

1. Accéder à http://localhost:5050
2. Se connecter avec les identifiants ci-dessus
3. Ajouter un nouveau serveur :
   - **Name:** SIRH Local
   - **Host:** postgres (nom du service dans docker-compose)
   - **Port:** 5432
   - **Username:** sirh_user
   - **Password:** sirh_password
   - **Database:** sirh_db

## Variables d'environnement pour l'application NestJS

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=sirh_user
DB_PASSWORD=sirh_password
DB_DATABASE=sirh_db
```

## Volumes

Les données sont persistées dans des volumes Docker nommés :
- `postgres_data` : Données PostgreSQL
- `pgadmin_data` : Configuration pgAdmin
