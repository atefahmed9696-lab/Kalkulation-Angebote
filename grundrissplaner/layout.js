export const PAPER_FORMATS = {
  A4: {
    widthMm: 297,
    heightMm: 210
  },
  A3: {
    widthMm: 420,
    heightMm: 297
  },
  A2: {
    widthMm: 594,
    heightMm: 420
  },
  A1: {
    widthMm: 841,
    heightMm: 594
  }
};
export function drawPlanFrame(ctx, canvasWidth, canvasHeight, options = {}) {
  const margin = options.margin ?? 24;
  const titleBlockHeight = options.titleBlockHeight ?? 90;
  const stroke = options.stroke ?? "#64748b";
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(margin, margin, canvasWidth - margin * 2, canvasHeight - margin * 2);
  ctx.strokeRect(canvasWidth - 320 - margin, canvasHeight - titleBlockHeight - margin, 320, titleBlockHeight);
  const x = canvasWidth - 320 - margin;
  const y = canvasHeight - titleBlockHeight - margin;
  ctx.beginPath();
  ctx.moveTo(x, y + 28);
  ctx.lineTo(x + 320, y + 28);
  ctx.moveTo(x + 95, y);
  ctx.lineTo(x + 95, y + titleBlockHeight);
  ctx.moveTo(x + 210, y);
  ctx.lineTo(x + 210, y + titleBlockHeight);
  ctx.moveTo(x, y + 58);
  ctx.lineTo(x + 320, y + 58);
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.font = "12px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("Projekt", x + 8, y + 14);
  ctx.fillText("Maßstab", x + 103, y + 14);
  ctx.fillText("Etage", x + 218, y + 14);
  ctx.fillText("Zeichnung", x + 8, y + 43);
  ctx.fillText("Format", x + 218, y + 43);
  ctx.fillText("Stand", x + 8, y + 73);
  ctx.fillText("Version", x + 218, y + 73);
  ctx.restore();
}
export function fillTitleBlock(ctx, canvasWidth, canvasHeight, meta = {}) {
  const margin = 24;
  const titleBlockHeight = 90;
  const x = canvasWidth - 320 - margin;
  const y = canvasHeight - titleBlockHeight - margin;
  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(meta.projectName || "Grundrissprojekt", x + 8, y + 14);
  ctx.fillText(meta.scaleLabel || "1:100", x + 103, y + 14);
  ctx.fillText(meta.floorName || "-", x + 218, y + 14);
  ctx.fillText(meta.drawingTitle || "Grundriss", x + 8, y + 43);
  ctx.fillText(meta.paperFormat || "A3", x + 218, y + 43);
  ctx.fillText(meta.dateLabel || "", x + 8, y + 73);
  ctx.fillText(meta.versionLabel || "V2.6", x + 218, y + 73);
  ctx.restore();
}