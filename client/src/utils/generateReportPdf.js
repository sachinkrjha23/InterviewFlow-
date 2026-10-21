const C = {
  ink: [31, 36, 51],
  muted: [91, 98, 117],
  line: [227, 225, 218],
  canvas: [250, 250, 247],
  indigo: [79, 87, 201],
  indigoSoft: [236, 238, 255],
  indigoDeep: [43, 49, 137],
  teal: [28, 155, 131],
  tealSoft: [226, 245, 240],
  tealDeep: [10, 90, 76],
  amber: [212, 134, 11],
  amberSoft: [255, 241, 214],
  amberDeep: [122, 69, 4],
  rose: [214, 69, 107],
  roseSoft: [255, 232, 238],
  roseDeep: [138, 30, 62],
  violet: [123, 79, 216],
  violetSoft: [240, 232, 255],
  violetDeep: [67, 34, 143],
  sky: [43, 135, 220],
  skyDeep: [16, 74, 128],
};

const bandFor = (score) => {
  if (score >= 7) return { main: C.teal, soft: C.tealSoft, deep: C.tealDeep };
  if (score >= 4) return { main: C.amber, soft: C.amberSoft, deep: C.amberDeep };
  return { main: C.rose, soft: C.roseSoft, deep: C.roseDeep };
};

