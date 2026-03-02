/* =========================================================
   FileVault – Frontend Logic
   window.location.origin se auto IP/domain detect karta hai
   ========================================================= */

const API_BASE = window.location.origin + "/api";

// DOM References
const dropzone        = document.getElementById("dropzone");
const fileInput       = document.getElementById("fileInput");
const filePreview     = document.getElementById("filePreview");
const filePreviewName = document.getElementById("filePreviewName");
const filePreviewSize = document.getElementById("filePreviewSize");
const uploadBtn       = document.getElementById("uploadBtn");
const progressWrap    = document.getElementById("progressWrap");
const progressBar     = document.getElementById("progressBar");
const uploadAlert     = document.getElementById("uploadAlert");
const refreshBtn      = document.getElementById("refreshBtn");
const fileList        = document.getElementById("fileList");
const loadingState    = document.getElementById("loadingState");
const emptyState      = document.getElementById("emptyState");

let selectedFile = null;

// Utilities
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getFileIcon(mimetype) {
  if (!mimetype) return "📄";
  if (mimetype.startsWith("image/"))       return "🖼️";
  if (mimetype.startsWith("video/"))       return "🎬";
  if (mimetype.startsWith("audio/"))       return "🎵";
  if (mimetype === "application/pdf")      return "📕";
  if (mimetype.includes("zip") || mimetype.includes("compressed")) return "🗜️";
  if (mimetype.includes("word"))           return "📝";
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel")) return "📊";
  if (mimetype.startsWith("text/"))        return "📃";
  return "📄";
}

function showAlert(message, type = "success") {
  uploadAlert.textContent = message;
  uploadAlert.className = `alert show ${type}`;
  setTimeout(() => { uploadAlert.className = "alert"; }, 4000);
}

// File Selection
function handleFileSelection(file) {
  if (!file) return;
  selectedFile = file;
  filePreviewName.textContent = file.name;
  filePreviewSize.textContent = formatBytes(file.size);
  filePreview.style.display = "flex";
  uploadBtn.disabled = false;
}

fileInput.addEventListener("change", () => handleFileSelection(fileInput.files[0]));

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelection(file);
});

// Upload File
uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append("file", selectedFile);

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading…";
  progressWrap.style.display = "block";
  progressBar.style.width = "0%";

  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 85);
    progressBar.style.width = progress + "%";
  }, 150);

  try {
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    clearInterval(progressInterval);
    progressBar.style.width = "100%";

    const data = await response.json();

    if (data.success) {
      showAlert("✅ File uploaded successfully!", "success");
      resetUploadForm();
      fetchFiles();
    } else {
      showAlert("❌ " + (data.message || "Upload failed."), "error");
    }
  } catch (error) {
    clearInterval(progressInterval);
    console.error("Upload error:", error);
    showAlert("❌ Network error. Is the server running?", "error");
  } finally {
    setTimeout(() => {
      progressWrap.style.display = "none";
      progressBar.style.width = "0%";
    }, 600);
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<span class="btn-icon">⬆</span> Upload File';
  }
});

function resetUploadForm() {
  selectedFile = null;
  fileInput.value = "";
  filePreview.style.display = "none";
  uploadBtn.disabled = true;
}

// Fetch Files
async function fetchFiles() {
  loadingState.style.display = "block";
  emptyState.style.display = "none";
  fileList.style.display = "none";

  try {
    const response = await fetch(`${API_BASE}/files`);
    const data = await response.json();

    loadingState.style.display = "none";

    if (!data.success || !data.files || data.files.length === 0) {
      emptyState.style.display = "block";
      emptyState.querySelector("p").textContent = "No files uploaded yet.";
      return;
    }

    renderFiles(data.files);
  } catch (error) {
    loadingState.style.display = "none";
    emptyState.style.display = "block";
    emptyState.querySelector("p").textContent = "Could not connect to server.";
    console.error("Fetch files error:", error);
  }
}

// Render Files
function renderFiles(files) {
  fileList.innerHTML = "";
  files.forEach((file) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.dataset.id = file._id;
    li.innerHTML = `
      <div class="file-type-icon">${getFileIcon(file.mimetype)}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(file.originalName)}">${escapeHtml(file.originalName)}</div>
        <div class="file-meta">
          <span>📦 ${formatBytes(file.size)}</span>
          <span>🕒 ${formatDate(file.uploadDate)}</span>
          <span>🏷️ ${file.mimetype || "unknown"}</span>
        </div>
      </div>
      <div class="file-actions">
        <a href="/uploads/${encodeURIComponent(file.filename)}"
           download="${escapeHtml(file.originalName)}"
           class="btn btn-download">⬇ Download</a>
        <button class="btn btn-danger" onclick="deleteFile('${file._id}')">🗑 Delete</button>
      </div>
    `;
    fileList.appendChild(li);
  });
  fileList.style.display = "flex";
}

// Delete File
async function deleteFile(id) {
  if (!confirm("Are you sure you want to delete this file?")) return;
  try {
    const response = await fetch(`${API_BASE}/files/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (data.success) {
      const item = document.querySelector(`.file-item[data-id="${id}"]`);
      if (item) {
        item.style.opacity = "0";
        item.style.transform = "translateX(20px)";
        item.style.transition = "all 0.3s ease";
        setTimeout(() => fetchFiles(), 300);
      }
    } else {
      alert("Failed to delete: " + (data.message || "Unknown error"));
    }
  } catch (error) {
    alert("Network error. Could not delete file.");
  }
}

// Helpers
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Refresh Button
refreshBtn.addEventListener("click", () => {
  refreshBtn.textContent = "↻ Refreshing…";
  refreshBtn.disabled = true;
  fetchFiles().finally(() => {
    refreshBtn.textContent = "↻ Refresh";
    refreshBtn.disabled = false;
  });
});

// Init
fetchFiles();
