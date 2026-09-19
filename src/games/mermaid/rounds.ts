export type ObjectKind = 'pink-shell' | 'yellow-shell' | 'teal-shell' | 'purple-spiral' | 'pink-spiral' | 'orange-spiral' | 'pearl' | 'star' | 'sand-dollar' | 'teal-spiral' | 'conch' | 'gem';
export type Mode = 'count' | 'number' | 'pattern' | 'add' | 'subtract' | 'match' | 'compare' | 'sort';

export interface Choice { label?: string; objects?: ObjectKind[]; answer: boolean; }
export interface Round {
  mode: Mode;
  title: string;
  prompt: string;
  objects: ObjectKind[];
  choices: Choice[];
  sequence?: ObjectKind[];
  target?: ObjectKind;
  secondGroup?: ObjectKind[];
  remove?: number;
  sortTargets?: number[];
}

const kinds: ObjectKind[] = ['pink-shell', 'yellow-shell', 'teal-shell', 'purple-spiral', 'pink-spiral', 'orange-spiral', 'pearl', 'star', 'sand-dollar', 'teal-spiral', 'conch', 'gem'];
const simpleKinds: ObjectKind[] = ['pink-shell', 'yellow-shell', 'teal-shell', 'purple-spiral', 'pearl', 'star'];
const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffled = <T>(items: T[]): T[] => [...items].sort(() => Math.random() - .5);
const repeat = (kind: ObjectKind, count: number): ObjectKind[] => Array.from({ length: count }, () => kind);
const shapeFamily = (kind: ObjectKind): string => kind.endsWith('shell') ? 'scallop' : kind.includes('spiral') ? 'spiral' : kind;
const numberChoices = (answer: number, max: number): Choice[] => {
  const values = new Set([answer]);
  while (values.size < Math.min(3, max)) values.add(Math.max(1, Math.min(max, answer + Math.floor(Math.random() * 5) - 2)));
  return shuffled([...values]).map(value => ({ label: `${value}`, answer: value === answer }));
};

