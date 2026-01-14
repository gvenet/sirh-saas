# Gestion des Entités - Guide d'utilisation

## Vue d'ensemble

Le système de gestion des entités SIRH permet de créer, modifier et supprimer des modules CRUD complets (Backend NestJS + Frontend Angular) directement depuis l'interface web.

## Fonctionnalités

### 1. Créer une nouvelle entité
**URL:** `/generator`

- Remplir le formulaire avec :
  - **Nom de l'entité** : Nom en PascalCase (ex: Employee, Product)
  - **Nom de la table** : Nom de la table PostgreSQL (ex: employees, products)
  - **Champs** : Liste des propriétés de l'entité

- Types de champs disponibles :
  - `string` : Texte
  - `number` : Nombre
  - `boolean` : Booléen (vrai/faux)
  - `date` : Date

- Options par champ :
  - **Requis** : Le champ est obligatoire
  - **Unique** : Valeur unique en base de données
  - **Valeur par défaut** : Valeur initiale du champ

### 2. Lister les entités existantes
**URL:** `/generator/list`

- Affiche toutes les entités générées sous forme de cartes
- Chaque carte affiche :
  - Nom de l'entité
  - Nom du module
  - Chemin du dossier
  - Boutons d'action (Éditer / Supprimer)

### 3. Modifier une entité
**URL:** `/generator/edit/:name`

- Accessible via le bouton "Éditer" dans la liste
- Permet de :
  - Modifier le nom de la table
  - Ajouter/supprimer des champs
  - Modifier les propriétés des champs existants
- **Note:** Le nom de l'entité ne peut pas être modifié (identifiant unique)

### 4. Supprimer une entité
- Accessible via le bouton "Supprimer" dans la liste
- Demande confirmation avant suppression
- Supprime :
  - Tous les fichiers du module (backend)
  - L'entrée dans `app.module.ts`
  - Le dossier complet du module

## Architecture générée

Pour chaque entité créée, le générateur produit :

### Backend (NestJS)
```
src/{entity-name}/
├── {entity-name}.controller.ts    # Endpoints REST
├── {entity-name}.service.ts       # Logique métier
├── {entity-name}.entity.ts        # Modèle TypeORM
├── {entity-name}.module.ts        # Module NestJS
└── dto/
    ├── create-{entity-name}.dto.ts
    └── update-{entity-name}.dto.ts
```

### Endpoints REST générés
- `POST /{entity-name}` - Créer
- `GET /{entity-name}` - Lister tous
- `GET /{entity-name}/:id` - Obtenir un par ID
- `PATCH /{entity-name}/:id` - Mettre à jour
- `DELETE /{entity-name}/:id` - Supprimer

### Frontend (Angular)
Les composants frontend ne sont pas encore générés automatiquement, mais peuvent être ajoutés manuellement.

## API du générateur

### Endpoints disponibles

#### 1. Créer une entité
```http
POST /generator/entity
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Employee",
  "tableName": "employees",
  "fields": [
    {
      "name": "firstName",
      "type": "string",
      "required": true,
      "unique": false,
      "defaultValue": ""
    }
  ]
}
```

#### 2. Lister les entités
```http
GET /generator/entities
Authorization: Bearer {token}
```

Réponse :
```json
[
  {
    "name": "Employee",
    "moduleName": "employee",
    "path": "/path/to/sirh-back/src/employee"
  }
]
```

#### 3. Obtenir une entité
```http
GET /generator/entity/:name
Authorization: Bearer {token}
```

Réponse :
```json
{
  "name": "Employee",
  "tableName": "employees",
  "moduleName": "employee",
  "fields": [...]
}
```

#### 4. Mettre à jour une entité
```http
PUT /generator/entity/:name
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Employee",
  "tableName": "employees",
  "fields": [...]
}
```

#### 5. Supprimer une entité
```http
DELETE /generator/entity/:name
Authorization: Bearer {token}
```

## Accès rapide depuis le dashboard

Le dashboard principal contient deux cartes pour le générateur :

1. **Générateur d'Entités** (icône teal)
   - Accès direct au formulaire de création
   - Lien : `/generator`

2. **Gestion des Entités** (icône indigo)
   - Accès à la liste de toutes les entités
   - Lien : `/generator/list`

## Exemple d'utilisation

### Créer une entité "Product"

1. Se connecter à l'application
2. Cliquer sur "Générateur d'Entités" dans le dashboard
3. Remplir le formulaire :
   ```
   Nom: Product
   Table: products
   Champs:
     - name (string, requis)
     - description (string, optionnel)
     - price (number, requis)
     - inStock (boolean, requis, défaut: true)
   ```
4. Cliquer sur "Générer l'entité"
5. Le système crée automatiquement tous les fichiers nécessaires
6. L'entité est immédiatement disponible via l'API

### Modifier l'entité "Product"

1. Aller sur `/generator/list`
2. Cliquer sur le bouton "Éditer" de la carte "Product"
3. Modifier les champs (ex: ajouter un champ "category")
4. Cliquer sur "Mettre à jour"
5. Les fichiers sont automatiquement regénérés

## Notes importantes

- Toutes les opérations nécessitent une authentification JWT
- La suppression d'une entité est irréversible
- Après modification, le serveur NestJS se recharge automatiquement (mode watch)
- Les noms d'entités doivent être en PascalCase
- Les noms de champs doivent être en camelCase
- Les noms de tables sont généralement au pluriel et en snake_case

## Troubleshooting

### Le serveur ne redémarre pas après génération
```bash
cd sirh-back
npm run start:dev
```

### Erreur "Entity already exists"
L'entité existe déjà. Utilisez la fonctionnalité de modification ou supprimez-la d'abord.

### Champs manquants dans la base de données
Assurez-vous que TypeORM synchronise le schéma :
- En développement : `synchronize: true` dans la config TypeORM
- En production : Utilisez les migrations

### Le frontend ne charge pas les entités
Vérifiez que :
1. Le backend est démarré (`npm run start:dev`)
2. Vous êtes bien authentifié
3. Le token JWT n'a pas expiré
4. Les CORS sont configurés correctement
