export const PAPER_FORMATS = {
  A4: { widthMm: 297, heightMm: 210 },
  A3: { widthMm: 420, heightMm: 297 },
  A2: { widthMm: 594, heightMm: 420 },
  A1: { widthMm: 841, heightMm: 594 }
};

const FRAME_MARGIN = 40;

export function computePaperRect(canvasW, canvasH, paperFormat) {
  const fmt = PAPER_FORMATS[paperFormat] || PAPER_FORMATS['A3'];
  const aspect = fmt.widthMm / fmt.heightMm;
  const availW = canvasW - FRAME_MARGIN * 2;
  const availH = canvasH - FRAME_MARGIN * 2;
  let paperW, paperH;
  if (availW / availH > aspect) {
    paperH = availH;
    paperW = availH * aspect;
  } else {
    paperW = availW;
    paperH = availW / aspect;
  }
  return {
    x: Math.round((canvasW - paperW) / 2),
    y: Math.round((canvasH - paperH) / 2),
    width:  Math.round(paperW),
    height: Math.round(paperH)
  };
}

export function drawPaperShadow(ctx, paperRect) {
  ctx.save();
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur  = 18;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(paperRect.x, paperRect.y, paperRect.width, paperRect.height);
  ctx.restore();
}

export function drawPlanFrame(ctx, canvasWidth, canvasHeight, options = {}) {
  const paperFormat = options.paperFormat || 'A3';
  const paperRect = computePaperRect(canvasWidth, canvasHeight, paperFormat);
  const titleBlockHeight = 90;
  const stroke = options.stroke ?? '#64748b';
  const innerMargin = 12;

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;

  // outer border of paper
  ctx.strokeRect(paperRect.x, paperRect.y, paperRect.width, paperRect.height);

  // inner frame (drawing area border)
  ctx.strokeRect(
    paperRect.x + innerMargin,
    paperRect.y + innerMargin,
    paperRect.width  - innerMargin * 2,
    paperRect.height - innerMargin * 2
  );

  // title block box
  const tbX = paperRect.x + paperRect.width  - 320 - innerMargin;
  const tbY = paperRect.y + paperRect.height - titleBlockHeight - innerMargin;
  ctx.strokeRect(tbX, tbY, 320, titleBlockHeight);

  // title block inner dividers
  ctx.beginPath();
  ctx.moveTo(tbX, tbY + 28);         ctx.lineTo(tbX + 320, tbY + 28);
  ctx.moveTo(tbX + 95,  tbY);        ctx.lineTo(tbX + 95,  tbY + titleBlockHeight);
  ctx.moveTo(tbX + 210, tbY);        ctx.lineTo(tbX + 210, tbY + titleBlockHeight);
  ctx.moveTo(tbX, tbY + 58);         ctx.lineTo(tbX + 320, tbY + 58);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '12px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText('Projekt',    tbX + 8,   tbY + 14);
  ctx.fillText('Maßstab',    tbX + 103, tbY + 14);
  ctx.fillText('Etage',      tbX + 218, tbY + 14);
  ctx.fillText('Zeichnung',  tbX + 8,   tbY + 43);
  ctx.fillText('Format',     tbX + 218, tbY + 43);
  ctx.fillText('Stand',      tbX + 8,   tbY + 73);
  ctx.fillText('Version',    tbX + 218, tbY + 73);
  ctx.restore();

  return { paperRect, tbX, tbY, titleBlockHeight };
}

export function fillTitleBlock(ctx, canvasWidth, canvasHeight, meta = {}) {
  const paperFormat = meta.paperFormat || 'A3';
  const paperRect = computePaperRect(canvasWidth, canvasHeight, paperFormat);
  const titleBlockHeight = 90;
  const innerMargin = 12;
  const tbX = paperRect.x + paperRect.width  - 320 - innerMargin;
  const tbY = paperRect.y + paperRect.height - titleBlockHeight - innerMargin;

  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(meta.projectName  || 'Grundrissprojekt', tbX + 8,   tbY + 14);
  ctx.fillText(meta.scaleLabel   || '1:100',            tbX + 103, tbY + 14);
  ctx.fillText(meta.floorName    || '-',                tbX + 218, tbY + 14);
  ctx.fillText(meta.drawingTitle || 'Grundriss',        tbX + 8,   tbY + 43);
  ctx.fillText(meta.paperFormat  || 'A3',               tbX + 218, tbY + 43);
  ctx.fillText(meta.dateLabel    || '',                 tbX + 8,   tbY + 73);
  ctx.fillText(meta.versionLabel || 'V2.6',             tbX + 218, tbY + 73);
  ctx.restore();
}