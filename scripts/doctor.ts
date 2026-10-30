// Generic local environment report. No project, account, credential or filesystem paths.
import { registry } from '../packages/agent-adapters/src/index.ts';
import { timingFromEnvironment } from '../packages/agent-adapters/src/headless.ts';
const probes = await Promise.all([...registry().values()].map(adapter => adapter.probe()));
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const report = {
  runtime: { node: process.version, platform: process.platform, arch: process.arch, supportedNode: major === 22 && (minor > 22 || (minor === 22 && patch >= 2)) },
  policy: { storage: 'pc-local-outside-git', providerExecution: 'explicit-consent', automaticPushOrUpload: false, credentialsReadByDoctor: false, modelCallsByDoctor: false },
  headless: { idleTimeoutSeconds: timingFromEnvironment().idleMs / 1000, totalTimeoutSeconds: timingFromEnvironment().totalMs / 1000 },
  agents: probes.map(a => ({ id: a.id, installed: a.installed, version: a.version, protocolFlagsDetected: a.runnable ?? a.id === 'mock', authenticationVerified: false, liveExecutionVerifiedByDoctor: false, reason: a.reason ?? null })),
};
console.log(JSON.stringify(report, null, 2));
if (!report.runtime.supportedNode) process.exitCode = 1;
