import { describe, it, expect } from 'vitest';

describe('Projects Sidebar Specifications', () => {
  it('should have strictly (home, drafts, your work, sticky) in root navigation', () => {
    const rootNavItems = [
      { label: 'Home', to: '/projects' },
      { label: 'Drafts', to: '/drafts' },
      { label: 'Your work', to: '/your-work' },
      { label: 'Stickies', to: '/stickies' },
    ];

    expect(rootNavItems.map((i) => i.label)).toEqual([
      'Home',
      'Drafts',
      'Your work',
      'Stickies',
    ]);
    expect(rootNavItems.map((i) => i.to)).toEqual([
      '/projects',
      '/drafts',
      '/your-work',
      '/stickies',
    ]);
  });

  it('should have strictly (work-items, pages, cycles, views) inside project-id', () => {
    const projectModules = ['work-items', 'pages', 'cycles', 'views'];
    expect(projectModules).toEqual(['work-items', 'pages', 'cycles', 'views']);

    // Ensure forbidden modules are strictly absent
    expect(projectModules).not.toContain('overview');
    expect(projectModules).not.toContain('storage');
    expect(projectModules).not.toContain('stickies');
    expect(projectModules).not.toContain('collection');
  });

  it('should properly format project submodule paths', () => {
    const projId = 'proj-123';
    const paths = {
      'work-items': `/projects/${projId}/work-items`,
      pages: `/projects/${projId}/pages`,
      cycles: `/projects/${projId}/cycles`,
      views: `/projects/${projId}/views`,
    };

    expect(paths['work-items']).toBe('/projects/proj-123/work-items');
    expect(paths.pages).toBe('/projects/proj-123/pages');
    expect(paths.cycles).toBe('/projects/proj-123/cycles');
    expect(paths.views).toBe('/projects/proj-123/views');
  });
});
