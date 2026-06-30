#!/usr/bin/env node

const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');
const { RC_DEFAULTS } = require('./remote-config-defaults.cjs');
const {
  applyServerDefaults,
  getRemoteConfigTemplate,
  printAuthHelp,
  publishTemplate,
  validateTemplate,
} = require('./remote-config-template.cjs');

function requireProjectId() {
  const projectId = process.argv[2] || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (projectId) return projectId;
  console.error('Error: Project ID required');
  console.log('Usage: node scripts/setup-remote-config.cjs [project-id]');
  console.log('Or set GOOGLE_CLOUD_PROJECT environment variable');
  process.exit(1);
}

function initializeAdmin(projectId) {
  if (admin.apps.length) return;
  try {
    admin.initializeApp({ credential: applicationDefault(), projectId });
  } catch {
    printAuthHelp();
    process.exit(1);
  }
}

async function setupRemoteConfig(projectId) {
  initializeAdmin(projectId);
  const remoteConfig = admin.remoteConfig();

  try {
    console.log(`Fetching current Remote Config template for ${projectId}...`);
    const template = await getRemoteConfigTemplate(remoteConfig);
    const updated = applyServerDefaults(template, RC_DEFAULTS);
    validateTemplate(remoteConfig, template, updated);
    await publishTemplate(remoteConfig, template, projectId, RC_DEFAULTS);
  } catch (error) {
    console.error('\nError:', error.message);
    if (error.code) console.error(`  Code: ${error.code}`);
    process.exit(1);
  }
}

setupRemoteConfig(requireProjectId());
