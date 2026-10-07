import { EVERY_MINUTE } from "@homarr/cron-jobs-core/expressions";
import { db } from "@homarr/db";

import { syncProxmoxDiscoveryAsync } from "../discovery";
import { createCronJob } from "../lib";

export const proxmoxDiscoveryJob = createCronJob("proxmoxDiscovery", EVERY_MINUTE, {
  runOnStart: true,
}).withCallback(async () => {
  await syncProxmoxDiscoveryAsync(db);
});
