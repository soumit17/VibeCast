export default function QRCode({ qr }) {
  if (!qr) return null;
  return (
    <div className="qr-box card">
      <img src={`data:image/png;base64,${qr.qr_png_base64}`} alt="QR code to join this room" />
      <code>{qr.join_url}</code>
    </div>
  );
}
