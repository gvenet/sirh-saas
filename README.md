# SIRH - Système d'Information des Ressources Humaines

Application full-stack moderne avec Angular 21 et NestJS 11, incluant authentification JWT.

## 🚀 Stack Technique

### Frontend
- **Angular 21** - Framework frontend avec composants standalone
- **TypeScript 5.9** - Langage typé
- **Signals** - Gestion d'état réactive
- **Vitest** - Tests unitaires

### Backend
- **NestJS 11** - Framework Node.js backend
- **TypeORM** - ORM pour PostgreSQL
- **PostgreSQL 16** - Base de données
- **JWT + Passport** - Authentification
- **bcrypt** - Hash des mots de passe
- **Jest** - Tests

### Infrastructure
- **Docker Compose** - PostgreSQL + pgAdmin
- **Makefile** - Commandes simplifiées

## 🏃 Démarrage rapide

```bash
# Démarrer la base de données
make db-up

# Dans un terminal : démarrer le backend
make dev-back

# Dans un autre terminal : démarrer le frontend
make dev-front
```

## 🌐 Accès aux services

| Service | URL | Identifiants |
|---------|-----|--------------|
| **Frontend** | http://localhost:4200 | Créer un compte |
| **Backend API** | http://localhost:3000 | - |
| **pgAdmin** | http://localhost:5050 | admin@admin.com / admin |
| **PostgreSQL** | localhost:5433 | sirh_user / sirh_password |

## 🔐 Authentification

### Endpoints API

```
POST /auth/signup   - Créer un compte
POST /auth/login    - Se connecter
GET  /auth/me       - Profil utilisateur (protégé)
```

---

**Développé avec ❤️ pour simplifier la gestion RH**
