# Système de Gestion des Rôles - SIRH

## Vue d'ensemble

Le système SIRH dispose maintenant d'un système de contrôle d'accès basé sur les rôles (RBAC - Role-Based Access Control).

## Rôles disponibles

### 1. Admin (`admin`)
- **Accès complet** au système
- Peut utiliser le **générateur d'entités**
- Peut créer, modifier et supprimer des entités CRUD
- Accès à tous les modules de l'application

### 2. RH (`rh`)
- Accès au tableau de bord RH
- Gestion des employés, congés, présences
- **N'a PAS accès** au générateur d'entités
- Fonctionnalités RH complètes (à implémenter)

### 3. Agent (`agent`)
- Accès de base à l'application
- Visualisation de ses propres informations
- Gestion de son profil
- **N'a PAS accès** au générateur d'entités ni aux fonctions RH

## Configuration Backend

### Structure des fichiers

```
sirh-back/src/
├── auth/
│   ├── enums/
│   │   └── role.enum.ts          # Définition des rôles
│   ├── decorators/
│   │   └── roles.decorator.ts    # Décorateur @Roles()
│   └── guards/
│       ├── jwt-auth.guard.ts     # Authentification JWT
│       └── roles.guard.ts        # Vérification des rôles
└── users/
    └── entities/
        └── user.entity.ts        # Champ 'role' ajouté
```

### Entité User

```typescript
@Column({
  type: 'enum',
  enum: Role,
  default: Role.AGENT,
})
role: Role;
```

### Protection des routes

```typescript
@Controller('generator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GeneratorController {
  // Seuls les admins peuvent accéder
}
```

## Configuration Frontend

### Structure des fichiers

```
sirh-front/src/app/
├── core/
│   ├── models/
│   │   └── user.model.ts         # Interface User avec role
│   ├── guards/
│   │   ├── auth.guard.ts         # Authentification
│   │   └── admin.guard.ts        # Vérification admin
│   └── services/
│       └── auth.service.ts       # Méthodes isAdmin(), isRH(), isAgent()
└── features/
    └── dashboard/
        └── dashboard.component.html  # Affichage conditionnel des cartes
```

### Protection des routes

```typescript
{
  path: 'generator',
  canActivate: [authGuard, adminGuard],
  loadComponent: () => import('./generator/...')
}
```

### Affichage conditionnel

```html
@if (authService.isAdmin()) {
  <a routerLink="/generator" class="card">
    <!-- Carte générateur visible uniquement pour admin -->
  </a>
}
```

## Utilisation

### Créer un utilisateur avec un rôle spécifique

```bash
# Admin
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sirh.com",
    "password": "admin123",
    "firstName": "Admin",
    "lastName": "System",
    "position": "Administrator",
    "department": "IT",
    "role": "admin"
  }'

# RH
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rh@sirh.com",
    "password": "rh1234",
    "firstName": "Sophie",
    "lastName": "Martin",
    "position": "RH Manager",
    "department": "RH",
    "role": "rh"
  }'

# Agent (rôle par défaut)
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@sirh.com",
    "password": "agent123",
    "firstName": "Jean",
    "lastName": "Dupont",
    "position": "Employee",
    "department": "Sales"
  }'
```

### Comptes de test créés

| Email | Mot de passe | Rôle | Nom |
|-------|--------------|------|-----|
| admin@sirh.com | admin123 | admin | Admin System |
| rh@sirh.com | rh1234 | rh | Sophie Martin |
| agent@sirh.com | agent123 | agent | Jean Dupont |

## Tests effectués

### ✅ Backend - Contrôle d'accès

```bash
# Admin - SUCCESS (200)
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/generator/entities
# Résultat: Liste des entités retournée

# RH - FORBIDDEN (403)
curl -H "Authorization: Bearer <rh_token>" \
  http://localhost:3000/generator/entities
# Résultat: {"message":"Forbidden resource","error":"Forbidden","statusCode":403}

# Agent - FORBIDDEN (403)
curl -H "Authorization: Bearer <agent_token>" \
  http://localhost:3000/generator/entities
# Résultat: {"message":"Forbidden resource","error":"Forbidden","statusCode":403}
```

