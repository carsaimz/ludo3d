import type { ColorId } from '../engine/types';

/** Paleta fiel ao estilo Ludo King */
export const COLOR_HEX: Record<ColorId, string> = {
  red: '#f24537',
  green: '#4caf50',
  yellow: '#ffd23f',
  blue: '#2196f3'
};

export const COLOR_NAME: Record<ColorId, string> = {
  red: 'Vermelho',
  green: 'Verde',
  yellow: 'Amarelo',
  blue: 'Azul'
};

/** Versão mais escura para plataformas/bordas */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
