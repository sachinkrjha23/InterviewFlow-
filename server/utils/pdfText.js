import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// the file type sent by the browser can be faked, so check the real file signature
export const isPdf = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString("latin1") === "%PDF-";

// pdf.js errors that mean "this file is broken or locked", not "our server failed"
const BAD_PDF_ERRORS = ["InvalidPDFException", "PasswordException", "MissingPDFException"];
export const isBadPdfError = (error) => BAD_PDF_ERRORS.includes(error?.name);

export const BAD_PDF_MESSAGE =
  "Couldn't read this PDF. It may be corrupted or password-protected.";
export const SCANNED_PDF_MESSAGE =
  "Couldn't read text from this PDF. It may be a scanned/image PDF.";

// Reads the text of the first pages. keepLines keeps line breaks (for editing a resume);
// otherwise everything becomes one line of single spaces (for the AI prompt).
export const readPdfText = async (buffer, { maxPages, keepLines = false }) => {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    verbosity: 0, // only errors: skips harmless font warnings
  });

  try {
    const pdf = await task.promise;
    const pages = Math.min(pdf.numPages, maxPages);
    let text = "";

    for (let n = 1; n <= pages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      text += keepLines
        ? content.items.map((i) => i.str + (i.hasEOL ? "\n" : " ")).join("") + "\n"
        : content.items.map((i) => i.str).join(" ") + "\n";
    }

    return keepLines
      ? text
          .replace(/[ \t]+/g, " ")
          .replace(/ ?\n ?/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      : text.replace(/\s+/g, " ").trim();
  } finally {
    await Promise.resolve(task.destroy()).catch(() => {});
  }
};