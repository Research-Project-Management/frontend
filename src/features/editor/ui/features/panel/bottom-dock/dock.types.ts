export interface ParsedLogLine {
  text: string;
  originalIndex: number;
  type: 'error' | 'warning' | 'info' | 'success' | 'asset' | 'normal';
  jumpLine?: number;
}
