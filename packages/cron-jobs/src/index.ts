import { analyticsJob } from "./jobs/analytics";
import { iconsUpdaterJob } from "./jobs/icons-updater";
import { pingJob } from "./jobs/ping";
import { proxmoxDiscoveryJob } from "./jobs/proxmox-discovery";
import { createCronJobGroup } from "./lib";

const getJobGroup = () => {
  return createCronJobGroup({
    analytics: analyticsJob,
    iconsUpdater: iconsUpdaterJob,
    ping: pingJob,
    proxmoxDiscovery: proxmoxDiscoveryJob,
  });
};

declare global {
  var cronJobs: ReturnType<typeof getJobGroup> | undefined;
}

global.cronJobs ??= getJobGroup();

export const jobGroup = global.cronJobs;

export type JobGroupKeys = ReturnType<(typeof jobGroup)["getKeys"]>[number];