const REPLACEMENTS = [
  [/\r\n?/g, "\n"],
  [/```[a-z]*\n?/gi, ""],
  [/\*\*(.+?)\*\*/g, "$1"],
  [/`([^`]+)`/g, "$1"],
  [/\t/g, "    "],
  [/\u00A0/g, " "],
  [/[\u2018\u2019\u201A]/g, "'"],
  [/[\u201C\u201D\u201E]/g, '"'],
  [/[\u2013\u2014\u2212]/g, "-"],
  [/\u2026/g, "..."],
  [/[\u2022\u25CF\u25AA]/g, "-"],
];

export const pdfText = (value) => {
  let s = String(value ?? "");
  for (const [pattern, replacement] of REPLACEMENTS) s = s.replace(pattern, replacement);
  return s.replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, "");
};

export const reportFileName = (report) => {
  const role = String(report?.role || "Interview").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "Interview";
  const date = new Date(report?.createdAt || Date.now());
  const day = Number.isNaN(date.getTime()) ? "report" : date.toISOString().slice(0, 10);
  return `InterviewFlow-Report-${role}-${day}.pdf`;
};

const fmt = (n) => Number(n || 0).toFixed(1);

function deliveryLine(d) {
  const parts = [];
  if (d.wpm > 0) parts.push(`${d.wpm} wpm`);
  parts.push(`${d.fillerCount} filler word${d.fillerCount === 1 ? "" : "s"}`);
  parts.push(`${d.longPauseCount} long pause${d.longPauseCount === 1 ? "" : "s"}`);
  return parts.join("  ·  ");
}

export function buildReportPdf(report, JsPdf) {
  const {
    role,
    experience,
    mode,
    createdAt,
    status,
    totalQuestions,
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report;

  const doc = new JsPdf({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const bottomLimit = pageHeight - 56;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const setText = (color, size, style = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  // writes text line by line, moving to a new page whenever the current one is full
  const paragraph = (text, { size = 9.5, style = "normal", color = C.ink, lineHeight = 13.5 } = {}) => {
    let content = pdfText(text);
    if (!content.trim() && String(text ?? "").trim()) {
      content = "(This text uses characters a PDF can't show. Open the report in the app to read it.)";
    }
    setText(color, size, style);
    const lines = doc.splitTextToSize(content, contentWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  const label = (text, color) => {
    ensureSpace(14 + 2 * 13.5); // keep the label together with the first lines under it
    setText(color, 8, "bold");
    doc.text(text.toUpperCase(), margin, y);
    y += 12;
  };

  // ---- page 1 header
  doc.setFillColor(...C.indigo);
  doc.rect(0, 0, pageWidth, 60, "F");
  setText([255, 255, 255], 18, "bold");
  doc.text("InterviewFlow", margin, 29);
  setText([255, 255, 255], 9.5);
  doc.text("Interview performance report", margin, 45);

  y = 92;
  setText(C.ink, 16, "bold");
  doc.text(pdfText(role || "Interview"), margin, y);
  y += 18;
  const when = createdAt
    ? new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  setText(C.muted, 9.5);
  doc.text(pdfText([experience, mode ? `${mode} mode` : "", when].filter(Boolean).join("  ·  ")), margin, y);
  y += 24;

  if (status === "Incomplete") {
    doc.setFillColor(...C.amberSoft);
    doc.roundedRect(margin, y - 12, contentWidth, 26, 6, 6, "F");
    setText(C.amberDeep, 9, "bold");
    doc.text(
      `Interview not finished: scores reflect ${questionWiseScore.length} of ${totalQuestions || 6} questions.`,
      margin + 12,
      y + 5,
    );
    y += 34;
  }

  // ---- summary card
  const overall = bandFor(Number(finalScore));
  const cardHeight = 92;
  doc.setFillColor(...C.canvas);
  doc.setDrawColor(...C.line);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 8, 8, "FD");

  setText(overall.deep, 32, "bold");
  doc.text(fmt(finalScore), margin + 20, y + 52);
  setText(C.muted, 9);
  doc.text("Overall score out of 10", margin + 20, y + 72);

  const metrics = [
    ["Confidence", confidence, C.sky],
    ["Communication", communication, C.violet],
    ["Correctness", correctness, C.teal],
  ];
  const metricsX = margin + 200;
  metrics.forEach(([name, value, color], i) => {
    const rowY = y + 28 + i * 24;
    setText(C.muted, 9);
    doc.text(name, metricsX, rowY);
    doc.setFillColor(...C.line);
    doc.roundedRect(metricsX + 92, rowY - 6, 150, 6, 3, 3, "F");
    const fill = Math.max(0, Math.min(1, Number(value) / 10)) * 150;
    if (fill > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(metricsX + 92, rowY - 6, Math.max(fill, 4), 6, 3, 3, "F");
    }
    setText(C.ink, 9.5, "bold");
    doc.text(`${fmt(value)} / 10`, metricsX + 252, rowY);
  });
  y += cardHeight + 28;

  // ---- question breakdown
  ensureSpace(60);
  setText(C.ink, 13, "bold");
  doc.text("Question breakdown", margin, y);
  y += 22;

  let mainNumber = 0;
  questionWiseScore.forEach((q, i) => {
    if (!q.isFollowUp) mainNumber += 1;
    const tag = q.isFollowUp ? "FOLLOW-UP" : `QUESTION ${mainNumber}`;
    const t = bandFor(Number(q.score ?? 0));

    setText(C.ink, 10.5, "bold");
    const questionLines = doc.splitTextToSize(pdfText(q.question), contentWidth);
    ensureSpace(18 + questionLines.length * 14 + 4 + 16 + 14 + 2 * 13.5);

    setText(C.indigoDeep, 8.5, "bold");
    doc.text(tag, margin, y);
    if (q.difficulty) {
      const labelWidth = doc.getTextWidth(tag);
      setText(C.muted, 8.5);
      doc.text(`  ·  ${pdfText(q.difficulty)}`, margin + labelWidth, y);
    }
    const scoreText = `${q.score ?? 0} / 10`;
    setText(t.deep, 9, "bold");
    const chipWidth = doc.getTextWidth(scoreText) + 16;
    doc.setFillColor(...t.soft);
    doc.roundedRect(pageWidth - margin - chipWidth, y - 10, chipWidth, 15, 4, 4, "F");
    doc.text(scoreText, pageWidth - margin - chipWidth + 8, y + 1);
    y += 18;

    paragraph(q.question, { size: 10.5, style: "bold", lineHeight: 14 });
    y += 4;

    let x = margin;
    [
      ["Confidence", q.confidence, C.skyDeep],
      ["Communication", q.communication, C.violetDeep],
      ["Correctness", q.correctness, C.tealDeep],
    ].forEach(([name, value, color]) => {
      const text = `${name} ${value ?? 0}`;
      setText(color, 8.5, "bold");
      doc.text(text, x, y);
      x += doc.getTextWidth(text) + 18;
    });
    y += 16;

    label("Your answer", C.muted);
    if (q.answer && q.answer.trim()) paragraph(q.answer, { size: 9.5, color: C.ink });
    else paragraph("No answer submitted.", { size: 9.5, style: "italic", color: C.muted });
    y += 6;

    if (q.delivery && q.delivery.wordCount > 0) {
      ensureSpace(16);
      setText(C.skyDeep, 8.5, "bold");
      doc.text(pdfText(`Delivery: ${deliveryLine(q.delivery)}`), margin, y);
      y += 14;
    }

    if (q.feedback) {
      label("Feedback", C.indigoDeep);
      paragraph(q.feedback, { size: 9.5, color: C.ink });
      y += 6;
    }

    label("Model answer", C.violetDeep);
    if (q.modelAnswer) paragraph(q.modelAnswer, { size: 9.5, color: C.ink });
    else
      paragraph("Not prepared yet. Open this report in InterviewFlow and choose Show model answer.", {
        size: 9.5,
        style: "italic",
        color: C.muted,
      });

    y += 8;
    if (i < questionWiseScore.length - 1) {
      ensureSpace(24);
      doc.setDrawColor(...C.line);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;
    }
  });

  // ---- footer on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setText(C.muted, 8);
    doc.text(`InterviewFlow  ·  ${pdfText(role || "Interview report")}`, margin, pageHeight - 24);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  return doc;
}

export const generateReportPdf = async (report) => {
  const mod = await import("jspdf");
  const JsPdf = mod.jsPDF || mod.default;
  const doc = buildReportPdf(report, JsPdf);
  doc.save(reportFileName(report));
};