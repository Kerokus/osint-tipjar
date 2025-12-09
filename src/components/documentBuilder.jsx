import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";

//THIS BUILDS THE .DOCX FOR THE INTSUM

// --- Helper: Fetch Image as Buffer ---
async function fetchImageBuffer(url, apiKey) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blob.arrayBuffer();
  } catch (e) {
    console.error("Error fetching image for docx:", e);
    return null;
  }
}

// --- Main Generator Function ---
export const generateDocx = async ({
  reports,
  displayList,
  summary,
  rangeLabel,
  uniqueRequirements,
  hasUsper,
  captions, // Passed from parent state
  reportCitationMap,
  apiKey,
  imageApiKey
}) => {
  
  const docChildren = [];

  // 1. Header
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "513th OSINT Daily Reporting Roll-Up",
          bold: true,
          underline: { type: "single" },
          size: 28, // 14pt
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: rangeLabel,
          bold: true,
          color: "666666",
          size: 20, // 10pt
          allCaps: true,
          font: "Arial",
        }),
      ],
      spacing: { after: 300 }, // Margin bottom
    })
  );

  // 2. Requirements
  if (uniqueRequirements) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "(CUI//REL TO USA, FVEY) REQUIREMENT NUMBER(S): ", bold: true, font: "Arial", size: 24 }),
          new TextRun({ text: uniqueRequirements, font: "Arial", size: 24 }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // 3. Warning Box (Using a Table for background/borders)
  const warningText = [
    new TextRun({ text: "WARNING: ", bold: true, underline: { type: "single" }, font: "Arial", size: 24 }),
    new TextRun({ text: "This is an information report, not finally evaluated intelligence. MGRS locations are for general reference purposes only and do not represent the actual location of events unless otherwise specified. ", font: "Arial", size: 24 }),
  ];

  if (hasUsper) {
    warningText.push(
      new TextRun({ text: "This report or its enclosure(s) contains U.S. Person Information that has been deemed necessary for the intended mission, need to understand, assess, or act on the information provided, in accordance with (IAW) DoD Manual 5240.01 and Executive Order 12333. It should be handled IAW the recipient's intelligence oversight or information handling procedures.", font: "Arial", size: 24 })
    );
  }

  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: warningText }),
                new Paragraph({ children: [new TextRun({ text: "Summary produced via AI model; review for accuracy.", italics: true, size: 18, color: "666666", font: "Arial" })], spacing: { before: 100 } })
              ],
              shading: { fill: "F9FAFB" }, // Light gray
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2 },
                bottom: { style: BorderStyle.SINGLE, size: 2 },
                left: { style: BorderStyle.SINGLE, size: 2 },
                right: { style: BorderStyle.SINGLE, size: 2 },
              },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ text: "", spacing: { after: 300 } }) // Spacer
  );

  // 4. Summary
  if (summary) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "(CUI) SUMMARY: ", bold: true, font: "Arial", size: 24 }),
          new TextRun({ text: summary, font: "Arial", size: 24 }),
        ],
        spacing: { after: 300 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  // 5. Reporting Loop
  for (const item of displayList) {
    if (item.type === "HEADER") {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: item.title, bold: true, underline: { type: "single" }, allCaps: true, font: "Arial", size: 24 }),
          ],
          spacing: { before: 200, after: 100 },
          alignment: AlignmentType.CENTER,
        })
      );
    } else if (item.type === "NSTR") {
      docChildren.push(new Paragraph({ text: "NSTR", font: "Arial", size: 24, spacing: { after: 200 } }));
    } else if (item.type === "REPORT") {
      const r = item.data;
      
      // Formatting Data
      const citationIndex = reportCitationMap.get(r.id);
      const dtgStr = parseDtgFromTitleHelper(r.title);
      const classif = classificationForOutputHelper(r.overall_classification);
      const collClassif = classificationForOutputHelper(r.collector_classification);
      const sourceType = cleanSourceTypeHelper(r.source_platform);
      const usperTag = r.is_usper ? "(USPER)" : "";

      // 5a. Report Body
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `(${classif}) On ${dtgStr}, ${sourceType} ${usperTag} ${r.source_name} `, bold: true, font: "Arial", size: 24 }),
            new TextRun({ text: `${r.did_what} ${r.report_body}`, font: "Arial", size: 24 }),
            new TextRun({ text: `[${citationIndex}]`, bold: true, superScript: true, font: "Arial", size: 18 }),
          ],
          alignment: AlignmentType.JUSTIFIED,
        }),
        new Paragraph({
          children: [new TextRun({ text: `(${r.mgrs})`, font: "Arial", size: 24 })],
          spacing: { after: 100 },
        })
      );

      // 5b. Collector Comment
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `(${collClassif}) COLLECTOR COMMENT: `, bold: true, font: "Arial", size: 24 }),
            new TextRun({ text: `${r.source_description} ${r.additional_comment_text}`, font: "Arial", size: 24 }),
          ],
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );

      // 5c. Image Handling
      if (r.image_url) {
        const imgBuffer = await fetchImageBuffer(r.image_url, imageApiKey);
        if (imgBuffer) {
          docChildren.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBuffer,
                  transformation: { width: 400, height: 300 }, // Resize to fit page width
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 50 }
            })
          );

          // Image Caption (retrieved from passed captions object)
          const userCaption = captions[r.id] || "";
          if (userCaption) {
            docChildren.push(
               new Paragraph({
                 children: [ new TextRun({ text: userCaption, bold: true, allCaps: true, font: "Arial", size: 20 }) ],
                 alignment: AlignmentType.CENTER,
                 spacing: { after: 200 }
               })
            );
          } else {
             // Placeholder if no caption
             docChildren.push(new Paragraph({ text: "", spacing: { after: 200 } }));
          }
        }
      }
    }
  }

  // 6. Citations Footer
  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "SOURCES / CITATIONS", bold: true, allCaps: true, font: "Arial", size: 16 })],
      border: { top: { style: BorderStyle.SINGLE, size: 1, space: 10 } },
      spacing: { before: 400, after: 100 },
    })
  );

  // Generate numbered list manually or via numbering config (manual is easier for strict formatting)
  const reportItems = displayList.filter(i => i.type === "REPORT");
  reportItems.forEach((item, index) => {
    const r = item.data;
    const dtgStr = parseDtgFromTitleHelper(r.title);
    const line = `${index + 1}. (U) ${cleanSourceTypeHelper(r.source_platform)} | ${r.is_usper ? "(USPER) " : ""}${r.source_name} | ${r.uid || "N/A"} | ${dtgStr} | UNCLASSIFIED | U.S. Person: ${r.is_usper || r.has_uspi ? "YES" : "NO"}`;
    
    docChildren.push(
      new Paragraph({
        text: line,
        font: "Arial",
        size: 16, // 8pt
      })
    );
  });

  // --- Document Assembly ---
  const doc = new Document({
    sections: [{
      properties: {},
      children: docChildren,
    }],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `INTSUM_${new Date().toISOString().split('T')[0]}.docx`);
  });
};

// --- Duplicate Helper Logic (Needed standalone for the helper) ---
function classificationForOutputHelper(val) {
  if (val === "U") return "U";
  if (val === "CUI") return "CUI";
  if (val === "CUIREL") return "CUI//REL TO USA, FVEY";
  return String(val || "U");
}

function cleanSourceTypeHelper(t) { return t ? t.replace(/\s*User$/i, "").trim() : ""; }

function parseDtgFromTitleHelper(title) {
    if (!title) return "UNKNOWN";
    const regex = /^(\d{2})(\d{4})Z([A-Z]{3})(\d{2})_/i;
    const match = title.match(regex);
    if (!match) return "UNKNOWN";
    const [_, day, time, monStr, yearShort] = match;
    const months = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };
    const date = new Date(Date.UTC(2000 + parseInt(yearShort), months[monStr.toUpperCase()], parseInt(day), parseInt(time.substring(0,2)), parseInt(time.substring(2,4))));
    
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const mmm = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const yy = String(date.getUTCFullYear()).slice(-2);
    return `${dd}${hh}${mm}Z${mmm}${yy}`;
}