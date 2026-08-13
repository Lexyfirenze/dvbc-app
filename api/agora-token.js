import pkg from "agora-access-token";
const { RtcTokenBuilder, RtcRole } = pkg;

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { channel, uid } = req.body || {};
  if (!channel || typeof channel !== "string") {
    return res.status(400).json({ error: "channel is required" });
  }

  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) {
    return res.status(500).json({ error: "Agora credentials are not configured" });
  }

  const uidNum = Number(uid) || 0; // 0 lets Agora assign an id on join
  const role = RtcRole.PUBLISHER;
  const expireSeconds = 3600; // 1 hour
  const currentTs = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTs + expireSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channel,
    uidNum,
    role,
    privilegeExpireTs
  );

  return res.status(200).json({ appId, token, channel, uid: uidNum, expiresAt: privilegeExpireTs });
}
