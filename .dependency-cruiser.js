/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependency detected. Extract shared types/contracts into a lower-level file so dependencies flow in one direction.',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'no-src-importing-tests',
      severity: 'error',
      comment:
        'Production code under src/ must never import from tests/. Move shared helpers into src/shared/.',
      from: { path: '^src/' },
      to: { path: '^tests/' },
    },
    {
      name: 'domain-no-next-framework',
      severity: 'error',
      comment:
        'Domain files (**/domain/**) must stay framework-free and must not import next/*. Pass router/navigation callbacks from UI/hooks.',
      from: { path: '^src/.*/domain/' },
      to: { path: 'node_modules/next/' },
    },
    {
      name: 'shared-no-features',
      severity: 'error',
      comment:
        'src/shared/ must not import from src/features/. Move truly shared primitives into src/shared/ or invert control via props/callbacks.',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', '.next', 'dist', 'coverage'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'browser', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
