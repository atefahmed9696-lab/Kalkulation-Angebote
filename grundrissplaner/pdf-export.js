export function exportCanvasToPDF(canvas, filename = "grundriss.pdf") {
  const imageData = canvas.toDataURL("image/png");
  const pdfWindow = window.open("", "_blank");
  if (!pdfWindow) {
    alert("Popup blockiert. Bitte Popups erlauben für den PDF-Export.");
    return;
  }
  const w = canvas.width;
  const h = canvas.height;
  pdfWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background: white;
        }
        .page {
          width: 100%;
          text-align: center;
        }
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        @media print {
          body {
            margin: 0;
          }
          img {
            width: 100%;
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <img src="${imageData}" width="${w}" height="${h}" />
      </div>
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 250);
        };
      <\/script>
    </body>
    </html>
  `);
  pdfWindow.document.close();
}
