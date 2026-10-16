/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the Next.js server instance starts up.
 * Polyfills missing browser DOM globals in Node.js server runtime to prevent SSR crashes
 * from client-centric libraries like PDF.js (DOMMatrix, Path2D).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (typeof globalThis.DOMMatrix === 'undefined') {
      class DOMMatrix {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;
        m11 = 1;
        m12 = 0;
        m13 = 0;
        m14 = 0;
        m21 = 0;
        m22 = 1;
        m23 = 0;
        m24 = 0;
        m31 = 0;
        m32 = 0;
        m33 = 1;
        m34 = 0;
        m41 = 0;
        m42 = 0;
        m43 = 0;
        m44 = 1;
        is2D = true;
        isIdentity = true;

        constructor(init?: string | number[]) {
          if (Array.isArray(init) && init.length === 6) {
            this.a = init[0];
            this.b = init[1];
            this.c = init[2];
            this.d = init[3];
            this.e = init[4];
            this.f = init[5];
          }
        }

        multiply() {
          return this;
        }
        translate() {
          return this;
        }
        scale() {
          return this;
        }
        rotate() {
          return this;
        }
        transformPoint(point?: { x: number; y: number }) {
          return point || { x: 0, y: 0 };
        }
        inverse() {
          return this;
        }
        toFloat32Array() {
          return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }
        toFloat64Array() {
          return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }
      }

      globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
    }

    if (typeof globalThis.Path2D === 'undefined') {
      class Path2D {
        addPath() {}
        closePath() {}
        moveTo() {}
        lineTo() {}
        bezierCurveTo() {}
        quadraticCurveTo() {}
        arc() {}
        arcTo() {}
        ellipse() {}
        rect() {}
      }
      globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D;
    }
  }
}
