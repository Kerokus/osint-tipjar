import { useEffect, useRef, useState } from "react";
import SectionHeader from "../components/report_sections/SectionHeader";
import SectionA from "../components/report_sections/SectionA_Metadata";
import SectionB from "../components/report_sections/SectionB_Source";
import { findSourceByName, getDirtyWords, usperCheck, classifyImage } from "../components/supportFunctions";

// Helper functions for SectionA
function formatDDMMMYY(dateUtc) {
  const d = dateUtc.getUTCDate().toString().padStart(2, "0");
  const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL", "AUG","SEP","OCT","NOV","DEC"][dateUtc.getUTCMonth()];
  const y = dateUtc.getUTCFullYear().toString().slice(-2);
  return `${d}${mon}${y}`;
}
function formatHHmmUTC(dateUtc) {
  const h = dateUtc.getUTCHours().toString().padStart(2, "0");
  const m = dateUtc.getUTCMinutes().toString().padStart(2, "0");
  return `${h}${m}`;
}

// Helpers for Chat Output auto-generation
function classificationForOutput(val) {
  if (val === "U") return "U";
  if (val === "CUI") return "CUI";
  if (val === "CUIREL") return "CUI//REL TO USA, FVEY";
  return String(val || "");
}

function makeDTG(dateStr, timeStr) {
  // Inputs expected as: dateStr = DDMMMYY, timeStr = HHmm (UTC)
  if (!dateStr || dateStr.length < 7 || !timeStr || timeStr.length < 4) return "";
  const DD = dateStr.slice(0, 2);
  const MMM = dateStr.slice(2, 5).toUpperCase();
  const YY = dateStr.slice(5, 7);
  const HH = timeStr.slice(0, 2);
  const MM = timeStr.slice(2, 4);
  return `${DD}${HH}${MM}Z${MMM}${YY}`;
}

