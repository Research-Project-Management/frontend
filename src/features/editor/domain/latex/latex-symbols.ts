/**
 * latex-symbols.ts
 *
 * Domain layer: Canonical LaTeX Math Symbols Dictionary.
 * Single source of truth for SymbolPaletteModal and VisualMathSymbolPalette.
 */

export type ModalSymbolCategory =
  | 'greek-lower'
  | 'greek-upper'
  | 'operators'
  | 'relations'
  | 'arrows'
  | 'delimiters';

export type VisualSymbolCategory =
  | 'basic'
  | 'greek'
  | 'operators'
  | 'arrows'
  | 'matrix';

export interface CanonicalMathSymbol {
  id: string;
  command: string;
  display: string;
  name: string;
  modalCategory: ModalSymbolCategory;
  visualCategory?: VisualSymbolCategory;
  previewLatex?: string;
  keywords: string[];
  requiredPackage?: string;
}

export interface MathSymbol {
  command: string;
  display: string;
  name: string;
  category: ModalSymbolCategory;
  requiredPackage?: string;
}

export const CANONICAL_MATH_SYMBOLS: CanonicalMathSymbol[] = [
  // ── Basic Operations & Delimiters ──
  { id: 'frac', command: '\\frac{a}{b}', display: 'a/b', previewLatex: '\\frac{a}{b}', name: 'Fraction', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['frac', 'division', 'over'] },
  { id: 'sqrt', command: '\\sqrt{x}', display: '√x', previewLatex: '\\sqrt{x}', name: 'Square Root', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['sqrt', 'root'] },
  { id: 'nth-sqrt', command: '\\sqrt[n]{x}', display: 'ⁿ√x', previewLatex: '\\sqrt[n]{x}', name: 'N-th Root', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['root', 'radical', 'cbrt'] },
  { id: 'pow', command: 'x^{2}', display: 'x²', previewLatex: 'x^{2}', name: 'Superscript', modalCategory: 'operators', visualCategory: 'basic', keywords: ['pow', 'exponent', 'power', 'square'] },
  { id: 'sub', command: 'x_{i}', display: 'xᵢ', previewLatex: 'x_{i}', name: 'Subscript', modalCategory: 'operators', visualCategory: 'basic', keywords: ['sub', 'index'] },
  { id: 'pm', command: '\\pm', display: '±', previewLatex: '\\pm', name: 'Plus-Minus', modalCategory: 'operators', visualCategory: 'basic', keywords: ['pm', 'plus', 'minus'] },
  { id: 'mp', command: '\\mp', display: '∓', previewLatex: '\\mp', name: 'Minus-Plus', modalCategory: 'operators', visualCategory: 'basic', keywords: ['mp', 'minus', 'plus'] },
  { id: 'times', command: '\\times', display: '×', previewLatex: '\\times', name: 'Multiply', modalCategory: 'operators', visualCategory: 'basic', keywords: ['times', 'multiply', 'x'] },
  { id: 'div', command: '\\div', display: '÷', previewLatex: '\\div', name: 'Divide', modalCategory: 'operators', visualCategory: 'basic', keywords: ['div', 'divide'] },
  { id: 'cdot', command: '\\cdot', display: '·', previewLatex: '\\cdot', name: 'Center Dot', modalCategory: 'operators', visualCategory: 'basic', keywords: ['dot', 'multiply', 'point'] },
  { id: 'ast', command: '\\ast', display: '∗', previewLatex: '\\ast', name: 'Asterisk', modalCategory: 'operators', visualCategory: 'basic', keywords: ['ast', 'star', 'multiply'] },
  { id: 'circ', command: '\\circ', display: '∘', previewLatex: '\\circ', name: 'Compose Circle', modalCategory: 'operators', visualCategory: 'basic', keywords: ['compose', 'circle'] },
  { id: 'bullet', command: '\\bullet', display: '•', previewLatex: '\\bullet', name: 'Bullet', modalCategory: 'operators', visualCategory: 'basic', keywords: ['bullet', 'dot'] },
  { id: 'oplus', command: '\\oplus', display: '⊕', previewLatex: '\\oplus', name: 'Direct Sum', modalCategory: 'operators', visualCategory: 'operators', keywords: ['oplus', 'direct sum'] },
  { id: 'otimes', command: '\\otimes', display: '⊗', previewLatex: '\\otimes', name: 'Tensor Product', modalCategory: 'operators', visualCategory: 'operators', keywords: ['otimes', 'tensor product'] },
  { id: 'neq', command: '\\neq', display: '≠', previewLatex: '\\neq', name: 'Not Equal', modalCategory: 'relations', visualCategory: 'basic', keywords: ['neq', 'not equal', 'different'] },
  { id: 'leq', command: '\\leq', display: '≤', previewLatex: '\\leq', name: 'Less or Equal', modalCategory: 'relations', visualCategory: 'basic', keywords: ['leq', 'less', 'smaller'] },
  { id: 'geq', command: '\\geq', display: '≥', previewLatex: '\\geq', name: 'Greater or Equal', modalCategory: 'relations', visualCategory: 'basic', keywords: ['geq', 'greater', 'bigger'] },
  { id: 'approx', command: '\\approx', display: '≈', previewLatex: '\\approx', name: 'Approximately', modalCategory: 'relations', visualCategory: 'basic', keywords: ['approx', 'almost', 'tilde'] },
  { id: 'equiv', command: '\\equiv', display: '≡', previewLatex: '\\equiv', name: 'Equivalent', modalCategory: 'relations', visualCategory: 'basic', keywords: ['equiv', 'identity'] },
  { id: 'sim', command: '\\sim', display: '∼', previewLatex: '\\sim', name: 'Similar', modalCategory: 'relations', visualCategory: 'basic', keywords: ['sim', 'similar', 'tilde'] },
  { id: 'infty', command: '\\infty', display: '∞', previewLatex: '\\infty', name: 'Infinity', modalCategory: 'operators', visualCategory: 'basic', keywords: ['infty', 'infinite', 'loop'] },
  { id: 'parens', command: '\\left( x \\right)', display: '(x)', previewLatex: '(x)', name: 'Parentheses', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['parens', 'left', 'right'] },
  { id: 'brackets', command: '\\left[ x \\right]', display: '[x]', previewLatex: '[x]', name: 'Brackets', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['brackets', 'square'] },
  { id: 'braces', command: '\\left\\{ x \\right\\}', display: '{x}', previewLatex: '\\{x\\}', name: 'Braces', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['braces', 'set'] },
  { id: 'abs', command: '\\left| x \\right|', display: '|x|', previewLatex: '|x|', name: 'Absolute Value', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['abs', 'norm', 'modulus'] },
  { id: 'langle', command: '\\left\\langle x \\right\\rangle', display: '⟨x⟩', previewLatex: '\\langle x \\rangle', name: 'Angle Brackets', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['angle', 'bracket', 'inner product'] },
  { id: 'lfloor', command: '\\left\\lfloor x \\right\\rfloor', display: '⌊x⌋', previewLatex: '\\lfloor x \\rfloor', name: 'Floor', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['floor'] },
  { id: 'lceil', command: '\\left\\lceil x \\right\\rceil', display: '⌈x⌉', previewLatex: '\\lceil x \\rceil', name: 'Ceiling', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['ceiling', 'ceil'] },
  { id: 'vec', command: '\\vec{v}', display: 'v⃗', previewLatex: '\\vec{v}', name: 'Vector', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['vec', 'vector', 'arrow'] },
  { id: 'hat', command: '\\hat{x}', display: 'x̂', previewLatex: '\\hat{x}', name: 'Hat Accent', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['hat', 'accent'] },
  { id: 'bar', command: '\\bar{x}', display: 'x̄', previewLatex: '\\bar{x}', name: 'Bar Accent', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['bar', 'average', 'mean'] },
  { id: 'dot', command: '\\dot{x}', display: 'ẋ', previewLatex: '\\dot{x}', name: 'Dot Derivative', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['dot', 'derivative'] },
  { id: 'ddot', command: '\\ddot{x}', display: 'ẍ', previewLatex: '\\ddot{x}', name: 'Double Dot Derivative', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['ddot', 'second derivative'] },
  { id: 'tilde', command: '\\tilde{x}', display: 'x̃', previewLatex: '\\tilde{x}', name: 'Tilde', modalCategory: 'delimiters', visualCategory: 'basic', keywords: ['tilde'] },

  // ── Greek Lowercase ──
  { id: 'alpha', command: '\\alpha', display: 'α', name: 'alpha', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['alpha', 'greek'] },
  { id: 'beta', command: '\\beta', display: 'β', name: 'beta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['beta', 'greek'] },
  { id: 'gamma', command: '\\gamma', display: 'γ', name: 'gamma', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['gamma', 'greek'] },
  { id: 'delta', command: '\\delta', display: 'δ', name: 'delta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['delta', 'greek'] },
  { id: 'epsilon', command: '\\epsilon', display: 'ϵ', name: 'epsilon', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['epsilon', 'greek'] },
  { id: 'varepsilon', command: '\\varepsilon', display: 'ε', name: 'varepsilon', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['varepsilon', 'greek'] },
  { id: 'zeta', command: '\\zeta', display: 'ζ', name: 'zeta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['zeta', 'greek'] },
  { id: 'eta', command: '\\eta', display: 'η', name: 'eta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['eta', 'greek'] },
  { id: 'theta', command: '\\theta', display: 'θ', name: 'theta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['theta', 'angle'] },
  { id: 'vartheta', command: '\\vartheta', display: 'ϑ', name: 'vartheta', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['vartheta', 'greek'] },
  { id: 'iota', command: '\\iota', display: 'ι', name: 'iota', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['iota', 'greek'] },
  { id: 'kappa', command: '\\kappa', display: 'κ', name: 'kappa', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['kappa', 'greek'] },
  { id: 'lambda', command: '\\lambda', display: 'λ', name: 'lambda', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['lambda', 'wavelength'] },
  { id: 'mu', command: '\\mu', display: 'μ', name: 'mu', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['mu', 'micro'] },
  { id: 'nu', command: '\\nu', display: 'ν', name: 'nu', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['nu', 'greek'] },
  { id: 'xi', command: '\\xi', display: 'ξ', name: 'xi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['xi', 'greek'] },
  { id: 'pi', command: '\\pi', display: 'π', name: 'pi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['pi', '3.14'] },
  { id: 'varpi', command: '\\varpi', display: 'ϖ', name: 'varpi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['varpi', 'greek'] },
  { id: 'rho', command: '\\rho', display: 'ρ', name: 'rho', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['rho', 'density'] },
  { id: 'varrho', command: '\\varrho', display: 'ϱ', name: 'varrho', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['varrho', 'greek'] },
  { id: 'sigma', command: '\\sigma', display: 'σ', name: 'sigma', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['sigma', 'std'] },
  { id: 'varsigma', command: '\\varsigma', display: 'ς', name: 'varsigma', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['varsigma', 'greek'] },
  { id: 'tau', command: '\\tau', display: 'τ', name: 'tau', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['tau', 'time'] },
  { id: 'upsilon', command: '\\upsilon', display: 'υ', name: 'upsilon', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['upsilon', 'greek'] },
  { id: 'phi', command: '\\phi', display: 'ϕ', name: 'phi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['phi', 'angle'] },
  { id: 'varphi', command: '\\varphi', display: 'φ', name: 'varphi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['varphi', 'golden ratio'] },
  { id: 'chi', command: '\\chi', display: 'χ', name: 'chi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['chi', 'greek'] },
  { id: 'psi', command: '\\psi', display: 'ψ', name: 'psi', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['psi', 'wavefunction'] },
  { id: 'omega', command: '\\omega', display: 'ω', name: 'omega', modalCategory: 'greek-lower', visualCategory: 'greek', keywords: ['omega', 'frequency'] },

  // ── Greek Uppercase ──
  { id: 'Gamma', command: '\\Gamma', display: 'Γ', name: 'Gamma', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['gamma', 'capital'] },
  { id: 'Delta', command: '\\Delta', display: 'Δ', name: 'Delta', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['delta', 'laplace', 'difference'] },
  { id: 'Theta', command: '\\Theta', display: 'Θ', name: 'Theta', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['theta', 'capital'] },
  { id: 'Lambda', command: '\\Lambda', display: 'Λ', name: 'Lambda', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['lambda', 'capital'] },
  { id: 'Xi', command: '\\Xi', display: 'Ξ', name: 'Xi', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['xi', 'capital'] },
  { id: 'Pi', command: '\\Pi', display: 'Π', name: 'Pi', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['pi', 'product', 'capital'] },
  { id: 'Sigma', command: '\\Sigma', display: 'Σ', name: 'Sigma', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['sigma', 'summation', 'capital'] },
  { id: 'Upsilon', command: '\\Upsilon', display: 'Υ', name: 'Upsilon', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['upsilon', 'capital'] },
  { id: 'Phi', command: '\\Phi', display: 'Φ', name: 'Phi', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['phi', 'capital'] },
  { id: 'Psi', command: '\\Psi', display: 'Ψ', name: 'Psi', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['psi', 'capital'] },
  { id: 'Omega', command: '\\Omega', display: 'Ω', name: 'Omega', modalCategory: 'greek-upper', visualCategory: 'greek', keywords: ['omega', 'ohm', 'capital'] },

  // ── Calculus & Big Operators ──
  { id: 'int', command: '\\int_{a}^{b} f(x)\\,dx', display: '∫', previewLatex: '\\int', name: 'Definite Integral', modalCategory: 'operators', visualCategory: 'operators', keywords: ['integral', 'calculus', 'int'] },
  { id: 'iint', command: '\\iint_{D} f(x,y)\\,dx\\,dy', display: '∬', previewLatex: '\\iint', name: 'Double Integral', modalCategory: 'operators', visualCategory: 'operators', keywords: ['double', 'integral', 'iint'], requiredPackage: 'amsmath' },
  { id: 'iiint', command: '\\iiint', display: '∭', previewLatex: '\\iiint', name: 'Triple Integral', modalCategory: 'operators', visualCategory: 'operators', keywords: ['triple', 'integral'], requiredPackage: 'amsmath' },
  { id: 'oint', command: '\\oint_{\\gamma} f(z)\\,dz', display: '∮', previewLatex: '\\oint', name: 'Contour Integral', modalCategory: 'operators', visualCategory: 'operators', keywords: ['contour', 'integral', 'line'] },
  { id: 'sum', command: '\\sum_{i=1}^{n}', display: '∑', previewLatex: '\\sum', name: 'Summation', modalCategory: 'operators', visualCategory: 'operators', keywords: ['sum', 'summation', 'sigma', 'series'] },
  { id: 'prod', command: '\\prod_{i=1}^{n}', display: '∏', previewLatex: '\\prod', name: 'Product', modalCategory: 'operators', visualCategory: 'operators', keywords: ['product', 'prod', 'pi'] },
  { id: 'coprod', command: '\\coprod', display: '∐', previewLatex: '\\coprod', name: 'Coproduct', modalCategory: 'operators', visualCategory: 'operators', keywords: ['coprod', 'coproduct'] },
  { id: 'lim', command: '\\lim_{x \\to 0}', display: 'lim', previewLatex: '\\lim', name: 'Limit', modalCategory: 'operators', visualCategory: 'operators', keywords: ['lim', 'limit', 'asymptotic'] },
  { id: 'partial', command: '\\frac{\\partial y}{\\partial x}', display: '∂', previewLatex: '\\partial', name: 'Partial Derivative', modalCategory: 'operators', visualCategory: 'operators', keywords: ['partial', 'derivative', 'gradient'] },
  { id: 'nabla', command: '\\nabla', display: '∇', previewLatex: '\\nabla', name: 'Nabla (Gradient)', modalCategory: 'operators', visualCategory: 'operators', keywords: ['nabla', 'del', 'gradient', 'divergence', 'curl'] },

  // ── Relations & Sets ──
  { id: 'in', command: '\\in', display: '∈', previewLatex: '\\in', name: 'Element of', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['in', 'element', 'belongs', 'set'] },
  { id: 'notin', command: '\\notin', display: '∉', previewLatex: '\\notin', name: 'Not in', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['notin', 'not in', 'set'] },
  { id: 'ni', command: '\\ni', display: '∋', previewLatex: '\\ni', name: 'Contains', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['ni', 'contains', 'owns'] },
  { id: 'subset', command: '\\subset', display: '⊂', previewLatex: '\\subset', name: 'Subset', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['subset', 'set'] },
  { id: 'supset', command: '\\supset', display: '⊃', previewLatex: '\\supset', name: 'Superset', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['supset', 'superset', 'set'] },
  { id: 'subseteq', command: '\\subseteq', display: '⊆', previewLatex: '\\subseteq', name: 'Subset or Equal', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['subseteq', 'set'] },
  { id: 'supseteq', command: '\\supseteq', display: '⊇', previewLatex: '\\supseteq', name: 'Superset or Equal', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['supseteq', 'set'] },
  { id: 'cap', command: '\\cap', display: '∩', previewLatex: '\\cap', name: 'Intersection', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['cap', 'intersection', 'and', 'set'] },
  { id: 'cup', command: '\\cup', display: '∪', previewLatex: '\\cup', name: 'Union', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['cup', 'union', 'or', 'set'] },
  { id: 'emptyset', command: '\\emptyset', display: '∅', previewLatex: '\\emptyset', name: 'Empty Set', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['emptyset', 'empty', 'null'] },
  { id: 'propto', command: '\\propto', display: '∝', previewLatex: '\\propto', name: 'Proportional to', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['propto', 'proportional'] },
  { id: 'perp', command: '\\perp', display: '⊥', previewLatex: '\\perp', name: 'Perpendicular', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['perp', 'perpendicular', 'orthogonal'] },
  { id: 'parallel', command: '\\parallel', display: '∥', previewLatex: '\\parallel', name: 'Parallel', modalCategory: 'relations', visualCategory: 'arrows', keywords: ['parallel'] },

  // ── Arrows & Logic ──
  { id: 'to', command: '\\to', display: '→', previewLatex: '\\to', name: 'Right Arrow', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['to', 'arrow', 'right', 'limit'] },
  { id: 'leftarrow', command: '\\leftarrow', display: '←', previewLatex: '\\leftarrow', name: 'Left Arrow', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['leftarrow', 'left'] },
  { id: 'leftrightarrow', command: '\\leftrightarrow', display: '↔', previewLatex: '\\leftrightarrow', name: 'Left-Right Arrow', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['leftrightarrow', 'both'] },
  { id: 'implies', command: '\\implies', display: '⇒', previewLatex: '\\implies', name: 'Implies', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['implies', 'implication', 'arrow'], requiredPackage: 'amsmath' },
  { id: 'iff', command: '\\iff', display: '⇔', previewLatex: '\\iff', name: 'If and only if', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['iff', 'equivalence', 'arrow'], requiredPackage: 'amsmath' },
  { id: 'mapsto', command: '\\mapsto', display: '↦', previewLatex: '\\mapsto', name: 'Maps To', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['mapsto', 'maps', 'function'] },
  { id: 'uparrow', command: '\\uparrow', display: '↑', previewLatex: '\\uparrow', name: 'Up Arrow', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['uparrow', 'up'] },
  { id: 'downarrow', command: '\\downarrow', display: '↓', previewLatex: '\\downarrow', name: 'Down Arrow', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['downarrow', 'down'] },
  { id: 'forall', command: '\\forall', display: '∀', previewLatex: '\\forall', name: 'For All', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['forall', 'all', 'universal', 'logic'] },
  { id: 'exists', command: '\\exists', display: '∃', previewLatex: '\\exists', name: 'There Exists', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['exists', 'there exists', 'logic'] },
  { id: 'neg', command: '\\neg', display: '¬', previewLatex: '\\neg', name: 'Negation', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['neg', 'not', 'negation'] },
  { id: 'land', command: '\\land', display: '∧', previewLatex: '\\land', name: 'Logical And', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['land', 'and', 'wedge'] },
  { id: 'lor', command: '\\lor', display: '∨', previewLatex: '\\lor', name: 'Logical Or', modalCategory: 'arrows', visualCategory: 'arrows', keywords: ['lor', 'or', 'vee'] },

  // ── AMS Symbols ──
  { id: 'mathbb-R', command: '\\mathbb{R}', display: 'ℝ', previewLatex: '\\mathbb{R}', name: 'Real Numbers (R)', modalCategory: 'operators', visualCategory: 'basic', keywords: ['mathbb', 'real', 'numbers', 'set'], requiredPackage: 'amssymb' },
  { id: 'blacksquare', command: '\\blacksquare', display: '■', previewLatex: '\\blacksquare', name: 'Black Square (QED)', modalCategory: 'operators', visualCategory: 'basic', keywords: ['qed', 'square', 'proof'], requiredPackage: 'amssymb' },
  { id: 'checkmark', command: '\\checkmark', display: '✓', previewLatex: '\\checkmark', name: 'Checkmark', modalCategory: 'operators', visualCategory: 'basic', keywords: ['check', 'tick'], requiredPackage: 'amssymb' },

  // ── Matrices & Advanced Environments ──
  { id: 'pmatrix', command: '\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}', display: '(matrix)', previewLatex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', name: '2x2 Matrix', modalCategory: 'operators', visualCategory: 'matrix', keywords: ['matrix', 'pmatrix', 'round', '2x2'], requiredPackage: 'amsmath' },
  { id: 'bmatrix', command: '\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}', display: '[matrix]', previewLatex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', name: 'Bracket Matrix', modalCategory: 'operators', visualCategory: 'matrix', keywords: ['matrix', 'bmatrix', 'square', '2x2'], requiredPackage: 'amsmath' },
  { id: 'vmatrix', command: '\\begin{vmatrix}\n  a & b \\\\\n  c & d\n\\end{vmatrix}', display: '|det|', previewLatex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', name: 'Determinant Matrix', modalCategory: 'operators', visualCategory: 'matrix', keywords: ['matrix', 'vmatrix', 'det', 'determinant'], requiredPackage: 'amsmath' },
  { id: 'cases', command: '\\begin{cases}\n  x, & \\text{if } x > 0 \\\\\n  -x, & \\text{otherwise}\n\\end{cases}', display: '{cases', previewLatex: '\\begin{cases} a \\\\ b \\end{cases}', name: 'Piecewise Cases', modalCategory: 'delimiters', visualCategory: 'matrix', keywords: ['cases', 'piecewise', 'condition'], requiredPackage: 'amsmath' },
  { id: 'aligned', command: '\\begin{aligned}\n  a &= b + c \\\\\n  &= d + e\n\\end{aligned}', display: 'align', previewLatex: '\\begin{aligned} a &= b \\\\ &= c \\end{aligned}', name: 'Aligned Equations', modalCategory: 'delimiters', visualCategory: 'matrix', keywords: ['aligned', 'align', 'multiline', 'equation'], requiredPackage: 'amsmath' },
];

/**
 * Returns formatted symbols for SymbolPaletteModal
 */
export function getModalSymbols(): MathSymbol[] {
  return CANONICAL_MATH_SYMBOLS.map((s) => ({
    command: s.command,
    display: s.display,
    name: s.name,
    category: s.modalCategory,
    requiredPackage: s.requiredPackage,
  }));
}

/**
 * Returns formatted symbols for VisualMathSymbolPalette
 */
export function getVisualSymbols() {
  return CANONICAL_MATH_SYMBOLS.map((s) => ({
    id: s.id,
    latex: s.command,
    previewLatex: s.previewLatex || s.command,
    name: s.name,
    category: s.visualCategory || 'operators',
    keywords: s.keywords,
  }));
}
