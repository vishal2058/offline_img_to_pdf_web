(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { files: [], draggingIndex: null, cancelled: false, busy: false, toastTimer: null };
  const supported = new Set(["image/jpeg","image/png","image/webp","image/bmp","image/gif","image/avif"]);
  const fileInput = $("fileInput");
  const dropZone = $("dropZone");
  const imageList = $("imageList");

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  }
  function showToast(message, error=false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
  }
  function updateSummary() {
    const count = state.files.length;
    $("imageCount").textContent = count;
    $("emptyHint").hidden = count > 0;
    $("createBtn").disabled = count === 0 || state.busy;
    $("exportSummary").textContent = count ? `${count} image${count===1?"":"s"} · one PDF document` : "Add images to get started.";
    $("addMoreBtn").disabled = state.busy;
    $("browseBtn").disabled = state.busy;
    $("clearBtn").disabled = state.busy || count === 0;
  }
  function renderList() {
    imageList.replaceChildren();
    state.files.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "image-row";
      row.draggable = !state.busy;
      row.dataset.index = String(index);
      const handle = document.createElement("div");
      handle.className = "drag-handle"; handle.textContent = "⠿"; handle.title = "Drag to reorder";
      const thumb = document.createElement("img");
      thumb.className = "thumb"; thumb.alt = ""; thumb.src = entry.url;
      const info = document.createElement("div"); info.className = "image-info";
      const name = document.createElement("div"); name.className = "image-name"; name.textContent = entry.file.name;
      const meta = document.createElement("div"); meta.className = "image-meta"; meta.textContent = formatBytes(entry.file.size);
      info.append(name, meta);
      const page = document.createElement("span"); page.className = "page-tag"; page.textContent = `PAGE ${String(index+1).padStart(2,"0")}`;
      const remove = document.createElement("button"); remove.className = "remove-image"; remove.type = "button"; remove.textContent = "×";
      remove.title = `Remove ${entry.file.name}`; remove.setAttribute("aria-label", remove.title);
      remove.disabled = state.busy;
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(entry.url);
        state.files.splice(index, 1); renderList();
      });
      row.append(handle, thumb, info, page, remove);
      row.addEventListener("dragstart", (event) => {
        state.draggingIndex = index;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        row.classList.add("drag-over");
      });
      row.addEventListener("dragend", () => {
        state.draggingIndex = null;
        imageList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
      });
      row.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect="move"; row.classList.add("drag-over"); });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (event) => {
        event.preventDefault(); row.classList.remove("drag-over");
        const from = Number(event.dataTransfer.getData("text/plain"));
        const to = index;
        if (Number.isInteger(from) && from !== to && from >= 0 && from < state.files.length) {
          const [moved] = state.files.splice(from, 1); state.files.splice(to, 0, moved); renderList();
        }
      });
      imageList.append(row);
    });
    updateSummary();
  }
  function addFiles(fileList) {
    if (state.busy) return;
    const incoming = Array.from(fileList || []);
    let added = 0, skipped = 0;
    for (const file of incoming) {
      if (!file.type.startsWith("image/") && !supported.has(file.type)) { skipped++; continue; }
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (state.files.some(item => item.key === key)) continue;
      const url = URL.createObjectURL(file);
      state.files.push({file, url, key});
      added++;
    }
    renderList();
    if (added) showToast(`Added ${added} image${added===1?"":"s"}. Drag rows to reorder.`);
    else if (skipped) showToast("Choose supported image files.", true);
    if (skipped && added) showToast(`${added} image(s) added; ${skipped} non-image file(s) skipped.`);
    fileInput.value = "";
  }
  $("browseBtn").addEventListener("click", () => fileInput.click());
  $("addMoreBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => addFiles(fileInput.files));
  $("clearBtn").addEventListener("click", () => {
    if (state.busy) return;
    state.files.forEach(entry => URL.revokeObjectURL(entry.url));
    state.files = []; renderList();
  });
  for (const eventName of ["dragenter","dragover"]) {
    dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add("dragging"); });
  }
  for (const eventName of ["dragleave","drop"]) {
    dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove("dragging"); });
  }
  dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files));
  $("quality").addEventListener("input", () => $("qualityValue").textContent = `${$("quality").value}%`);
  $("cancelBtn").addEventListener("click", () => { state.cancelled = true; $("cancelBtn").disabled = true; $("progressLabel").textContent = "Cancelling…"; });

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`This browser could not open "${file.name}".`)); };
      img.src = url;
    });
  }
  function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not encode an image.")), "image/jpeg", quality);
    });
  }
  function getPageSize(mode, width, height) {
    if (mode === "image") return [width * 0.75, height * 0.75]; // CSS pixels to PDF points at 96dpi -> 72pt/in
    if (mode === "letter") return [612, 792];
    return [595.276, 841.89]; // A4 points
  }
  async function preparePage(entry, options) {
    const image = await readImage(entry.file);
    let width = image.naturalWidth, height = image.naturalHeight;
    const maxDimension = Number(options.maxDimension);
    if (maxDimension > 0 && Math.max(width,height) > maxDimension) {
      const scale = maxDimension / Math.max(width,height);
      width = Math.max(1, Math.round(width*scale)); height = Math.max(1, Math.round(height*scale));
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", {alpha:false});
    context.fillStyle = "#ffffff"; context.fillRect(0,0,width,height);
    context.drawImage(image,0,0,width,height);
    const blob = await canvasToJpeg(canvas, Number(options.quality)/100);
    // Release canvas backing store promptly to reduce peak memory use.
    canvas.width = 1; canvas.height = 1;
    return {blob, width, height};
  }

  // Tiny PDF writer: embeds browser-encoded JPEGs directly; no external library or network.
  async function buildPdf(pages, options, onProgress) {
    const chunks = [];
    let byteOffset = 0;
    const encoder = new TextEncoder();
    const pushBytes = (bytes) => { chunks.push(bytes); byteOffset += bytes.length; };
    const pushText = (text) => pushBytes(encoder.encode(text));
    const offsets = [0];
    const objects = [];
    const addObject = (bodyParts) => objects.push(bodyParts);
    const pageIds = [];
    let nextId = 3; // 1 catalog, 2 pages tree

    for (let i=0;i<pages.length;i++) {
      if (state.cancelled) throw new Error("__CANCELLED__");
      const page = pages[i];
      const [pageW,pageH] = getPageSize(options.pageSize,page.width,page.height);
      const margin = options.pageSize === "image" ? 0 : 24;
      const availW = Math.max(1,pageW-margin*2), availH = Math.max(1,pageH-margin*2);
      const scale = options.fitMode === "fill" ? Math.max(availW/page.width,availH/page.height) : Math.min(availW/page.width,availH/page.height);
      const drawW = page.width*scale, drawH=page.height*scale;
      const x=(pageW-drawW)/2, y=(pageH-drawH)/2;
      const imageId=nextId++, contentId=nextId++, pageId=nextId++;
      const jpegBytes = new Uint8Array(await page.blob.arrayBuffer());
      addObject([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),jpegBytes,encoder.encode("\nendstream")]);
      const content = `q\n${drawW.toFixed(3)} 0 0 ${drawH.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
      addObject([encoder.encode(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`)]);
      addObject([encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)]);
      pageIds.push(pageId);
      onProgress(i+1,pages.length,"Assembling PDF…");
    }
    // Objects 1 and 2 are reserved before the per-page objects.
    const allObjects = [
      [encoder.encode(`<< /Type /Catalog /Pages 2 0 R >>`)],
      [encoder.encode(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`)],
      ...objects
    ];
    pushText("%PDF-1.4\n%");
    pushBytes(new Uint8Array([0xe2,0xe3,0xcf,0xd3,0x0a]));
    for (let i=0;i<allObjects.length;i++) {
      offsets.push(byteOffset);
      pushText(`${i+1} 0 obj\n`);
      for (const part of allObjects[i]) pushBytes(part);
      pushText("\nendobj\n");
    }
    const xrefOffset=byteOffset;
    pushText(`xref\n0 ${allObjects.length+1}\n0000000000 65535 f \n`);
    for (let i=1;i<offsets.length;i++) pushText(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);
    pushText(`trailer\n<< /Size ${allObjects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return new Blob(chunks,{type:"application/pdf"});
  }
  function setBusy(busy) {
    state.busy=busy;
    $("createBtn").disabled=busy || state.files.length===0;
    $("addMoreBtn").disabled=busy; $("browseBtn").disabled=busy; $("clearBtn").disabled=busy || !state.files.length;
    $("pageSize").disabled=busy; $("fitMode").disabled=busy; $("quality").disabled=busy; $("maxDimension").disabled=busy; $("fileName").disabled=busy;
    imageList.querySelectorAll("button").forEach(button=>button.disabled=busy);
    imageList.querySelectorAll(".image-row").forEach(row=>row.draggable=!busy);
  }
  $("createBtn").addEventListener("click", async () => {
    if (!state.files.length || state.busy) return;
    const filename = $("fileName").value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,"-").replace(/\.pdf$/i,"") || "my-images";
    const options = {pageSize:$("pageSize").value,fitMode:$("fitMode").value,quality:$("quality").value,maxDimension:$("maxDimension").value};
    state.cancelled=false; setBusy(true);
    $("progressWrap").hidden=false; $("progressBar").style.width="0%"; $("progressPercent").textContent="0%";
    $("progressLabel").textContent="Preparing images…"; $("cancelBtn").disabled=false;
    try {
      const pages=[];
      for (let i=0;i<state.files.length;i++) {
        if (state.cancelled) throw new Error("__CANCELLED__");
        const page=await preparePage(state.files[i],options); pages.push(page);
        const percent=Math.round(((i+1)/state.files.length)*65);
        $("progressBar").style.width=`${percent}%`; $("progressPercent").textContent=`${percent}%`;
        $("progressLabel").textContent=`Preparing image ${i+1} of ${state.files.length}`;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if (state.cancelled) throw new Error("__CANCELLED__");
      const blob=await buildPdf(pages,options,(done,total,label)=>{
        const percent=65+Math.round((done/total)*35);
        $("progressBar").style.width=`${percent}%`; $("progressPercent").textContent=`${percent}%`; $("progressLabel").textContent=label;
      });
      if (state.cancelled) throw new Error("__CANCELLED__");
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a"); anchor.href=url; anchor.download=`${filename}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      $("progressBar").style.width="100%"; $("progressPercent").textContent="100%"; $("progressLabel").textContent="PDF downloaded";
      showToast(`Created ${pages.length}-page PDF successfully.`);
    } catch (error) {
      if (error.message==="__CANCELLED__") showToast("Export cancelled.");
      else { console.error(error); showToast(error.message || "Could not create the PDF.",true); }
      $("progressLabel").textContent=error.message==="__CANCELLED__"?"Export cancelled":"Export failed";
    } finally {
      setBusy(false); $("cancelBtn").disabled=false;
    }
  });
  window.addEventListener("beforeunload", () => state.files.forEach(entry=>URL.revokeObjectURL(entry.url)));
  updateSummary();
})();
