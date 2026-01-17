/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
























import { middleware } from './kernel.js'

const GeneratorController = () => import('#controllers/generator_controller')
const AuthController = () => import('#controllers/auth_controller')
const EntityPageController = () => import('#controllers/entity_page_controller')

// Health check
router.get('/', async () => {
  return { status: 'ok', message: 'SIRH API is running' }
})

router.get('/health', async () => {
  return { status: 'ok' }
})

// Auth routes
router.group(() => {
  // Public routes
  router.post('/signup', [AuthController, 'signup'])
  router.post('/login', [AuthController, 'login'])
  router.post('/forgot-password', [AuthController, 'forgotPassword'])
  router.post('/reset-password', [AuthController, 'resetPassword'])

  // Protected routes
  router.get('/me', [AuthController, 'me']).use(middleware.auth())
  router.post('/change-password', [AuthController, 'changePassword']).use(middleware.auth())
  router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
}).prefix('/auth')

// Generator routes
router.group(() => {
  router.get('/entities', [GeneratorController, 'listEntities'])
  router.get('/entities/:name', [GeneratorController, 'getEntity'])
  router.post('/entities', [GeneratorController, 'generateEntity'])
  router.put('/entities/:name', [GeneratorController, 'updateEntity'])
  router.delete('/entities/:name', [GeneratorController, 'deleteEntity'])
}).prefix('/generator')

// Entity Pages routes
router.group(() => {
  router.get('/:entityName/pages', [EntityPageController, 'index'])
  router.get('/pages/:id', [EntityPageController, 'show'])
  router.put('/pages/:id', [EntityPageController, 'update'])
  router.put('/pages/:id/fields', [EntityPageController, 'updateFields'])
  // Field routes
  router.post('/:pageId/fields', [EntityPageController, 'addField'])
  router.put('/fields/:fieldId', [EntityPageController, 'updateField'])
  router.delete('/fields/:fieldId', [EntityPageController, 'deleteField'])
  router.put('/:pageId/fields/reorder', [EntityPageController, 'reorderFields'])
}).prefix('/entity-pages')










