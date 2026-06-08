export const ICONS = {
  bluetooth:
    '<path d="M7 7l10 10-5 4V3l5 4L7 17"/><path d="M7 7l10 10"/><path d="M7 17l10-10"/>',
  plug: '<path d="M7 7v5a5 5 0 0 0 10 0V7"/><path d="M9 3v4"/><path d="M15 3v4"/><path d="M12 17v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  power: '<path d="M12 3v8"/><path d="M6.8 6.8a8 8 0 1 0 10.4 0"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  play: '<path d="M8 5v14l11-7-11-7z"/>',
  send: '<path d="M3 11l18-8-8 18-2-7-8-3z"/><path d="M11 14l10-11"/>',
  droplet: '<path d="M12 3s7 7.1 7 12a7 7 0 0 1-14 0c0-4.9 7-12 7-12z"/>',
  settings:
    '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  terminal: '<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>',
  refresh: '<path d="M20 12a8 8 0 0 1-13.7 5.7L4 15"/><path d="M4 20v-5h5"/><path d="M4 12A8 8 0 0 1 17.7 6.3L20 9"/><path d="M20 4v5h-5"/>',
  radio: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><rect x="3" y="3" width="13" height="13" rx="2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>'
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): string {
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${ICONS[name]}</svg>`;
}
