/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const GeneratorController = () => import('#controllers/generator_controller')

// Health check
router.get('/', async () => {
  return { status: 'ok', message: 'SIRH API is running' }
})

router.get('/health', async () => {
  return { status: 'ok' }
})

// Generator routes
router.group(() => {
  router.get('/entities', [GeneratorController, 'listEntities'])
  router.post('/entities', [GeneratorController, 'generateEntity'])
  router.delete('/entities/:name', [GeneratorController, 'deleteEntity'])
}).prefix('/generator')
