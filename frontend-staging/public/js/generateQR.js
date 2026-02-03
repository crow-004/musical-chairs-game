const QRCode = require('qrcode');
QRCode.toFile('./official_links_qr.png', 'https://muschairs.com/links.html', { width: 300 }, err => {
  if (err) throw err;
  console.log('official_links_qr.png created!');
});
