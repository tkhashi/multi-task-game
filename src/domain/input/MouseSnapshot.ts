export interface MouseSnapshot {
  position: {
    x: number;
    y: number;
  };
  delta: {
    x: number;
    y: number;
  };
  buttonsDown: Array<'left' | 'middle' | 'right'>;
  wheelDelta: number;
  primaryReleased: boolean;
}

export function createIdleMouseSnapshot(): MouseSnapshot {
  return {
    position: {
      x: 0,
      y: 0,
    },
    delta: {
      x: 0,
      y: 0,
    },
    buttonsDown: [],
    wheelDelta: 0,
    primaryReleased: false,
  };
}
