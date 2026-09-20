// Node's built-in TypeScript runner resolves the extensionless imports also used by Angular.
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !/\.(ts|js|mjs|json)$/i.test(specifier)) return nextResolve(specifier + '.ts', context);
      throw error;
    }
  },
});
