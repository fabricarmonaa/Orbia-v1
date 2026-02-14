import type PDFDocument from "pdfkit";

export function drawBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    options?: {
        lineWidth?: number;
        cornerRadius?: number;
        stroke?: boolean;
        fill?: string;
        strokeColor?: string;
    }
) {
    const opts = { lineWidth: 1, cornerRadius: 0, stroke: true, ...options };
    doc.lineWidth(opts.lineWidth);
    if (opts.strokeColor) {
        doc.strokeColor(opts.strokeColor);
    }
    if (opts.fill) {
        doc.rect(x, y, w, h).fill(opts.fill);
    } else if (opts.cornerRadius > 0) {
        doc.roundedRect(x, y, w, h, opts.cornerRadius);
        if (opts.stroke) doc.stroke();
    } else {
        doc.rect(x, y, w, h);
        if (opts.stroke) doc.stroke();
    }
    // Reset to black
    if (opts.strokeColor) {
        doc.strokeColor("#000000");
    }
}

export function drawDottedLine(
    doc: PDFKit.PDFDocument,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dotSpacing = 2
) {
    doc.save();
    doc.dash(dotSpacing, { space: dotSpacing });
    doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    doc.undash();
    doc.restore();
}

export function fitImage(
    doc: PDFKit.PDFDocument,
    imgPath: string,
    x: number,
    y: number,
    maxW: number,
    maxH: number
): boolean {
    try {
        // PDFKit's fit option automatically maintains aspect ratio
        doc.image(imgPath, x, y, { fit: [maxW, maxH], align: "center", valign: "center" });
        return true;
    } catch {
        return false;
    }
}

export function drawCheckbox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    size = 10,
    checked = false
) {
    doc.rect(x, y, size, size).stroke();
    if (checked) {
        doc.moveTo(x + 2, y + 2).lineTo(x + size - 2, y + size - 2).stroke();
        doc.moveTo(x + size - 2, y + 2).lineTo(x + 2, y + size - 2).stroke();
    }
}

export function drawBarcode(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    bars = 40
) {
    const barWidth = w / (bars * 2);
    doc.save();
    doc.fillColor("#000000");
    for (let i = 0; i < bars; i++) {
        const xPos = x + i * barWidth * 2;
        doc.rect(xPos, y, barWidth, h).fill();
    }
    doc.restore();
}

export function drawLabelValue(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    label: string,
    value: string,
    width: number,
    dotted = true
) {
    const currentFontSize = 9; // Use fixed size for dotted line calculation
    doc.fontSize(currentFontSize).fillColor("#111111").text(label, x, y, { continued: false });
    const labelWidth = doc.widthOfString(label);
    const valueX = x + labelWidth + 5;

    if (dotted && !value) {
        drawDottedLine(doc, valueX, y + currentFontSize / 2, x + width, y + currentFontSize / 2);
    } else {
        doc.text(value || "", valueX, y, { width: width - labelWidth - 10 });
    }
}
