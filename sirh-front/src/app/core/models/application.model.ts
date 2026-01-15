export interface MenuItem {
  id: string;
  label: string;
  entityName?: string;
  pageId?: string;
  route?: string;
  icon?: string;
  order: number;
  active: boolean;
  applicationId: string;
}

export interface Application {
  id: string;
  name: string;
  icon?: string;
  order: number;
  active: boolean;
  menuItems?: MenuItem[];
}

export interface CreateApplicationDto {
  name: string;
  icon?: string;
  order?: number;
  active?: boolean;
}

export interface CreateMenuItemDto {
  label: string;
  entityName?: string;
  pageId?: string;
  route?: string;
  icon?: string;
  order?: number;
  active?: boolean;
  applicationId: string;
}
