import type { IssueInput } from './schema';
export const mapExample =
  'After entering a vehicle and opening the map, the game sometimes freezes.';
export const templates: {
  name: string;
  description: string;
  area: IssueInput['area'];
  hint: string;
}[] = [
  {
    name: 'Crash',
    description: 'Game crashes after loading a save created in the previous version.',
    area: 'Save System',
    hint: 'Unexpected exits',
  },
  {
    name: 'UI',
    description: 'Inventory tooltip stays visible after closing the inventory.',
    area: 'UI',
    hint: 'Interface issues',
  },
  {
    name: 'Performance',
    description: 'FPS drops significantly when entering the city.',
    area: 'Performance',
    hint: 'Frame rate & stability',
  },
  {
    name: 'Save System',
    description: 'Quest progress is lost after loading an autosave.',
    area: 'Save System',
    hint: 'Progress & persistence',
  },
  {
    name: 'Audio',
    description: 'NPC dialogue audio stops playing after skipping several dialogue lines.',
    area: 'Audio',
    hint: 'Sound & dialogue',
  },
];
