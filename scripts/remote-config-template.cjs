function printAuthHelp() {
  console.error('\nAuthentication failed.');
  console.error('Please authenticate using one of these methods:\n');
  console.error('Option 1: Use gcloud (recommended)');
  console.error('  gcloud auth application-default login\n');
  console.error('Option 2: Set GOOGLE_APPLICATION_CREDENTIALS');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"\n');
  console.error('Option 3: Use Firebase CLI');
  console.error('  firebase login\n');
}

function isAuthError(error) {
  return error.code === 'app/invalid-credential'
    || error.message?.includes('credential')
    || error.message?.includes('OAuth2');
}

async function getRemoteConfigTemplate(remoteConfig) {
  try {
    return await remoteConfig.getTemplate();
  } catch (error) {
    if (isAuthError(error)) {
      printAuthHelp();
      process.exit(1);
    }
    if (error.code !== 5) throw error;
    console.log('No existing template found, creating new one...');
    return remoteConfig.createTemplateFromJSON({ parameters: {} });
  }
}

function ensureServerGroup(template) {
  template.parameterGroups ||= {};
  template.parameterGroups.Server ||= {
    description: 'Server-side configuration parameters for Cloud Functions',
    parameters: {},
  };
  return template.parameterGroups.Server;
}

function valueTypeFor(defaultValue) {
  const value = String(defaultValue);
  if (value === 'true' || value === 'false') return 'BOOLEAN';
  if (value !== '' && !value.includes(',') && !Number.isNaN(Number(value))) return 'NUMBER';
  return 'STRING';
}

function applyServerDefaults(template, defaults, deprecatedKeys = [], overwriteKeys = []) {
  const serverGroup = ensureServerGroup(template);
  console.log('Adding/updating parameters in Server group...');
  let updated = 0;

  for (const key of deprecatedKeys) {
    delete template.parameters[key];
    delete serverGroup.parameters[key];
  }

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const current = serverGroup.parameters[key] ?? template.parameters[key];
    if (current && !overwriteKeys.includes(key)) continue;
    const value = String(defaultValue);
    delete template.parameters[key];
    serverGroup.parameters[key] = { defaultValue: { value }, valueType: valueTypeFor(value) };
    console.log(`  set ${key} = ${value} (${serverGroup.parameters[key].valueType})`);
    updated += 1;
  }

  console.log(`\nServer parameter group contains ${Object.keys(serverGroup.parameters).length} parameters`);
  return updated;
}

function logValidationErrors(errors) {
  if (!Array.isArray(errors)) return;
  for (const error of errors) {
    console.warn(`  - ${error.path || 'unknown'}: ${error.message || error}`);
  }
}

async function validateTemplate(remoteConfig, template, updated) {
  try {
    const result = await remoteConfig.validateTemplate(template);
    if (result?.valid === false) {
      console.warn('\nTemplate validation returned invalid; publishing is blocked.');
      logValidationErrors(result.errors);
      throw new Error('Remote Config template validation failed');
    } else {
      console.log(`\nTemplate is valid. Publishing ${updated} parameters...`);
    }
  } catch (error) {
    console.warn('\nTemplate validation failed; publishing is blocked:', error.message);
    logValidationErrors(error.errors);
    throw error;
  }
}

async function publishTemplate(remoteConfig, template, projectId, defaults) {
  const publishedTemplate = await remoteConfig.publishTemplate(template);
  console.log('\nSuccessfully published Remote Config template.');
  console.log(`  Version: ${publishedTemplate.version.versionNumber}`);
  console.log(`  Updated: ${publishedTemplate.version.updateTime}`);
  console.log('\nTo view these configs in Firebase Console:');
  console.log(`  https://console.firebase.google.com/project/${projectId}/config`);
  console.log(`  The ${Object.keys(defaults).length} parameters appear after Remote Config is enabled.`);
  console.log('\nYou can also verify via CLI:');
  console.log(`  firebase remoteconfig:get --project ${projectId}`);
}

module.exports = {
  applyServerDefaults,
  getRemoteConfigTemplate,
  printAuthHelp,
  publishTemplate,
  validateTemplate,
};
