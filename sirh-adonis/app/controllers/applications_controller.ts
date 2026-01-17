import type { HttpContext } from '@adonisjs/core/http'
import ApplicationService from '#services/applications_service'
import { inject } from '@adonisjs/core'

@inject()
export default class ApplicationController {
  constructor(private applicationService: ApplicationService) {}

  // ========== Applications ==========

  /**
   * Get all applications
   */
  async index({ response }: HttpContext) {
    const applications = await this.applicationService.findAllApplications()
    return response.json(applications)
  }

  /**
   * Get a specific application
   */
  async show({ params, response }: HttpContext) {
    const application = await this.applicationService.findApplicationById(params.id)
    return response.json(application)
  }

  /**
   * Create a new application
   */
  async store({ request, response }: HttpContext) {
    const data = request.body()
    const application = await this.applicationService.createApplication(data)
    return response.status(201).json(application)
  }

  /**
   * Update an application
   */
  async update({ params, request, response }: HttpContext) {
    const data = request.body()
    const application = await this.applicationService.updateApplication(params.id, data)
    return response.json(application)
  }

  /**
   * Delete an application
   */
  async destroy({ params, response }: HttpContext) {
    await this.applicationService.deleteApplication(params.id)
    return response.json({ message: 'Application deleted' })
  }

  // ========== Menu Items ==========

  /**
   * Get all menu items
   */
  async indexMenuItems({ response }: HttpContext) {
    const menuItems = await this.applicationService.findAllMenuItems()
    return response.json(menuItems)
  }

  /**
   * Create a new menu item
   */
  async storeMenuItem({ request, response }: HttpContext) {
    const data = request.body()
    const menuItem = await this.applicationService.createMenuItem(data)
    return response.status(201).json(menuItem)
  }

  /**
   * Update a menu item
   */
  async updateMenuItem({ params, request, response }: HttpContext) {
    const data = request.body()
    const menuItem = await this.applicationService.updateMenuItem(params.id, data)
    return response.json(menuItem)
  }

  /**
   * Delete a menu item
   */
  async destroyMenuItem({ params, response }: HttpContext) {
    await this.applicationService.deleteMenuItem(params.id)
    return response.json({ message: 'Menu item deleted' })
  }

  // ========== Menu Pages ==========

  /**
   * Get a menu page by ID
   */
  async showMenuPage({ params, response }: HttpContext) {
    const page = await this.applicationService.findMenuPageById(params.id)
    return response.json(page)
  }

  /**
   * Get a menu page by menu item ID
   */
  async showMenuPageByMenuItem({ params, response }: HttpContext) {
    const page = await this.applicationService.findMenuPageByMenuItemId(params.menuItemId)
    return response.json(page)
  }

  /**
   * Update a menu page
   */
  async updateMenuPage({ params, request, response }: HttpContext) {
    const data = request.body()
    const page = await this.applicationService.updateMenuPage(params.id, data)
    return response.json(page)
  }
}
