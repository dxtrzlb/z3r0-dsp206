import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// "Connect a tablet" panel: shows the LAN address + pairing code and a QR the iPad app scans.
// The QR payload matches the iPad's parsePairingPayload: JSON { host, code }.
export function TabletConnect({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<{ port: number; code: string; ip: string | null } | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    void window.dsp.serverInfo().then(setInfo);
  }, []);

  const host = info?.ip ? `${info.ip}:${info.port}` : null;

  useEffect(() => {
    if (!host || !info) return;
    const payload = JSON.stringify({ host, code: info.code });
    QRCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#0b0e13', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [host, info]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tablet-connect" onClick={(e) => e.stopPropagation()}>
        <h2>Connect a tablet</h2>
        <p>Scan this in the z3r0 DSP iPad app — or enter the address and code by hand.</p>
        {qr ? (
          <img className="qr" src={qr} alt="Pairing QR code" width={240} height={240} />
        ) : (
          <div className="qr qr-placeholder">{host ? 'Generating…' : 'No LAN connection'}</div>
        )}
        <dl className="pair-details">
          <div>
            <dt>Address</dt>
            <dd>{host ?? 'No LAN IP found'}</dd>
          </div>
          <div>
            <dt>Pairing code</dt>
            <dd className="pair-code">{info?.code ?? '—'}</dd>
          </div>
        </dl>
        <p className="pair-note">The code changes each time the app restarts. Both devices must be on the same network.</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
