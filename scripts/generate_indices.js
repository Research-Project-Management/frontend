const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const featuresDir = path.join(srcDir, 'features');

// Store all required exports per feature
// Map<featureName, Set<{ imported: string, path: string }>>
const featureExports = new Map();

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);
const importRegex = /import\s+({[^}]+}|[a-zA-Z0-9_]+)\s+from\s+['"]@\/features\/([^/]+)\/([^'"]+)['"]/g;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    content = content.replace(importRegex, (match, imports, feature, subPath) => {
        // We only want to refactor if we are outside the feature being imported
        // e.g. if we are in app/ or in features/another_feature
        const relativeFilePath = path.relative(srcDir, file).replace(/\\/g, '/');
        if (relativeFilePath.startsWith(`features/${feature}/`)) {
            // Internal import, skip
            return match;
        }

        if (!featureExports.has(feature)) {
            featureExports.set(feature, new Map());
        }
        
        let namedImports = [];
        let defaultImport = null;

        if (imports.startsWith('{')) {
            // { A, B as C }
            const items = imports.replace(/[{}]/g, '').split(',').map(i => i.trim()).filter(Boolean);
            namedImports.push(...items);
        } else {
            // DefaultImport
            defaultImport = imports.trim();
        }

        const featureMap = featureExports.get(feature);
        if (!featureMap.has(subPath)) {
            featureMap.set(subPath, { named: new Set(), default: null });
        }
        
        const pathData = featureMap.get(subPath);
        namedImports.forEach(ni => pathData.named.add(ni));
        if (defaultImport) {
            pathData.default = defaultImport;
        }

        changed = true;
        
        let newImports = [];
        if (defaultImport) {
            newImports.push(defaultImport);
        }
        if (namedImports.length > 0) {
            newImports.push(...namedImports);
        }
        
        let allNamed = newImports.join(', ');
        return `import { ${allNamed} } from '@/features/${feature}'`;
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated imports in ${file}`);
    }
});

// Now generate the index.ts files
featureExports.forEach((pathsMap, feature) => {
    const indexPath = path.join(featuresDir, feature, 'index.ts');
    let indexContent = '';

    pathsMap.forEach((data, subPath) => {
        if (data.default) {
            indexContent += `export { default as ${data.default} } from './${subPath}';\n`;
        }
        if (data.named.size > 0) {
            const namedList = Array.from(data.named).join(', ');
            indexContent += `export { ${namedList} } from './${subPath}';\n`;
        }
    });

    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`Generated ${indexPath}`);
});
