const { contextBridge, ipcRenderer } = require("electron");

let dragging = false;

function onMouseMove() {
  if (dragging) ipcRenderer.send("valbox-drag-move");
}

function onMouseUp() {
  if (!dragging) return;
  dragging = false;
  ipcRenderer.send("valbox-drag-stop");
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}

function startDrag() {
  if (dragging) return;
  dragging = true;
  ipcRenderer.send("valbox-drag-start");
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

function minimizeWindow() {
  ipcRenderer.send("valbox:minimize-sync");
}

function closeWindow() {
  ipcRenderer.send("valbox:close-sync");
}

function bindWindowControls() {
  if (window.__valboxControlsBound) return;
  window.__valboxControlsBound = true;

  document.addEventListener(
    "pointerup",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actionEl = target.closest("[data-valbox-action]");
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-valbox-action");
      if (action === "minimize") {
        event.preventDefault();
        event.stopPropagation();
        minimizeWindow();
        return;
      }
      if (action === "close") {
        event.preventDefault();
        event.stopPropagation();
        closeWindow();
      }
    },
    true,
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-valbox-action]")) return;
      if (!target.closest("[data-valbox-drag]")) return;
      startDrag();
    },
    true,
  );
}

const bridge = {
  isDesktop: true,
  minimize: minimizeWindow,
  close: closeWindow,
  dragStart: startDrag,
};

contextBridge.exposeInMainWorld("valboxDesktop", bridge);
contextBridge.exposeInMainWorld("valcnDesktop", bridge);

bindWindowControls();
document.addEventListener("DOMContentLoaded", bindWindowControls, { once: true });
window.addEventListener("pageshow", bindWindowControls);