### Frontend - Affichage conditionnel

- **Admin** : Voit les cartes "Générateur d'Entités" et "Gestion des Entités"
- **RH/Agent** : Ne voit PAS ces cartes sur le dashboard

## Sécurité

### Token JWT

Le token JWT inclut maintenant le rôle :

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1768372443,
  "exp": 1768977243
}
```

### Double vérification

1. **Backend** : `RolesGuard` vérifie le rôle dans le token
2. **Frontend** : `adminGuard` et affichage conditionnel empêchent l'accès

## Extensions futures

### Ajouter de nouveaux rôles

1. **Backend** : Ajouter dans `role.enum.ts`
   ```typescript
   export enum Role {
     ADMIN = 'admin',
     RH = 'rh',
     MANAGER = 'manager',  // Nouveau
     AGENT = 'agent',
   }
   ```

2. **Frontend** : Ajouter méthode dans `auth.service.ts`
   ```typescript
   isManager(): boolean {
     return this.hasRole(Role.MANAGER);
   }
   ```

3. **Protéger une route** :
   ```typescript
   @Roles(Role.ADMIN, Role.MANAGER)
   async someMethod() { ... }
   ```

### Permissions granulaires

Pour des permissions plus fines, considérer :
- Système de permissions séparé des rôles
- Table `permissions` en base de données
- Relation many-to-many `roles_permissions`

## Commandes utiles

### Vérifier le rôle d'un utilisateur

```typescript
// Backend
const user = await usersService.findById(userId);
console.log(user.role); // 'admin', 'rh', ou 'agent'

// Frontend
authService.isAdmin();  // true/false
authService.isRH();     // true/false
authService.isAgent();  // true/false
```

### Changer le rôle d'un utilisateur

Actuellement, le rôle est défini lors de la création. Pour le modifier :

```sql
-- Via SQL
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

**TODO** : Créer une interface admin pour gérer les rôles des utilisateurs.

## Troubleshooting

### Erreur 403 alors que l'utilisateur est admin

1. Vérifier que le token est valide et contient le bon rôle
2. Décoder le JWT sur [jwt.io](https://jwt.io)
3. Vérifier que `RolesGuard` est bien appliqué au contrôleur
4. Se reconnecter pour obtenir un nouveau token avec le rôle mis à jour

### Les cartes du générateur ne s'affichent pas

1. Vérifier `authService.isAdmin()` dans la console du navigateur
2. Vérifier que le user stocké dans localStorage a le champ `role`
3. Effacer le localStorage et se reconnecter

```javascript
// Dans la console du navigateur
localStorage.clear();
location.reload();
```

## Architecture de sécurité

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Angular)                 │
│  ┌────────────────────────────────────────────────┐ │
│  │  Routes protégées (adminGuard)                 │ │
│  │  - /generator                                  │ │
│  │  - /generator/list                            │ │
│  │  - /generator/edit/:name                      │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │  UI conditionnelle (@if authService.isAdmin()) │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         ▼ HTTP Request + JWT
┌─────────────────────────────────────────────────────┐
│                   Backend (NestJS)                   │
│  ┌────────────────────────────────────────────────┐ │
│  │  JwtAuthGuard (vérifie authentification)       │ │
│  └────────────────────────────────────────────────┘ │
│                         ▼                            │
│  ┌────────────────────────────────────────────────┐ │
│  │  RolesGuard (vérifie role === 'admin')        │ │
│  └────────────────────────────────────────────────┘ │
│                         ▼                            │
│  ┌────────────────────────────────────────────────┐ │
│  │  GeneratorController (@Roles(Role.ADMIN))     │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Résumé

Le système de rôles est maintenant **pleinement opérationnel** :

✅ 3 rôles définis (admin, rh, agent)
✅ Backend protégé par RolesGuard
✅ Frontend avec adminGuard et affichage conditionnel
✅ JWT contient le rôle
✅ Tests de sécurité validés
✅ Comptes de test créés

Seuls les utilisateurs avec le rôle `admin` peuvent accéder au générateur d'entités.
