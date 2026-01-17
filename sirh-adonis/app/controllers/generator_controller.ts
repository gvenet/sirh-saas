import type { HttpContext } from '@adonisjs/core/http'
import GeneratorService from '#services/generator/generator_service'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'

@inject()
export default class GeneratorController {
  constructor(private generatorService: GeneratorService) {}

  /**
   * List all generated entities
   */
  async listEntities({ response }: HttpContext) {
    logger.info('GET /generator/entities - listing entities')
    const entities = await this.generatorService.listEntities()
    return response.json(entities)
  }

  /**
   * Get a single entity details
   */
  async getEntity({ params, response }: HttpContext) {
    logger.info({ name: params.name }, 'GET /generator/entities/:name - getting entity')
    try {
      const entity = await this.generatorService.getEntity(params.name)
      if (!entity) {
        return response.status(404).json({ error: 'Entity not found' })
      }
      return response.json(entity)
    } catch (error) {
      logger.error({ error, name: params.name }, 'Error getting entity')
      return response.status(500).json({
        error: 'Failed to get entity',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Generate a new entity
   */
  async generateEntity({ request, response }: HttpContext) {
    const { name, tableName, fields } = request.body()
    logger.info({ name, tableName, fieldsCount: fields?.length }, 'POST /generator/entities - creating entity')
    // Debug: log each field with relation info
    fields?.forEach((f: any, i: number) => {
      logger.info({ index: i, name: f.name, type: f.type, hasRelation: !!f.relation, relationType: f.relation?.type }, 'Field detail')
    })

    if (!name || !fields || !Array.isArray(fields)) {
      return response.status(400).json({
        error: 'name and fields are required',
      })
    }

    // Check for duplicate field names
    const fieldNames = fields.map((f: { name: string }) => f.name)
    const duplicates = fieldNames.filter((n: string, i: number) => fieldNames.indexOf(n) !== i)
    if (duplicates.length > 0) {
      return response.status(400).json({
        error: 'Duplicate field names are not allowed',
        message: `Duplicate field names: ${[...new Set(duplicates)].join(', ')}`,
      })
    }

    const result = await this.generatorService.generateEntity({
      name,
      tableName: tableName || name.toLowerCase() + 's',
      fields,
    })

    return response.status(201).json(result)
  }

  /**
   * Update an existing entity (delete and recreate)
   */
  async updateEntity({ params, request, response }: HttpContext) {
    const { name, tableName, fields } = request.body()
    logger.info({ name: params.name, tableName, fields }, 'PUT /generator/entities/:name - updating entity')

    // Check for duplicate field names
    if (fields && Array.isArray(fields)) {
      const fieldNames = fields.map((f: { name: string }) => f.name)
      const duplicates = fieldNames.filter((n: string, i: number) => fieldNames.indexOf(n) !== i)
      if (duplicates.length > 0) {
        return response.status(400).json({
          error: 'Duplicate field names are not allowed',
          message: `Duplicate field names: ${[...new Set(duplicates)].join(', ')}`,
        })
      }
    }

    try {
      const result = await this.generatorService.updateEntity(params.name, {
        name: name || params.name,
        tableName: tableName || params.name.toLowerCase() + 's',
        fields: fields || [],
      })

      return response.json(result)
    } catch (error) {
      logger.error({ error, name: params.name }, 'Error updating entity')
      return response.status(500).json({
        error: 'Failed to update entity',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Delete an entity
   */
  async deleteEntity({ params, request, response }: HttpContext) {
    logger.info({ name: params.name }, 'DELETE /generator/entities/:name - deleting entity')
    try {
      const { dropTable = true } = request.qs()

      const result = await this.generatorService.deleteEntity(
        params.name,
        dropTable === 'true' || dropTable === true
      )

      return response.json(result)
    } catch (error) {
      logger.error({ error, name: params.name }, 'Error deleting entity')
      return response.status(500).json({
        error: 'Failed to delete entity',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
