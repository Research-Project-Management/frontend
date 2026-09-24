import '@testing-library/jest-dom';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';

if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}
