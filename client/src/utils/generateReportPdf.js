import jsPDF from "jspdf";

export const generateReportPdf = (report) => {
  const {
    role,
    experience,
    mode,
    createdAt,
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report;

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 70, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("InterviewFlow", margin, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("AI Interview Performance Report", margin, 52);

  y = 100;

  // Candidate info
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${role || "Role"}`, margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${experience || "—"}  ·  ${mode || "—"} mode  ·  ${
      createdAt ? new Date(createdAt).toLocaleDateString("en-IN") : "—"
    }`,
    margin,
    y,
  );
  y += 30;

  // Final score box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 70, 10, 10, "FD");

  doc.setTextColor(16, 185, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(`${Number(finalScore).toFixed(1)}`, margin + 20, y + 45);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Overall Score (out of 10)", margin + 20, y + 60);

  // Metric summary
  const metricsX = pageWidth / 2 + 20;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Confidence", metricsX, y + 25);
  doc.text("Communication", metricsX, y + 45);
  doc.text("Correctness", metricsX, y + 65);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text(`${Number(confidence).toFixed(1)}/10`, metricsX + 120, y + 25);
  doc.text(`${Number(communication).toFixed(1)}/10`, metricsX + 120, y + 45);
  doc.text(`${Number(correctness).toFixed(1)}/10`, metricsX + 120, y + 65);

  y += 100;

  // Question breakdown header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("Question Breakdown", margin, y);
  y += 20;

  doc.setFontSize(10);

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }
  };
  const textWidth = pageWidth - margin * 2;

  questionWiseScore.forEach((q, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(q.question || "", textWidth);
    ensureSpace(14 + qLines.length * 12 + 4 + 14);

    doc.setTextColor(16, 185, 129);
    doc.text(`Q${i + 1}  ·  ${q.difficulty || ""}`, margin, y);
    y += 14;

    doc.setTextColor(30, 30, 30);
    doc.text(qLines, margin, y);
    y += qLines.length * 12 + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Score: ${q.score ?? 0}/10   Confidence: ${q.confidence ?? 0}   Communication: ${q.communication ?? 0}   Correctness: ${q.correctness ?? 0}`,
      margin,
      y,
    );
    y += 14;

    if (q.answer) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const answerLines = doc.splitTextToSize(q.answer, textWidth);
      const maxLines = Math.min(answerLines.length, 6);
      ensureSpace(11 + maxLines * 11 + 4 + 11);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text("Your Answer:", margin, y);
      y += 11;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(answerLines.slice(0, maxLines), margin, y);
      y += maxLines * 11 + 4;

      if (answerLines.length > maxLines) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 150, 150);
        doc.text("... (answer truncated)", margin, y);
        y += 11;
      }
    }

    if (q.feedback) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const fbLines = doc.splitTextToSize(q.feedback, textWidth);
      ensureSpace(11 + fbLines.length * 11 + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text("Feedback:", margin, y);
      y += 11;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(16, 100, 80);
      doc.text(fbLines, margin, y);
      y += fbLines.length * 11 + 4;
    }

    y += 6;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Generated by InterviewFlow  ·  Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 20,
    );
  }

  // Save
  const fileName = `InterviewFlow-Report-${
  role?.replace(/[^\w-]+/g, "-") || "Interview"
  }-${Date.now()}.pdf`;
  doc.save(fileName);
};
