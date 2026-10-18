import {defineConfig,mergeConfig} from 'vitest/config';
import original from '../vitest.config.ts';
/** Complete existing suite, with real PostgreSQL namespaces isolated per file. */
export default mergeConfig(original,defineConfig({test:{setupFiles:['./tools/playability-pg-scope.ts'],maxWorkers:1}}));
