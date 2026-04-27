export type NoteColor =
  | 'cyan-1'
  | 'cyan-2'
  | 'mint-1'
  | 'mint-2'
  | 'yellow-1'
  | 'lavender-1'
  | 'pink-1'
  | 'purple-1';


export const NOTE_COLOR_MAP: Record<
  NoteColor,
  {
    bg: string;
    text: string;
    border?: string;
  }
> = {
  'cyan-1': {
    bg: '#B3EBF2',
    text: '#134E4A',
  },
  'cyan-2': {
    bg: '#85D1DB',
    text: '#083344',
  },
  'mint-1': {
    bg: '#B6F2D1',
    text: '#064E3B',
  },
  'mint-2': {
    bg: '#C9FDF2',
    text: '#115E59',
  },
  'yellow-1': {
    bg: '#FFFFC5',
    text: '#713F12',
  },
  'lavender-1': {
    bg: '#CEC4FF',
    text: '#3730A3',
  },
  'pink-1': {
    bg: '#F4C4FF',
    text: '#701A75',
  },
  'purple-1': {
    bg: '#754480',
    text: '#FAE8FF',
  },
};

export const NOTE_COLOR_CYCLE = Object.keys(NOTE_COLOR_MAP) as NoteColor[];
