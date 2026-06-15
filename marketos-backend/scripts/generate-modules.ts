import fs from 'fs';
import path from 'path';

const modules = [
  'auth', 'settings', 'dashboard', 'campaigns', 'campaign_detail',
  'analytics', 'audience', 'ai_command_center', 'agents', 'workflow_engine',
  'creative_studio', 'competitive_intelligence', 'finance', 'reports',
  'monitoring', 'audit_logs'
];

const basePath = path.join(__dirname, '..', 'src', 'modules');

if (!fs.existsSync(basePath)) {
  fs.mkdirSync(basePath, { recursive: true });
}

modules.forEach(mod => {
  const modPath = path.join(basePath, mod);
  if (!fs.existsSync(modPath)) {
    fs.mkdirSync(modPath, { recursive: true });
  }

  // Create subdirectories
  const dtoPath = path.join(modPath, 'dto');
  const interfacesPath = path.join(modPath, 'interfaces');
  
  if (!fs.existsSync(dtoPath)) fs.mkdirSync(dtoPath);
  if (!fs.existsSync(interfacesPath)) fs.mkdirSync(interfacesPath);

  const capitalize = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const className = capitalize(mod);

  // Files to generate
  const files = {
    'controller.ts': `import { Request, Response, NextFunction } from 'express';\nimport { ${className}Service } from './service';\n\nexport class ${className}Controller {\n  private service = new ${className}Service();\n}\n`,
    'service.ts': `import { ${className}Repository } from './repository';\n\nexport class ${className}Service {\n  private repository = new ${className}Repository();\n}\n`,
    'repository.ts': `import { prisma } from '../../lib/prisma';\n\nexport class ${className}Repository {\n}\n`,
    'routes.ts': `import { Router } from 'express';\nimport { ${className}Controller } from './controller';\n\nconst router = Router();\nconst controller = new ${className}Controller();\n\nexport default router;\n`,
    'validator.ts': `import { z } from 'zod';\n\nexport const create${className}Schema = z.object({});\n`,
    'types.ts': `export type ${className}Type = {};\n`
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(modPath, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
    }
  }
});

console.log('Modules generated successfully.');
