const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, '../../anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('user_profiles').get();

  const summary = {
    total: snap.size,
    onboardedTrue: 0,
    onboardedFalse: 0,
    onboardedMissing: 0,
    missingName: 0,
    missingRole: 0,
    missingInterests: 0,
    sparseProfiles: 0,
    noCreatedAt: 0,
  };

  const suspicious = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const hasOnboardedField = Object.prototype.hasOwnProperty.call(data, 'onboarded');

    if (!hasOnboardedField) summary.onboardedMissing += 1;
    else if (data.onboarded === true) summary.onboardedTrue += 1;
    else summary.onboardedFalse += 1;

    const missingName = isBlank(data.name) && isBlank(data.displayName);
    const missingRole = isBlank(data.role);
    const missingInterests = isBlank(data.interests);
    const noCreatedAt = !data.createdAt;

    if (missingName) summary.missingName += 1;
    if (missingRole) summary.missingRole += 1;
    if (missingInterests) summary.missingInterests += 1;
    if (noCreatedAt) summary.noCreatedAt += 1;

    const meaningfulKeys = Object.entries(data)
      .filter(([k, v]) => !['updatedAt', 'lastActiveAt', 'feedBuildRequestedAt', 'lastOnboardDispatchAt'].includes(k) && !isBlank(v))
      .map(([k]) => k);

    const sparse = meaningfulKeys.length <= 6;
    if (sparse) summary.sparseProfiles += 1;

    const suspiciousDoc = (!hasOnboardedField || data.onboarded !== true) && (missingInterests || missingRole || missingName);
    if (suspiciousDoc || sparse) {
      suspicious.push({
        uid: doc.id,
        email: data.email || '',
        onboarded: hasOnboardedField ? data.onboarded : '(missing)',
        name: data.name || data.displayName || '',
        role: data.role || '',
        interestsCount: Array.isArray(data.interests) ? data.interests.length : 0,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        keys: meaningfulKeys,
      });
    }
  }

  suspicious.sort((a, b) => {
    const score = (row) => (row.onboarded === true ? 0 : 10) + (row.interestsCount === 0 ? 5 : 0) + (row.role ? 0 : 3);
    return score(b) - score(a);
  });

  console.log(JSON.stringify({ summary, suspicious: suspicious.slice(0, 50) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