// Basic sanitizer for building titles and filenames
function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Helper to escape special regex characters from strings
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main function
export default function CreateReport() {
  
  const chatChannels = {
    "U" : "513th_mibt_osint",
    "CUI" : "513th_mibt_osint_cui",
    "CUIREL" : "513th_mibt_osint_cui_rel"
  };

  // Overall classification state
  const [overallClass, setOverallClass] = useState("U");
  const rank = { U: 0, CUI: 1, CUIREL: 2 }; // U < CUI < CUI//REL TO USA, FVEY
  const maxClass = (...vals) => vals.reduce((a, b) => (rank[b] > rank[a] ? b : a), "U");

  // State for Section A
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [cin] = useState(() => localStorage.getItem("cin") || "");
  const [macoms, setMacoms] = useState(["CENTCOM"]);
  const [macom, setMacom] = useState("CENTCOM");
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const [mgrs, setMgrs] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imgFile, setImgFile] = useState(null);
  const [originalImgFile, setOriginalImgFile] = useState(null); 
  const [imageClass, setImageClass] = useState("U");
  // === NEW: State to track if the user has classified the image ===
  const [imageHasBeenClassified, setImageHasBeenClassified] = useState(false);

  // State for Section B
  const [usper, setUsper] = useState(false);
  const [uspi, setUspi] = useState(false);
  const [sourceType, setSourceType] = useState("Website");
  const [sourceName, setSourceName] = useState("");
  const [didWhat, setDidWhat] = useState("reported");
  const [uid, setUid] = useState("");
  const [articleTitle, setArticleTitle] = useState("N/A");
  const [articleAuthor, setArticleAuthor] = useState("N/A");

  // State for auto-populating source info
  const [existingSourceId, setExistingSourceId] = useState(null);
  const [sourceExists, setSourceExists] = useState(false);
  const [matchingSources, setMatchingSources] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [originalSourceData, setOriginalSourceData] = useState(null);
  const [treatAsNewSource, setTreatAsNewSource] = useState(false); 

  // State for Collector Comments
  const [reportBody, setReportBody] = useState("");
  const [collectorClass, setCollectorClass] = useState("U");
  const [sourceDescription, setSourceDescription] = useState("");
  const [additionalComment, setAdditionalComment] = useState("");

  // State for Report Output fields
  const [displayName, setDisplayName] = useState("");
  const [chatChannel, setChatChannel] = useState(chatChannels["U"]); 
  const [chatOutput, setChatOutput] = useState("");
  const [reportOutput, setReportOutput] = useState("");
  const [citationOutput, setCitationOutput] = useState("");
  const [chatMessageSent, setChatMessageSent] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");

  // State for dirty word search
  const [dirtyWords, setDirtyWords] = useState([]);
  const [filterWordFound, setFilterWordFound] = useState(false);
  const [overrideFilter, setOverrideFilter] = useState(false);
  const [sourceFilterWordFound, setSourceFilterWordFound] = useState(false);
  const [sourceOverrideFilter, setSourceOverrideFilter] = useState(false);
  const [additionalCommentFilterWordFound, setAdditionalCommentFilterWordFound] = useState(false);
  const [additionalCommentOverrideFilter, setAdditionalCommentOverrideFilter] = useState(false);
  
  // Submit state for main report form
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");

  // State for manual and automatic classification
  const [manualOverallClass, setManualOverallClass] = useState("U");
  const [autoReportBodyClass, setAutoReportBodyClass] = useState("U");
  const [manualCollectorClass, setManualCollectorClass] = useState("U");
  const [autoCollectorClass, setAutoCollectorClass] = useState("U");
  
  // Submit state for chat message
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    setDisplayName(localStorage.getItem("display_name") || "");
  }, []);

  // UseEffect to auto-select channel
  useEffect(() => {
    setChatChannel(chatChannels[overallClass] || chatChannels["U"]);
  }, [overallClass]);

  // === MODIFIED: Update image classification tracking state ===
  const handleSetImgFile = (file) => {
    setImgFile(file);
    if (file) {
      setOriginalImgFile(file); 
      setImageClass("U"); 
      setImageHasBeenClassified(false); // Reset on new image
    } else {
      setOriginalImgFile(null);
      setImageHasBeenClassified(false); // Reset if image is cleared
    }
  };

  // === MODIFIED: Update image classification tracking state ===
  const handleClassifyImage = async (classification) => {
    if (!originalImgFile) {
      alert("Please upload an image first.");
      return;
    }

    try {
      const classifiedFile = await classifyImage(originalImgFile, classification);
      setImgFile(classifiedFile); 
      setImageClass(classification);
      setImageHasBeenClassified(true); // Mark as classified
    } catch (error) {
      console.error("Failed to classify image:", error);
      alert("An error occurred while adding the classification banner.");
    }
  };

  // Fetch dirty words on component mount
  useEffect(() => {
    async function fetchWords() {
        const words = await getDirtyWords();
        setDirtyWords(words);
    }
    fetchWords();
  }, []);

  // Effect to check for dirty words in the report body and apply classification logic
  useEffect(() => {
    if (!dirtyWords.length || !reportBody) {
        setFilterWordFound(false);
        setOverrideFilter(false);
        setAutoReportBodyClass("U"); // Reset auto class
        return;
    }

    let wordFound = false;
    let highestClassification = "U";

    for (const word of dirtyWords) {
        const escapedWord = escapeRegex(word.dirty_word);
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
        if (regex.test(reportBody)) {
            wordFound = true;
            highestClassification = maxClass(highestClassification, word.word_classification);
        }
    }

    setFilterWordFound(wordFound);
    if (!wordFound) {
      setOverrideFilter(false); // Reset if words are removed
    }

    // Set the auto class based on whether a word is found and not overridden
    const finalReportBodyClass = (wordFound && !overrideFilter) ? highestClassification : "U";
    setAutoReportBodyClass(finalReportBodyClass);

  }, [reportBody, dirtyWords, overrideFilter, maxClass]);

  // Effect to check for dirty words in the source/additional comments and adjust collectorClass
  useEffect(() => {
    if (!dirtyWords.length) {
        setSourceFilterWordFound(false);
        setAdditionalCommentFilterWordFound(false);
        setAutoCollectorClass("U");
        return;
    }

    let foundInSource = false;
    let foundInComment = false;
    let classFromSource = "U";
    let classFromComment = "U";

    for (const word of dirtyWords) {
        const escapedWord = escapeRegex(word.dirty_word);
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

        if (regex.test(sourceDescription)) {
            foundInSource = true;
            classFromSource = maxClass(classFromSource, word.word_classification);
        }

        if (regex.test(additionalComment)) {
            foundInComment = true;
            classFromComment = maxClass(classFromComment, word.word_classification);
        }
    }

    setSourceFilterWordFound(foundInSource);
    setAdditionalCommentFilterWordFound(foundInComment);

    if (!foundInSource) setSourceOverrideFilter(false);
    if (!foundInComment) setAdditionalCommentOverrideFilter(false);

    const effectiveClassFromSource = !sourceOverrideFilter ? classFromSource : "U";
    const effectiveClassFromComment = !additionalCommentOverrideFilter ? classFromComment : "U";
    const finalClass = maxClass(effectiveClassFromSource, effectiveClassFromComment);

    setAutoCollectorClass(finalClass);

  }, [
    sourceDescription, 
    additionalComment, 
    dirtyWords, 
    sourceOverrideFilter, 
    additionalCommentOverrideFilter, 
    maxClass
  ]);
  
  // New "Combiner" effects
  useEffect(() => {
    // The final collectorClass is the higher of the manual and auto settings
    setCollectorClass(maxClass(manualCollectorClass, autoCollectorClass));
  }, [manualCollectorClass, autoCollectorClass, maxClass]);

  useEffect(() => {
    // The final overallClass is the highest of all its inputs
    setOverallClass(maxClass(manualOverallClass, autoReportBodyClass, collectorClass, imageClass));
  }, [manualOverallClass, autoReportBodyClass, collectorClass, imageClass, maxClass]);

  //If the user selects "USPER" it will remove anything in the Source Description field.
  useEffect(() => {
    if (usper) {
      setSourceDescription("");
    }
  }, [usper]);

  // Effect to automatically set USPI if (USPER) is in the report body
  useEffect(() => {
    if (usperCheck(reportBody)) {
      setUspi(true);
    }
  }, [reportBody]);

