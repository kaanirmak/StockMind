import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const config = defineCloudflareConfig();

// `npm run build` targets Workers. Keep the adapter's inner Next build separate
// so its default npm command cannot recursively invoke the adapter itself.
config.buildCommand = 'npm run build:next';

export default config;
