import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'highlight'
})
export class HighlightPipe implements PipeTransform {
  transform(text: string | null | undefined, search: string): string {
    if (!text) return '';
    if (!search || !search.trim()) {
      return this.escapeHtml(text);
    }

    const escapedText = this.escapeHtml(text);
    const escapedSearch = this.escapeRegExp(search.trim());
    const regex = new RegExp(`(${escapedSearch})`, 'gi');

    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