/**
 * Okay this next section isn't the cleanest. I had wanted to make every aspect of this 
 * page its own component, but I'm not great at passing props and I messed it up
 * So I ended up just moving the rest into this page. Good luck.
 */

  // Logic/effects that were previously in SectionA
  useEffect(() => {
    const now = new Date();
    setDateStr(formatDDMMMYY(now));
    setTimeStr(formatHHmmUTC(now));
  }, []);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}country_locations/country_list_with_codes.json`)
      .then((r) => r.json())
    .then((data) => {
      setMacoms(Object.keys(data));
      const def = data["CENTCOM"] || [];
      setCountries(def.slice().sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, []);
  useEffect(() => {
  fetch(`${import.meta.env.BASE_URL}country_locations/country_list_with_codes.json`)
    .then((r) => r.json())
    .then((data) => {
      const list = (data[macom] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      setCountries(list);
      setCountry("");
    });
}, [macom]);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (!country || !location) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const API_KEY = import.meta.env.VITE_API_KEY;

        if (!API_URL || !API_KEY) {
          throw new Error("API URL or Key is missing from environment variables.");
        }

        const params = new URLSearchParams({
          country: country,
          location: location,
        });
        const endpoint = `${String(API_URL).replace(/\/+$/, "")}/countries?${params.toString()}`;

        const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'x-api-key': API_KEY
            }
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => "Server returned an error");
          throw new Error(`Location search failed: ${res.status} ${errorText}`);
        }

        const data = await res.json();
        setResults(data);

      } catch (err) {
        console.error("Location search error:", err);
        setResults([]); // Clear results on error
      } finally {
        setLoading(false);
      }
    }, 800); // 800ms debounce
    
    return () => clearTimeout(debounceRef.current);
  }, [country, location]);


  const sourceSearchDebounceRef = useRef(null);
    useEffect(() => {
    if (!sourceName.trim()) {
        setSourceExists(false);
        setExistingSourceId(null);
        setOriginalSourceData(null);
        setTreatAsNewSource(false); 
        return;
    }

    if (sourceSearchDebounceRef.current) {
        clearTimeout(sourceSearchDebounceRef.current);
    }

    sourceSearchDebounceRef.current = setTimeout(async () => {
        try {
        const results = await findSourceByName(sourceName);
        
        if (results && results.length === 1) {
            const source = results[0];
            setSourceDescription(source.source_description || "");
            setSourceType(source.source_platform || "Website");
            setExistingSourceId(source.id);
            setSourceExists(true);
            setTreatAsNewSource(false);
            setOriginalSourceData({
                description: source.source_description || "",
                platform: source.source_platform || "Website"
            });
            setShowSourceModal(false);
        } else if (results && results.length > 1) {
            setMatchingSources(results);
            setShowSourceModal(true);
        } else {
            setSourceExists(false);
            setExistingSourceId(null);
            setOriginalSourceData(null);
            setTreatAsNewSource(false);
        }
        } catch (error) {
        console.error("Error finding source:", error);
        }
    }, 1000);

  return () => clearTimeout(sourceSearchDebounceRef.current);
}, [sourceName]);

const handleSourceSelect = (source) => {
    setSourceDescription(source.source_description || "");
    setSourceType(source.source_platform || "Website");
    setExistingSourceId(source.id);
    setSourceExists(true);
    setTreatAsNewSource(false);
    setOriginalSourceData({
        description: source.source_description || "",
        platform: source.source_platform || "Website"
    });
    setShowSourceModal(false);
};

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleSetImgFile(f);
  };
  const onChoose = (e) => {
    const f = e.target.files?.[0];
    if (f) handleSetImgFile(f);
  };

  const copy = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 10000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  function cleanSourceType(t) {
    if (!t) return "";
    return t.trim().replace(/\s*User$/i, "");
  }

  // === MODIFIED: Reset the new state variable here ===
  const clearForm = () => {
    setMacom("CENTCOM");
    setCountry("");
    setLocation("");
    setMgrs("");
    setResults([]);
    setImgFile(null);
    setOriginalImgFile(null);
    setImageClass("U");
    setImageHasBeenClassified(false); // Reset this
    setUsper(false);
    setUspi(false);
    setSourceType("Website");
    setSourceName("");
    setDidWhat("reported");
    setUid("");
    setArticleTitle("N/A");
    setArticleAuthor("N/A");
    setReportBody("");
    setCollectorClass("U");
    setSourceDescription("");
    setAdditionalComment("");
    setOverallClass("U");
    setManualOverallClass("U");
    setAutoReportBodyClass("U");
    setManualCollectorClass("U");
    setAutoCollectorClass("U");
    setChatChannel(chatChannels["U"]); 
    setChatOutput("");
    setReportOutput("");
    setCitationOutput("");
    setChatMessageSent(false); 
    setExistingSourceId(null);
    setSourceExists(false);
    setShowSourceModal(false);
    setMatchingSources([]);
    setOverrideFilter(false); 
    setOriginalSourceData(null);
    setTreatAsNewSource(false); 
    setSubmitOk("");
    setSubmitError("");
  };

  //CHATSURFER REPORT OUTPUT
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const cc = classificationForOutput(collectorClass);
    const dtg = makeDTG(dateStr, timeStr);
    const usPerson = usper ? "(USPER) " : ""; 
    const mgrsDisp = mgrs || "";
    const srcType = sourceType || "";
    const srcName = sourceName || "";
    const action = didWhat || "";
    const body = reportBody || "";
    const cinDisp = cin || "";
    const comment = sourceDescription || "";
    const adtlComment = additionalComment || "";

    const chat = `(${oc}) ${dtg} (${mgrsDisp}) ${srcType} ${usPerson}${srcName} | (U) ${action} ${body} (MGRS FOR REFERENCE ONLY. PUBLICLY AVAILABLE INFORMATION: SOURCE IS UNVERIFIED) | ${cinDisp} | (${cc}) COLLECTOR COMMENT: ${comment} ${adtlComment} (${oc})`;
    setChatOutput(chat.trim());
    setChatMessageSent(false);
  }, [
    overallClass,
    usper,
    dateStr,
    timeStr,
    mgrs,
    sourceType,
    sourceName,
    didWhat,
    reportBody,
    cin,
    collectorClass,
    sourceDescription,
    additionalComment
  ]);

  //REPORT OUTPUT
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const cc = classificationForOutput(collectorClass);
    const dtg = makeDTG(dateStr, timeStr);
    const srcType = sourceType || "";
    const usPerson = usper ? "(USPER) " : "";
    const srcName = sourceName || "";
    const action = didWhat || "";
    const body = reportBody || "";
    const mgrsDisp = mgrs || "";
    const desc = sourceDescription || "";
    const adtlComment = additionalComment || "";

    const report = `(${oc}) On ${dtg}, ${srcType} ${usPerson}${srcName}\n${action} ${body}\n(${mgrsDisp})\n\n(${cc}) COLLECTOR COMMENT: ${desc} ${adtlComment}`;
    setReportOutput(report.trim());
  }, [
    overallClass,
    collectorClass,
    dateStr,
    timeStr,
    sourceType,
    usper,
    sourceName,
    reportBody,
    mgrs,
    sourceDescription,
    didWhat,
    additionalComment
  ]);

  //CITATION OUTPUT
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const dtg = makeDTG(dateStr, timeStr);
    const srcType = cleanSourceType(sourceType || "");
    const usPersonRep = usper ? "(USPER) " : "";
    const srcName = sourceName || "";
    const uidDisp = uid || "";
    const usPerson = (usper || uspi) ? "YES" : "NO";
    const citationTitle = articleTitle || "";
    const citationAuthor = articleAuthor || "";

    let citation;
    if (didWhat === "published") {
      citation = `(U) ${srcType} | ${usPersonRep}${srcName} | ${citationTitle} | ${citationAuthor} | ${uidDisp} | ${dtg} | UNCLASSIFIED | U.S. Person: ${usPerson}`;
    } else {
      citation = `(U) ${srcType} | ${usPersonRep}${srcName} | ${uidDisp} | ${dtg} | UNCLASSIFIED | U.S. Person: ${usPerson}`;
    }
    setCitationOutput(citation.trim());
  }, [overallClass, dateStr, timeStr, sourceType, sourceName, uid, usper, uspi, articleAuthor, articleTitle, didWhat]);  

  async function handleChatSubmit() {
    if (!reportBody.trim()) {
      alert("Please fill out the Report Body before sending a message.");
      return;
    }
    if (!displayName || displayName === "N/A") {
      alert("Please set your Display Name in Settings before sending a message.");
      return;
    }

    setChatError("");
    setSendingChat(true);

    try {
      const API_URL = "https://3v8o0b4ojc.execute-api.us-gov-west-1.amazonaws.com/send/message";
      const CHAT_API_KEY = import.meta.env.VITE_CHATSURFER_API_KEY;
      
      if (!CHAT_API_KEY) {
        throw new Error("ChatSurfer API Key is missing from environment variables.");
      }
      
      const payload = {
        classification: "UNCLASSIFIED",
        message: chatOutput,
        domainId: "chatsurferxmppunclass",
        nickName: displayName,
        roomName: chatChannel
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CHAT_API_KEY, 
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Chat send failed: ${res.status} ${text}`);
      }

      setChatMessageSent(true);

    } catch (err) {
      console.error(err);
      setChatError(err?.message || "Failed to send chat message.");
    } finally {
      setSendingChat(false);
    }
  }

  // === MODIFIED: Add the validation check at the beginning of the function ===
  async function handleSubmit() {
    // Check if an image exists but has not been explicitly classified
    if (imgFile && !imageHasBeenClassified) {
      alert("Please classify the uploaded image before submitting the report.");
      return; // Stop the submission
    }

    if (!chatMessageSent) {
      const proceed = window.confirm(
        "ChatSurfer Message was not sent. Would you like to submit anyway?"
      );
      if (!proceed) {
        return;
      }
    }

    setSubmitOk("");
    setSubmitError("");
    setSubmitting(true);
    try {
      const dtg = makeDTG(dateStr, timeStr);
      const titleParts = [
        slugify(dtg),
        slugify(country),
        slugify(location),
        slugify(cin),
      ].filter(Boolean);
      const report_title = titleParts.join("_") || "UNTITLED";
      const filename = `${report_title}_IMAGE`;

      const API_URL = import.meta.env.VITE_API_URL;
      const API_KEY = import.meta.env.VITE_API_KEY;
      const IMG_URL = import.meta.env.VITE_IMAGE_UPLOAD_URL;
      const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;

      if (!API_URL) throw new Error("VITE_API_URL missing");
      if (!API_KEY) throw new Error("VITE_API_KEY missing");
      if (imgFile && (!IMG_URL || !IMG_API_KEY)) {
        throw new Error("Image upload env vars missing");
      }

      let image_url = "";
      if (imgFile) {
        const uploadEndpoint = `${String(IMG_URL).replace(
          /\/+$/,
          ""
        )}/${encodeURIComponent(filename)}`;
        const putRes = await fetch(uploadEndpoint, {
          method: "PUT",
          headers: {
            "x-api-key": IMG_API_KEY,
            "Content-Type": imgFile.type || "application/octet-stream",
          },
          body: imgFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text().catch(() => "");
          throw new Error(`Image upload failed: ${putRes.status} ${t}`);
        }
        image_url = uploadEndpoint;
      }

      const reportPayload = {
        overall_classification: overallClass,
        title: report_title,
        date_of_information: dateStr,
        time: timeStr,
        created_by: cin,
        macom,
        country,
        location,
        mgrs,
        is_usper: !!usper,
        has_uspi: !!uspi,
        source_platform: sourceType,
        source_name: sourceName,
        did_what: didWhat,
        uid,
        article_title: articleTitle,
        article_author: articleAuthor,
        report_body: reportBody,
        collector_classification: collectorClass,
        source_description: sourceDescription,
        additional_comment_text: additionalComment,
        ...(image_url ? { image_url } : {}),
      };

      const authToken = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };
      
      const reportRes = await fetch(`${String(API_URL).replace(/\/+$/, "")}/reports`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reportPayload),
      });

      if (!reportRes.ok) {
        const text = await reportRes.text().catch(() => "");
        throw new Error(`Report create failed: ${reportRes.status} ${text}`);
      }
      const reportData = await reportRes.json().catch(() => ({}));

      if (usper) {
        setSubmitOk(
          `USPER Report created${reportData?.id ? " with id " + reportData.id : ""}.`
        );
        return; 
      }

      if (sourceName.trim()) {
        let sourceEndpoint = `${String(API_URL).replace(/\/+$/, "")}/sources`;
        let sourcePayload;
        let sourceMethod;

        if (sourceExists && existingSourceId && !treatAsNewSource) {
          const descriptionChanged = originalSourceData?.description !== sourceDescription;
          const platformChanged = originalSourceData?.platform !== sourceType;

          if (descriptionChanged || platformChanged) {
            sourceMethod = "PUT";
            sourceEndpoint += `/${existingSourceId}`;
            sourcePayload = {
              source_name: sourceName,
              source_description: sourceDescription,
              source_platform: sourceType,
              modified_by: cin, 
            };
          }
        } else {
          sourceMethod = "POST";
          sourcePayload = {
            source_name: sourceName,
            source_description: sourceDescription,
            source_platform: sourceType,
            added_by: cin, 
          };
        }

        if (sourceMethod) {
          const sourceRes = await fetch(sourceEndpoint, {
            method: sourceMethod,
            headers: headers,
            body: JSON.stringify(sourcePayload),
          });

          if (!sourceRes.ok) {
            const text = await sourceRes.text().catch(() => "");
            throw new Error(
              `Report created, but source ${sourceMethod} failed: ${sourceRes.status} ${text}`
            );
          }
        }
      }

      setSubmitOk(
        `Report created${reportData?.id ? " with id " + reportData.id : ""}`
        );
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Input field badges
  const sourceBadge = (() => {
    if (usper) {
      return (
        <div className="ml-3 inline-flex shrink-0 items-center justify-center h-7 px-3 rounded-md bg-red-600 text-black text-xs font-bold select-none">
          SOURCE IS USPER
        </div>
      );
    }
    if (!sourceDescription.trim()) {
      return (
        <div className="ml-3 inline-flex shrink-0 items-center justify-center h-7 px-3 rounded-md bg-orange-500 text-black text-xs font-extrabold select-none">
          COMMENT NOT FOUND
        </div>
      );
    }
    return null;
  })();

  const SourceSelectionModal = () => (
    showSourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-600">
            <h3 className="text-lg font-bold mb-4">Multiple Sources Found</h3>
            <p className="text-sm text-slate-400 mb-4">
            More than one source matches the name "{sourceName}". Please select the correct one.
            </p>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {matchingSources.map((source) => (
                <div key={source.id} className="p-3 bg-slate-900 rounded-md border border-slate-700">
                <p className="font-bold">{source.source_name}</p>
                <p className="text-sm"><span className="font-semibold">Platform:</span> {source.source_platform}</p>
                <p className="text-sm text-slate-300 mt-1"><span className="font-semibold">Description:</span> {source.source_description}</p>
                <button
                    onClick={() => handleSourceSelect(source)}
                    className="mt-3 px-4 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                    Select
                </button>
                </div>
            ))}
            </div>
            <button
            onClick={() => setShowSourceModal(false)}
            className="mt-6 w-full h-9 rounded-md bg-slate-700 text-white font-bold"
            >
            Create New
            </button>
        </div>
        </div>
    )
    );
  
  const isUspiLocked = usperCheck(reportBody);  

  return (
    <div>
      <SourceSelectionModal />
      <SectionHeader
        initialValue={overallClass}
        onChange={(p) => setManualOverallClass(p.value)}
      />
      {/* I FUCKING HATE PROPS */}
      <SectionA
        dateStr={dateStr}
        setDateStr={setDateStr}
        timeStr={timeStr}
        setTimeStr={setTimeStr}
        cin={cin}
        macoms={macoms}
        macom={macom}
        setMacom={setMacom}
        countries={countries}
        country={country}
        setCountry={setCountry}
        location={location}
        setLocation={setLocation}
        mgrs={mgrs}
        setMgrs={setMgrs}
        results={results}
        loading={loading}
        imgFile={imgFile}
        setImgFile={handleSetImgFile}
        onDrop={onDrop}
        onChoose={onChoose}
        clearForm={clearForm}
        onClassifyImage={handleClassifyImage}
      />
      <hr className="my-6 w-full border-sky-300" />
      <SectionB
        usper={usper}
        setUsper={setUsper}
        uspi={uspi}
        setUspi={setUspi}
        isUspiLocked={isUspiLocked}
        sourceType={sourceType}
        setSourceType={setSourceType}
        sourceName={sourceName}
        setSourceName={setSourceName}
        didWhat={didWhat}
        setDidWhat={setDidWhat}
        uid={uid}
        setUid={setUid}
        articleTitle={articleTitle}
        setArticleTitle={setArticleTitle}
        articleAuthor={articleAuthor}
        setArticleAuthor={setArticleAuthor}
      />
      <hr className="my-6 w-full border-sky-300" />

      {/* === Two-column section === */}
      <div className="grid grid-cols-12 gap-4">
        {/* Column 1 */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          {/* Report Body */}
          <div>
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <label className="block text-xs">Report Body</label>
                    {filterWordFound && (
                        <div className="ml-2 inline-flex items-center justify-center h-5 px-2 rounded-md bg-yellow-500 text-black text-xs font-bold select-none">
                            Filter word found
                        </div>
                    )}
                </div>
                {filterWordFound && (
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="overrideFilter"
                            checked={overrideFilter}
                            onChange={(e) => setOverrideFilter(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-600"
                        />
                        <label htmlFor="overrideFilter" className="ml-2 text-xs font-medium text-slate-300">Override Filter</label>
                    </div>
                )}
            </div>
            <textarea
              value={reportBody}
              onChange={(e) => setReportBody(e.target.value)}
              className="w-full min-h-[130px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2 mt-1"
            />
          </div>

          {/* Collector Comment + Source Description container */}
          <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
            <div className="flex items-center">
              <div className="flex-1">
                <label className="block text-xs">Collector Comment</label>
                <SectionHeader
                  initialValue={collectorClass}
                  onChange={(p) => {
                    setManualCollectorClass(p.value);
                    setManualOverallClass((prev) => maxClass(prev, p.value));
                  }}
                />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <label className="text-xs">Source Description:</label>
                    {sourceFilterWordFound && (
                        <div className="ml-2 inline-flex items-center justify-center h-5 px-2 rounded-md bg-yellow-500 text-black text-xs font-bold select-none">
                            Filter word found
                        </div>
                    )}
                    {sourceExists && (
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="newSourceCheckbox"
                                checked={treatAsNewSource}
                                onChange={(e) => setTreatAsNewSource(e.target.checked)}
                                className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-600"
                            />
                            <label htmlFor="newSourceCheckbox" className="ml-2 text-xs font-medium text-slate-300">New Source</label>
                        </div>
                    )}
                </div>
                {sourceBadge}
              </div>
              
              {sourceFilterWordFound && (
                  <div className="flex items-center justify-end mb-2">
                      <input
                          type="checkbox"
                          id="sourceOverrideFilter"
                          checked={sourceOverrideFilter}
                          onChange={(e) => setSourceOverrideFilter(e.target.checked)}
                          className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-600"
                      />
                      <label htmlFor="sourceOverrideFilter" className="ml-2 text-xs font-medium text-slate-300">Override Filter</label>
                  </div>
              )}

              <textarea
                value={sourceDescription}
                onChange={(e) => setSourceDescription(e.target.value)}
                disabled={usper}
                className={`w-full min-h-[120px] rounded-md border border-slate-700 px-3 py-2 ${
                  usper
                    ? "bg-slate-800 opacity-70 cursor-not-allowed"
                    : "bg-slate-900"
                }`}
              />
            </div>
          </div>

          {/* Additional Comment Text */}
          <div>
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <label className="block text-xs">Additional Comment Text</label>
                    {additionalCommentFilterWordFound && (
                        <div className="ml-2 inline-flex items-center justify-center h-5 px-2 rounded-md bg-yellow-500 text-black text-xs font-bold select-none">
                            Filter word found
                        </div>
                    )}
                </div>
                {additionalCommentFilterWordFound && (
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="additionalCommentOverrideFilter"
                            checked={additionalCommentOverrideFilter}
                            onChange={(e) => setAdditionalCommentOverrideFilter(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-600"
                        />
                        <label htmlFor="additionalCommentOverrideFilter" className="ml-2 text-xs font-medium text-slate-300">Override Filter</label>
                    </div>
                )}
            </div>
            <textarea
              value={additionalComment}
              onChange={(e) => setAdditionalComment(e.target.value)}
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2 mt-1"
            />
          </div>
        </div>

        {/* Column 2 */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          {/* 1. ChatSurfer Channel */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="block text-xs">ChatSurfer Channel</label>
              <span className="text-xs text-slate-400">
                ChatSurfer Display Name:{" "}
                <span className="font-medium text-slate-300">
                  {displayName || "N/A"}
                </span>
              </span>
            </div>
            <div className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3 flex items-center">
              <p className="text-sm text-slate-200">{chatChannel}</p>
            </div>
          </div>

          {/* 2. Chat Output */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs">Chat Output</label>
              {chatMessageSent ? (
                <div className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-green-500 text-black text-xs font-extrabold select-none">
                  Message sent
                </div>
              ) : (
                <div className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-orange-500 text-black text-xs font-extrabold select-none">
                  Message not sent
                </div>
              )}
            </div>
            <textarea
              value={chatOutput}
              onChange={(e) => setChatOutput(e.target.value)}
              className="w-full min-h-[160px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-9 rounded-md bg-slate-800 border border-blue-500 text-blue-500 disabled:opacity-60"
                  onClick={handleChatSubmit}
                  disabled={sendingChat}
                >
                  {sendingChat ? "SENDING..." : "Send to ChatSurfer"}
                </button>
                <button
                  type="button"
                  className={`flex-1 h-9 rounded-md bg-slate-800 border transition-all ${
                    copySuccess === 'chat'
                      ? 'border-green-500 text-white'
                      : 'border-green-400 text-green-400'
                  }`}
                  onClick={() => copy(chatOutput, 'chat')}
                >
                  {copySuccess === 'chat' ? 'Copied!' : 'Copy Chat Output'}
                </button>
              </div>
              {chatError ? <div className="text-red-400 text-sm">{chatError}</div> : null}
            </div>
          </div>

          {/* 3. Report Output */}
          <div>
            <label className="block text-xs">Report Output</label>
            <textarea
              value={reportOutput}
              onChange={(e) => setReportOutput(e.target.value)}
              className="w-full min-h-[140px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2">
              <button
                type="button"
                className={`w-full h-9 rounded-md bg-slate-800 border transition-all ${
                  copySuccess === 'report'
                    ? 'border-green-500 text-white'
                    : 'border-green-400 text-green-400'
                }`}
                onClick={() => copy(reportOutput, 'report')}
              >
                {copySuccess === 'report' ? 'Copied!' : 'Copy Report Output'}
              </button>
            </div>
          </div>

          {/* 4. Citation Output */}
          <div>
            <label className="block text-xs">Citation Output</label>
            <textarea
              value={citationOutput}
              onChange={(e) => setCitationOutput(e.target.value)}
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2">
              <button
                type="button"
                className={`w-full h-9 rounded-md bg-slate-800 border transition-all ${
                  copySuccess === 'citation'
                    ? 'border-green-500 text-white'
                    : 'border-green-400 text-green-400'
                }`}
                onClick={() => copy(citationOutput, 'citation')}
              >
                {copySuccess === 'citation' ? 'Copied!' : 'Copy Citation Output'}
              </button>
            </div>
          </div>
          {/* SUBMIT button */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full h-10 rounded-md bg-blue-600 text-white font-bold disabled:opacity-60"
              onClick={handleSubmit}
              disabled={submitting || !!submitOk}
            >
              {submitting ? "SUBMITTING..." : "SUBMIT"}
            </button>
            {submitOk ? (
              <div className="text-green-400 text-sm">{submitOk}</div>
            ) : null}
            {submitError ? (
              <div className="text-red-400 text-sm">{submitError}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}