import { useEffect, useState, useMemo } from "react";

// Helper functions reused from CreateReport.jsx to generate outputs
function classificationForOutput(val) {
  if (val === "U") return "U";
  if (val === "CUI") return "CUI";
  if (val === "CUIREL") return "CUI//REL TO USA, FVEY";
  return String(val || "");
}
function makeDTG(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 7 || !timeStr || timeStr.length < 4) return "";
  const DD = dateStr.slice(0, 2);
  const MMM = dateStr.slice(2, 5).toUpperCase();
  const YY = dateStr.slice(5, 7);
  const HH = timeStr.slice(0, 2);
  const MM = timeStr.slice(2, 4);
  return `${DD}${HH}${MM}Z${MMM}${YY}`;
}
function cleanSourceType(t) {
  if (!t) return "";
  return t.replace(/\s*User$/i, "").trim();
}


export default function ViewReport({ reportId, onClose, onDeleteSuccess, onEdit }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [chatOutput, setChatOutput] = useState("");
  const [reportOutput, setReportOutput] = useState("");
  const [citationOutput, setCitationOutput] = useState("");

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const API_KEY = import.meta.env.VITE_API_KEY;
  const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;

  // Get current user info from localStorage to check permissions
  const {isAdmin, userCin} = useMemo(() => ({
    isAdmin: localStorage.getItem("is_admin") === "true",
    userCin: localStorage.getItem("cin") || null
  }), []);

  useEffect(() => {
    if (!reportId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const authToken = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/reports/${reportId}`, {
          headers: { "x-api-key": API_KEY, ...(authToken && { Authorization: `Bearer ${authToken}` }) }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancel) setReport(data);
      } catch (err) {
        if (!cancel) setError(String(err));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [reportId, API_URL, API_KEY]);

  useEffect(() => {
    if (!report) return;
    const oc = classificationForOutput(report.overall_classification);
    const cc = classificationForOutput(report.collector_classification);
    const dtg = makeDTG(report.date_of_information, report.time);
    setChatOutput(`(${oc}) ${dtg} (${report.mgrs || ""}) ${report.source_platform || ""} ${report.is_usper ? "(USPER) " : ""}${report.source_name || ""} | (U) ${report.did_what || ""} ${report.report_body || ""} (MGRS FOR REFERENCE ONLY. PUBLICLY AVAILABLE INFORMATION: SOURCE IS UNVERIFIED) | ${report.created_by || ""} | (${cc}) COLLECTOR COMMENT: ${report.source_description || ""} (${oc})`);
    setReportOutput(`(${oc}) On ${dtg}, ${report.source_platform || ""} ${report.is_usper ? "(USPER) " : ""}${report.source_name || ""}\n${report.did_what || ""} ${report.report_body || ""}\n(${report.mgrs || ""})\n\n(${cc}) COLLECTOR COMMENT: ${report.source_description || ""}`);
    let citation;
    if (report.did_what === "published") {
      citation = `(${oc}) ${cleanSourceType(report.source_platform)} | ${report.is_usper ? "(USPER) " : ""}${report.source_name || ""} | ${report.article_title || ""} | ${report.article_author || ""} | ${report.uid || ""} | ${dtg} | UNCLASSIFIED | U.S. Person: ${report.is_usper || report.has_uspi ? "YES" : "NO"}`;
    } else {
      citation = `(${oc}) ${cleanSourceType(report.source_platform)} | ${report.is_usper ? "(USPER) " : ""}${report.source_name || ""} | ${report.uid || ""} | ${dtg} | UNCLASSIFIED | U.S. Person: ${report.is_usper || report.has_uspi ? "YES" : "NO"}`;
    }
    setCitationOutput(citation);
  }, [report]);

  const handleDelete = async () => {
    if (!reportId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const authToken = localStorage.getItem("token");
      const reportRes = await fetch(`${API_URL}/reports/${reportId}`, {
        method: 'DELETE',
        headers: { "x-api-key": API_KEY, ...(authToken && { Authorization: `Bearer ${authToken}` }) }
      });
      if (!reportRes.ok) throw new Error(`Failed to delete report: ${reportRes.status}`);

      if (report.image_url) {
        const imageRes = await fetch(report.image_url, {
          method: 'DELETE',
          headers: { 'x-api-key': IMG_API_KEY }
        });
        if (!imageRes.ok) {
          console.error(`Failed to delete image: ${imageRes.status}`);
        }
      }
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      onClose();

    } catch (err) {
      setDeleteError(String(err));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const canEdit = report && (isAdmin || userCin === report.created_by);

  const copy = async (text) => navigator.clipboard.writeText(text ?? "");

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p>Loading report...</p>}
        {error && <p className="text-red-400">Error: {error}</p>}
        {report && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <ClassificationBanner classification={report.overall_classification} />
                <h2 className="text-xl font-bold text-slate-100">{report.title}</h2>
                <MetadataRow label="Date of Info" value={`${report.date_of_information} ${report.time}Z`} />
                <MetadataRow label="Created By" value={report.created_by} />
                <MetadataRow label="Created On" value={report.created_on} />
                <hr className="border-slate-600" />
                <MetadataRow label="Country" value={report.country} />
                <MetadataRow label="Location" value={report.location} />
                <MetadataRow label="MGRS" value={report.mgrs} />
                <MetadataRow label="Additional Comment Text" value={report.additional_comment_text} />
              </div>
              <ImagePane imageUrl={report.image_url} />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-700">
              <Output text={chatOutput} onCopy={copy} label="Chat Output" />
              <Output text={reportOutput} onCopy={copy} label="Report Output" />
              <Output text={citationOutput} onCopy={copy} label="Citation Output" />
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <button
                type="button"
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white font-semibold rounded-md disabled:opacity-50"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!canEdit}
                title={!canEdit ? "Only the author or an admin can delete" : "Delete Report"}
              >
                DELETE
              </button>
              {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
              <button
                type="button"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onEdit(report)}
                disabled={!canEdit}
                title={!canEdit ? "Only the author or an admin can edit" : "Edit Report"}
              >
                EDIT
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-slate-900 border border-red-500 rounded-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Are you sure?</h3>
            <p className="text-slate-300">This action will permanently delete the report and its associated image. This cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded-md disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Sub-components
function ClassificationBanner({ classification }) {
  const styles = { U: "bg-green-600", CUI: "bg-purple-600", CUIREL: "bg-blue-600" };
  return <div className={`text-white text-center font-bold text-sm py-1 rounded ${styles[classification] || 'bg-gray-500'}`}>{classificationForOutput(classification)}</div>;
}
function MetadataRow({ label, value }) {
  return <div className="grid grid-cols-3 gap-2 text-sm"><span className="font-semibold text-slate-400 col-span-1">{label}:</span><span className="text-slate-200 col-span-2">{value || '—'}</span></div>;
}
function Output({ text, onCopy, label }) {
  return <div><label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label><textarea readOnly value={text} className="w-full text-xs min-h-[100px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2" /><button type="button" className="w-full mt-2 h-8 rounded-md text-sm bg-slate-700 hover:bg-slate-600 border border-green-400 text-green-400" onClick={() => onCopy(text)}>Copy {label}</button></div>;
}
function ImagePane({ imageUrl: url }) {
  const [imgBlobUrl, setImgBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;
  useEffect(() => {
    if (!url) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(url, { headers: { "x-api-key": IMG_API_KEY } });
        if (!res.ok) throw new Error("Image fetch failed");
        const blob = await res.blob();
        if (!cancel) setImgBlobUrl(URL.createObjectURL(blob));
      } catch (err) { console.error(err); } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; if (imgBlobUrl) URL.revokeObjectURL(imgBlobUrl); };
  }, [url, IMG_API_KEY]);
  const handleDownload = () => {
    if (!imgBlobUrl) return;
    const a = document.createElement("a");
    a.href = imgBlobUrl;
    a.download = url.split('/').pop() || 'image';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  if (!url) return <div className="text-sm text-slate-400 flex items-center justify-center bg-slate-900 rounded-md border border-dashed border-slate-600">No Image Attached</div>;
  if (loading) return <div className="text-sm text-slate-400">Loading image...</div>;
  return (
    <div className="space-y-2">
      <div className="w-full h-48 bg-slate-900 rounded-md border border-slate-600 flex items-center justify-center overflow-hidden">
        {imgBlobUrl ? <img src={imgBlobUrl} alt="Report attachment" className="object-contain max-h-full max-w-full" /> : <p className="text-sm text-slate-500">Could not load image</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setIsPreviewOpen(true)} disabled={!imgBlobUrl} className="flex-1 h-8 text-sm rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Preview</button>
        <button onClick={handleDownload} disabled={!imgBlobUrl} className="flex-1 h-8 text-sm rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Download</button>
      </div>
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setIsPreviewOpen(false)}>
          <img src={imgBlobUrl} alt="Report attachment preview" className="max-h-[90vh] max-w-[90vw]" />
        </div>
      )}
    </div>
  );
}