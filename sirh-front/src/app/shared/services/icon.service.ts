import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS_DATA, DEFAULT_ICON, IconData } from '../data/icons.data';

@Injectable({
  providedIn: 'root'
})
export class IconService {

  constructor(private sanitizer: DomSanitizer) {}

  // Local registry for dynamically added icons
  private customIcons: { [key: string]: IconData } = {};

  /**
   * Get icon data by name (case-insensitive)
   */
  getIcon(name: string): IconData {
    const lowerName = name?.toLowerCase();
    // Check custom icons first, then shared data
    const customIcon = this.customIcons[lowerName];
    if (customIcon) {
      return customIcon;
    }
    const sharedIcon = ICONS_DATA[lowerName];
    if (sharedIcon) {
      return { svg: sharedIcon.svg, viewBox: sharedIcon.viewBox };
    }
    return DEFAULT_ICON;
  }

  /**
   * Get safe SVG HTML for an icon
   */
  getIconSvg(name: string): SafeHtml {
    const icon = this.getIcon(name);
    return this.sanitizer.bypassSecurityTrustHtml(icon.svg);
  }

  /**
   * Get viewBox for an icon
   */
  getIconViewBox(name: string): string {
    const icon = this.getIcon(name);
    return icon.viewBox;
  }

  /**
   * Check if an icon exists (case-insensitive)
   */
  hasIcon(name: string): boolean {
    const lowerName = name?.toLowerCase();
    return lowerName in this.customIcons || lowerName in ICONS_DATA;
  }

  /**
   * Register a new icon (for dynamic additions)
   */
  registerIcon(name: string, svg: string, viewBox: string = '0 0 24 24'): void {
    this.customIcons[name.toLowerCase()] = { svg, viewBox };
  }
}
