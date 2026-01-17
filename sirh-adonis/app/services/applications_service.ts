import Application from '#models/application'
import MenuItem from '#models/menu_item'
import MenuPage from '#models/menu_page'

export default class ApplicationService {
  /**
   * Get all applications with their menu items and pages
   */
  async findAllApplications() {
    return Application.query()
      .preload('menuItems', (query) => {
        query
          .whereNull('parentId')
          .orderBy('order', 'asc')
          .preload('menuPage')
          .preload('children', (childQuery) => {
            childQuery.orderBy('order', 'asc').preload('menuPage')
          })
      })
      .orderBy('order', 'asc')
  }

  /**
   * Get a specific application by ID
   */
  async findApplicationById(id: number) {
    return Application.query()
      .where('id', id)
      .preload('menuItems', (query) => {
        query
          .whereNull('parentId')
          .orderBy('order', 'asc')
          .preload('menuPage')
          .preload('children', (childQuery) => {
            childQuery.orderBy('order', 'asc').preload('menuPage')
          })
      })
      .firstOrFail()
  }

  /**
   * Create a new application
   */
  async createApplication(data: Partial<Application>) {
    return Application.create(data)
  }

  /**
   * Update an application
   */
  async updateApplication(id: number, data: Partial<Application>) {
    const application = await Application.findOrFail(id)
    application.merge(data)
    await application.save()
    return application
  }

  /**
   * Delete an application
   */
  async deleteApplication(id: number) {
    const application = await Application.findOrFail(id)
    await application.delete()
  }

  /**
   * Get all menu items with their pages
   */
  async findAllMenuItems() {
    return MenuItem.query()
      .preload('menuPage')
      .preload('children', (childQuery) => {
        childQuery.orderBy('order', 'asc').preload('menuPage')
      })
      .orderBy('order', 'asc')
  }

  /**
   * Get a specific menu item by ID
   */
  async findMenuItemById(id: number) {
    return MenuItem.query()
      .where('id', id)
      .preload('menuPage')
      .preload('children', (childQuery) => {
        childQuery.orderBy('order', 'asc').preload('menuPage')
      })
      .firstOrFail()
  }

  /**
   * Create a new menu item with its associated page
   */
  async createMenuItem(data: Partial<MenuItem>) {
    // Verify application exists
    await Application.findOrFail(data.applicationId)

    // Create the menu item
    const menuItem = await MenuItem.create(data)

    // Create the associated page automatically
    await MenuPage.create({
      menuItemId: menuItem.id,
      title: data.label || 'Nouvelle page',
      description: null,
      content: null,
      config: null,
      active: true,
    })

    // Reload with page
    return this.findMenuItemById(menuItem.id)
  }

  /**
   * Update a menu item
   */
  async updateMenuItem(id: number, data: Partial<MenuItem>) {
    const menuItem = await MenuItem.findOrFail(id)
    menuItem.merge(data)
    await menuItem.save()

    // Update the page title if label changed
    if (data.label) {
      const page = await MenuPage.findBy('menuItemId', id)
      if (page) {
        page.title = data.label
        await page.save()
      }
    }

    return this.findMenuItemById(id)
  }

  /**
   * Delete a menu item (page is deleted by cascade)
   */
  async deleteMenuItem(id: number) {
    const menuItem = await MenuItem.findOrFail(id)
    await menuItem.delete()
  }

  /**
   * Get a menu page by ID
   */
  async findMenuPageById(id: number) {
    return MenuPage.query().where('id', id).preload('menuItem').firstOrFail()
  }

  /**
   * Get a menu page by menu item ID
   */
  async findMenuPageByMenuItemId(menuItemId: number) {
    return MenuPage.query().where('menuItemId', menuItemId).preload('menuItem').firstOrFail()
  }

  /**
   * Update a menu page
   */
  async updateMenuPage(id: number, data: Partial<MenuPage>) {
    const page = await MenuPage.findOrFail(id)
    page.merge(data)
    await page.save()
    return page
  }
}
