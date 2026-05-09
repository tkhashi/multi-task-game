export interface RandomPort {
  next(): number;
}

export const mathRandom: RandomPort = {
  next: () => Math.random(),
};
