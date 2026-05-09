import type { CleanupStorageKind, FieldPosition } from '../TaskTypes';

export const CLEANUP_FIELD_BOUNDS = {
  minX: 0,
  maxX: 10,
  minY: 0,
  maxY: 6,
} as const;

export const CLEANUP_STORAGE_POSITIONS: Record<CleanupStorageKind, FieldPosition> = {
  basket: { x: 1.5, y: 1.5 },
  box: { x: 8.4, y: 1.4 },
  kitchen: { x: 8.8, y: 5.2 },
};

export function normalizeCleanupPosition(position: FieldPosition): { x: number; y: number } {
  return {
    x:
      (position.x - CLEANUP_FIELD_BOUNDS.minX) /
      (CLEANUP_FIELD_BOUNDS.maxX - CLEANUP_FIELD_BOUNDS.minX),
    y:
      (position.y - CLEANUP_FIELD_BOUNDS.minY) /
      (CLEANUP_FIELD_BOUNDS.maxY - CLEANUP_FIELD_BOUNDS.minY),
  };
}
