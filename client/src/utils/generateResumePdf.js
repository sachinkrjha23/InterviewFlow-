// Plain, single-column PDF. This is the layout applicant tracking systems read most reliably.

const REPLACEMENTS = [
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/[\u2013\u2014]/g, "-"],
  [/\u2026/g, "..."],
  [/[\u2022\u25CF\u25AA]/g, "-"],
  [/\u00A0/g, " "],
];

// the built-in PDF fonts can't draw other characters, so they are dropped
const toPdfText = (text) =>
  REPLACEMENTS.reduce((s, [re, to]) => s.replace(re, to), String(text)).replace(
        /[^\t\n\x20-\x7E]/g,
    "",
  );

export const generateResumePdf = async (text, fileName = "tailored-resume.pdf") => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const ensureSpace = () => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const raw of toPdfText(text).split("\n")) {
    const line = raw.trim();
    if (!line) {
      y += 6;
      continue;
    }

    const isHeading =
      line.length <= 40 && line === line.toUpperCase() && /[A-Z]/.test(line);
    const isBullet = line.startsWith("- ");

    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    doc.setFontSize(isHeading ? 11 : 10);
    if (isHeading) y += 6;

    const body = isBullet ? line.slice(2) : line;
    const indent = isBullet ? 12 : 0;
    const wrapped = doc.splitTextToSize(body, width - indent);

    wrapped.forEach((w, i) => {
      ensureSpace();
      if (isBullet && i === 0) doc.text("-", margin, y);
      doc.text(w, margin + indent, y);
      y += isHeading ? 15 : 13;
    });
  }

  doc.save(fileName);
};