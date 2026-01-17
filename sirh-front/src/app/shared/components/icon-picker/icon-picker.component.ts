import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconOption, IconCategory, ICON_CATEGORIES, getIconsForPicker } from '../../data/icons.data';

@Component({
    selector: 'app-icon-picker',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './icon-picker.component.html',
    styleUrl: './icon-picker.component.css'
})
export class IconPickerComponent {
    @Input() selectedIcon: string = '';
    @Output() iconSelected = new EventEmitter<string>();

    showPicker = false;
    searchTerm = '';
    selectedCategory = '';

    constructor(private sanitizer: DomSanitizer) { }

    categories: IconCategory[] = ICON_CATEGORIES;

    icons: IconOption[] = getIconsForPicker();

    get filteredIcons(): IconOption[] {
        return this.icons.filter(icon => {
            const matchesSearch = !this.searchTerm ||
                icon.name.toLowerCase().includes(this.searchTerm.toLowerCase());
            const matchesCategory = !this.selectedCategory ||
                icon.category === this.selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }

    openPicker(): void {
        this.showPicker = true;
        this.searchTerm = '';
        this.selectedCategory = '';
    }

    closePicker(): void {
        this.showPicker = false;
    }

    selectIcon(icon: IconOption): void {
        this.selectedIcon = icon.name;
        this.iconSelected.emit(icon.name);
        this.closePicker();
    }

    clearIcon(): void {
        this.selectedIcon = '';
        this.iconSelected.emit('');
    }

    getIconSvg(iconName: string): SafeHtml {
        const icon = this.icons.find(i => i.name === iconName);
        return icon ? this.sanitizer.bypassSecurityTrustHtml(icon.svg) : '';
    }

    getSafeSvg(svg: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(svg);
    }

    getViewBox(icon: IconOption): string {
        return icon.viewBox || '0 0 24 24';
    }

    getIconViewBox(iconName: string): string {
        const icon = this.icons.find(i => i.name === iconName);
        return icon?.viewBox || '0 0 24 24';
    }
}
