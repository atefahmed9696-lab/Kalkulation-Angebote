export function cropCanvasToPaperRect(canvas, paperRect) {
  const tmp = document.createElement("canvas");
  tmp.width  = paperRect.width;
  tmp.height = paperRect.height;
  const ctx = tmp.getContext("2d");
  ctx.drawImage(
    canvas,
    paperRect.x, paperRect.y, paperRect.width, paperRect.height,
    0, 0, paperRect.width, paperRect.height
  );
  return tmp;
}

export function exportCanvasToPDF(canvas, filename = "grundriss.pdf", paperRect = null) {
  const sourceCanvas = paperRect ? cropCanvasToPaperRect(canvas, paperRect) : canvas;
  const imageData = sourceCanvas.toDataURL("image/png");
  const pdfWindow = window.open("", "_blank");
  if (!pdfWindow) {
    alert("Popup blockiert. Bitte Popups erlauben für den PDF-Export.");
    return;
  }
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
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
          body { margin: 0; }
          img  { width: 100%; page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <img src="${imageData}" width="${w}" height="${h}" />
      </div>
      <script>
        window.onload = () => {
          setTimeout(() => { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `);
  pdfWindow.document.close();
}

export function exportCanvasToPNG(canvas, filename = "grundriss.png", paperRect = null) {
  const sourceCanvas = paperRect ? cropCanvasToPaperRect(canvas, paperRect) : canvas;
  const url = sourceCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
