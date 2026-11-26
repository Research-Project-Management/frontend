import pluginQuery from '@tanstack/eslint-plugin-query';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const designSystemPlugin = {
  rules: {
    'no-font-bold': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Enforce Flux Strict 600 Font Weight Cap (no font-bold, font-extrabold, font-black) per DESIGN.md',
        },
        schema: [],
        messages: {
          noFontBold:
            'Do not use "{{className}}". Font weight is capped at SemiBold (600 / font-semibold) per DESIGN.md (The Strict 600 Weight Cap Rule).',
        },
      },
      create(context) {
        function checkClassString(rawText, node) {
          if (!rawText || typeof rawText !== 'string') return;
          const tokens = rawText.split(/\s+/);
          for (const token of tokens) {
            if (!token) continue;
            const baseClass = token.split(':').pop();
            if (baseClass === 'font-bold' || baseClass === 'font-extrabold' || baseClass === 'font-black') {
              context.report({
                node,
                messageId: 'noFontBold',
                data: { className: token },
              });
            }
          }
        }

        return createClassVisitor(checkClassString);
      },
    },
    'no-raw-colors': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow raw Tailwind amber-* and red-* colors in favor of semantic CSS tokens (--warning, --destructive) per DESIGN.md',
        },
        schema: [],
        messages: {
          noRawColor:
            'Do not use raw Tailwind color "{{className}}". Use semantic CSS tokens (--warning, --destructive, etc.) per DESIGN.md.',
        },
      },
      create(context) {
        function checkClassString(rawText, node) {
          if (!rawText || typeof rawText !== 'string') return;
          const tokens = rawText.split(/\s+/);
          for (const token of tokens) {
            if (!token) continue;
            const baseClass = token.split(':').pop();
            if (/^(?:text|bg|border|fill|stroke|ring|outline|accent)-(?:amber|red)-\d+/.test(baseClass)) {
              context.report({
                node,
                messageId: 'noRawColor',
                data: { className: token },
              });
            }
          }
        }

        return createClassVisitor(checkClassString);
      },
    },
  },
};

function createClassVisitor(checkClassString) {
  return {
    JSXAttribute(node) {
      if (node.name && node.name.name === 'className') {
        if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
          checkClassString(node.value.value, node.value);
        } else if (
          node.value &&
          node.value.type === 'JSXExpressionContainer' &&
          node.value.expression
        ) {
          const expr = node.value.expression;
          if (expr.type === 'Literal' && typeof expr.value === 'string') {
            checkClassString(expr.value, expr);
          } else if (expr.type === 'TemplateLiteral') {
            for (const quasi of expr.quasis) {
              checkClassString(quasi.value.raw, quasi);
            }
          }
        }
      }
    },
    CallExpression(node) {
      const calleeName = node.callee && node.callee.name;
      if (calleeName === 'cn' || calleeName === 'clsx' || calleeName === 'cva') {
        for (const arg of node.arguments) {
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            checkClassString(arg.value, arg);
          } else if (arg.type === 'TemplateLiteral') {
            for (const quasi of arg.quasis) {
              checkClassString(quasi.value.raw, quasi);
            }
          }
        }
      }
    },
  };
}

const NO_BARREL_PATHS = [
  {
    name: '@/shared/components/ui',
    message:
      'Direct file imports required (e.g. @/shared/components/ui/button). Barrel imports are forbidden.',
  },
  {
    name: '@/shared/components/layout',
    message:
      'Direct file imports required (e.g. @/shared/components/layout/PageHeader). Barrel imports are forbidden.',
  },
];

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      'public/**',
      '.turbo/**',
      '.playwright/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      '*.tsbuildinfo',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'design-system': designSystemPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'design-system/no-font-bold': 'error',
      'design-system/no-raw-colors': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...pluginQuery.configs['flat/recommended'][0],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@tanstack/query/exhaustive-deps': 'warn',
      '@tanstack/query/no-rest-destructuring': 'warn',
      '@tanstack/query/stable-query-client': 'error',
      '@tanstack/query/no-unstable-deps': 'warn',
    },
  },
  {
    name: 'enforce-no-barrel-imports',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: NO_BARREL_PATHS,
        },
      ],
    },
  },
  {
    name: 'shared-and-config-no-upward-imports',
    files: ['src/shared/**/*.{ts,tsx}', 'src/config/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NO_BARREL_PATHS],
          patterns: [
            {
              group: ['@/features/**', '@/app/**', '../features/**', '../app/**', '../../features/**', '../../app/**'],
              message:
                'Architectural boundary violation: shared/ and config/ are foundational layers and must never import from features/ or app/.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'features-no-upward-app-imports',
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NO_BARREL_PATHS],
          patterns: [
            {
              group: ['@/app/**'],
              message:
                'Architectural boundary violation: features/ must never import from the app/ routing layer.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'editor-layer-domain-is-pure',
    files: ['src/features/editor/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/editor/ui/**',
                '@/features/editor/store/**',
                '@/features/editor/coordinators/**',
                '@/features/editor/sdk',
                '@/features/editor/sdk/**',
                '@/features/editor/engines/**',
                'react',
              ],
              message:
                'domain/ is the pure core: it may not import ui, store, coordinators, sdk, engines or React.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'editor-layer-engines-depend-on-domain-only',
    files: ['src/features/editor/engines/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '@/features/editor/ui/**',
                '@/features/editor/store/**',
                '@/features/editor/coordinators/**',
                '@/features/editor/sdk',
                '@/features/editor/sdk/**',
              ],
              message:
                'engines/ (CodeMirror layer) may depend on domain/ only. Inject store/sdk/coordinator access through ports.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ai-layer-types-is-pure',
    files: ['src/features/ai/types/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NO_BARREL_PATHS],
          patterns: [
            {
              group: [
                '../transport/**',
                '../engine/**',
                '../context/**',
                '../ui/**',
                'react',
                'react/**',
              ],
              message: 'features/ai/types/ must stay pure without transport, engine, context, ui, or React imports.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ai-layer-transport-no-react-or-engine',
    files: ['src/features/ai/transport/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NO_BARREL_PATHS],
          patterns: [
            {
              group: [
                '../engine/**',
                '../context/**',
                '../ui/**',
                'react',
                'react/**',
              ],
              message: 'features/ai/transport/ may depend only on types/ and shared network utilities.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ai-layer-ui-no-direct-transport',
    files: ['src/features/ai/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NO_BARREL_PATHS],
          patterns: [
            {
              group: [
                '../transport/**',
                '../../transport/**',
                '@/features/ai/transport/**',
                '@/features/library/sdk/**',
                '@/features/library/domain/**',
                '@/features/library/ui/**',
              ],
              message:
                'features/ai/ui/ must call transport/ and cross-feature internals via engine/ or context/ adapters.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

