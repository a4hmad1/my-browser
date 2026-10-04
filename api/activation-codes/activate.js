const VALID_CODES = new Set([
  "100911","101817","106529","138184","138561","158969","159016","170402","170704","196982",
  "206371","209852","210052","210586","211245","212134","232728","237767","238319","242269",
  "249415","262724","277579","279597","279652","288587","288963","303983","304709","309914",
  "310513","326223","330895","333313","347663","347997","357415","360915","371644","372135",
  "399335","411667","419698","428263","435676","446310","454628","462715","464218","468907",
  "490690","492387","503987","512828","530594","560758","565100","574737","582252","584364",
  "595891","602746","634530","635447","647152","648433","659645","675386","677205","686329",
  "696020","704690","718255","727402","765141","767421","781232","791100","793277","803412",
  "814002","828604","844612","845972","857770","875078","875884","888918","890301","894948",
  "895396","898740","899681","903295","907316","934352","945494","979429","981187","982395"
]);

// In-memory activation store for serverless instance (also synced across requests)
const activeDevices = globalThis._activeDevices || new Map();
globalThis._activeDevices = activeDevices;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { code, device_id } = req.body || {};

  if (!code || !/^\d{6}$/.test(String(code).trim())) {
    return res.status(422).json({ success: false, error: 'The activation code must be exactly 6 digits.' });
  }

  const cleanCode = String(code).trim();
  if (!VALID_CODES.has(cleanCode)) {
    return res.status(404).json({ success: false, error: 'This activation code was not found.' });
  }

  const existingDevice = activeDevices.get(cleanCode);

  if (existingDevice && device_id && existingDevice !== device_id) {
    return res.status(409).json({
      success: false,
      error: 'This activation code has already been activated on another device and is locked.'
    });
  }

  activeDevices.set(cleanCode, device_id || 'active');

  return res.status(200).json({
    success: true,
    message: existingDevice === device_id
      ? 'Activation restored successfully on your device.'
      : 'Lifetime browser activation successful! Welcome to CineStream.',
    code: cleanCode,
    device_id: device_id || null,
    activated_at: new Date().toISOString()
  });
};