export function createRound(level: number, previous?: Mode, forcedMode?: Mode): Round {
  const max = level < 2 ? 3 : level < 5 ? 5 : level < 8 ? 7 : 10;
  const available: Mode[] = level < 2 ? ['count', 'number', 'match'] : level < 4
    ? ['count', 'number', 'pattern', 'match', 'compare']
    : ['count', 'number', 'pattern', 'add', 'subtract', 'match', 'compare', 'sort'];
  const mode = forcedMode ?? pick(available.filter(value => value !== previous));
  const kind = pick(simpleKinds);
  const count = 1 + Math.floor(Math.random() * max);

  if (mode === 'count') return {
    mode, title: 'Counting Cove', prompt: `How many ${kind.includes('shell') ? 'shells' : kind === 'pearl' ? 'pearls' : 'starfish'} can you see?`,
    objects: repeat(kind, count), choices: numberChoices(count, max)
  };
  if (mode === 'number') {
    const answers = shuffled([count, ...shuffled(Array.from({ length: max }, (_, index) => index + 1).filter(n => n !== count)).slice(0, 2)]);
    const numberKind = pick(['teal-shell', 'purple-spiral', 'pearl', 'star'] as ObjectKind[]);
    return { mode, title: 'Number Lagoon', prompt: `Which group has ${count}?`, objects: [], choices: answers.map(n => ({ objects: repeat(numberKind, n), answer: n === count })) };
  }
  if (mode === 'pattern') {
    const a = pick(simpleKinds); const b = pick(simpleKinds.filter(value => value !== a));
    const c = level > 6 && Math.random() > .5 ? pick(simpleKinds.filter(value => value !== a && value !== b)) : undefined;
    const base = c ? [a, b, c] : [a, b]; const length = level > 4 ? 5 : 4;
    const sequence = Array.from({ length }, (_, index) => base[index % base.length]);
    const target = base[length % base.length];
    return { mode, title: 'Pattern Reef', prompt: 'What comes next in the pattern?', objects: [], sequence, target, choices: shuffled([target, ...shuffled(simpleKinds.filter(value => value !== target)).slice(0, 2)]).map(value => ({ objects: [value], answer: value === target })) };
  }
  if (mode === 'add') {
    const first = Math.max(1, Math.floor(Math.random() * Math.min(5, max - 1)) + 1); const second = level > 6 ? Math.max(1, Math.min(3, max - first)) : 1;
    return { mode, title: 'Adding Bay', prompt: `There are ${first}. ${second} more join them. How many altogether?`, objects: repeat(kind, first), secondGroup: repeat(kind, second), choices: numberChoices(first + second, max) };
  }
  if (mode === 'subtract') {
    const total = Math.max(2, count); const remove = level > 6 ? Math.min(total - 1, 2 + Math.floor(Math.random() * 2)) : 1;
    return { mode, title: 'Pearl Hideaway', prompt: `There are ${total}. ${remove} swim away. How many are left?`, objects: repeat(kind, total), remove, choices: numberChoices(total - remove, max) };
  }
  if (mode === 'match') {
    const necklaceKinds: ObjectKind[] = ['pink-shell', 'pearl', 'star', 'gem'];
    const target = forcedMode === 'match' ? pick(necklaceKinds) : pick(kinds); const usedFamilies = new Set([shapeFamily(target)]);
    const distractors = shuffled(kinds).filter(value => { const family = shapeFamily(value); if (usedFamilies.has(family)) return false; usedFamilies.add(family); return true; }).slice(0, level > 4 ? 3 : 2);
    return { mode, title: 'Matching Grotto', prompt: 'Find the one that matches!', objects: [], target, choices: shuffled([target, ...distractors]).map(value => ({ objects: [value], answer: value === target })) };
  }
  if (mode === 'compare') {
    const first = Math.max(1, count); let second = Math.max(1, Math.floor(Math.random() * max) + 1); if (second === first) second = first === max ? first - 1 : first + 1;
    const wantMore = Math.random() > .5;
    return { mode, title: 'Compare Cove', prompt: `Which group has ${wantMore ? 'more' : 'fewer'}?`, objects: repeat(kind, first), secondGroup: repeat(pick(simpleKinds.filter(value => value !== kind)), second), choices: [{ label: 'left', answer: wantMore ? first > second : first < second }, { label: 'right', answer: wantMore ? second > first : second < first }] };
  }
  const target = pick(simpleKinds); const distractor = pick(simpleKinds.filter(value => value !== target));
  const objects = shuffled([...repeat(target, 2 + Math.floor(Math.random() * 3)), ...repeat(distractor, 2 + Math.floor(Math.random() * 3))]);
  return { mode: 'sort', title: 'Sorting Garden', prompt: `Tap every ${target.includes('shell') ? 'shell like this' : target === 'pearl' ? 'pearl' : 'starfish'}!`, objects, target, choices: [], sortTargets: objects.map((value, index) => value === target ? index : -1).filter(index => index >= 0) };
}

export const worldBridgePrompts = [
  'At home, can you find three things and put them together?',
  'Can you show someone at home five fingers?',
  'Can you find something round at home or nearby?',
  'Can you find three blue things at home?',
  'Stand somewhere safe and clap four times.',
  'Nearby, can you find one small thing and one big thing?',
  'Put two toys in front of you. Add one more. How many are there now?',
  'Can you find two things that are the same colour?',
  'Can you find one soft thing and one hard thing?',
  'Can you find something fluffy and something smooth?',
  'Can you find something that makes a quiet sound?',
  'Can you find something green at home or nearby?',
  'Can you find a matching pair, like two socks or two shoes?',
  'Can you find something tiny and something enormous?',
  'Can you find something rough and something slippery?',
  'Pretend to be a mermaid. Gently swish your arms like waves three times.',
  'Pretend your hands are little fish. Can they swim in a circle?',
  'Can you find two things that belong together?',
  'Can you find something with spots and something with stripes?',
  'Show someone three fingers, then two fingers. How many fingers did you show altogether?',
  'Find a book. Is it bigger or smaller than your hand?',
  'Can you take three steps, then two more steps?',
  'Tap your knees, clap, tap your knees, clap. Can you copy that pattern?',
  'Find something shaped like a circle and something shaped like a rectangle.',
  'Can you collect four socks or four blocks into one little group?',
  'Find two cups. Put one beside the other. Are they the same size?',
  'Can you find something red, something blue, and something yellow?',
  'Give someone at home two high-fives, then one more. How many high-fives was that?'
];
