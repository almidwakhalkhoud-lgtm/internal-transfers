"""User-launched QBM unit recorder. Running this file opens its control window only."""
from __future__ import annotations

import queue
import ctypes
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from catalog import capture, load_checkpoint, load_source, save_checkpoint

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENGINE = Path.home() / "OneDrive" / "Desktop" / "qbmm"
DEFAULT_SOURCE = ROOT / "data" / "sources" / "qbm-items-20261017-raw.json"


def process_name(pid):
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR,
                                                ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return ""
    try:
        buffer = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buffer))
        return Path(buffer.value).name if kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)) else ""
    finally:
        kernel.CloseHandle(handle)


def collect(engine: Path, source: Path, output: Path, stop, emit):
    """Only called by the human pressing Play. No automatic imports into BUZZ."""
    source_hash, items = load_source(source)
    checkpoint = load_checkpoint(output, source_hash)
    checkpoint["expectedRecords"] = len(items)
    if not (engine / "qbm_excel" / "uia_focus.py").is_file():
        raise RuntimeError("Select the existing qbmm project folder")
    sys.path.insert(0, str(engine))
    from qbm_excel import uia_focus
    from qbm_excel.config import load_config
    from qbm_excel.qbm_automation import GridTyper, KeyboardDriver

    if not uia_focus.is_available():
        raise RuntimeError(uia_focus.unavailable_reason())

    def cancelled():
        if stop.is_set():
            raise RuntimeError("Stopped. Checkpoint preserved; cancel any unfinished QBM row manually.")

    class Driver(KeyboardDriver):
        expected_container = ""

        def fence(self):
            cancelled()
            info = uia_focus.focused_info()
            if (not typer.qbm_pid or info.pid != typer.qbm_pid
                    or self.foreground_window() != typer.qbm_hwnd
                    or not typer.on_row_cell(info)):
                raise RuntimeError("QBM row lost focus. No recovery keys sent; resume after checking QBM.")
            if self.expected_container:
                IUIA, UIAElementInfo, _ = uia_focus._import_uia()
                node = UIAElementInfo(IUIA().iuia.GetFocusedElement())
                for _ in range(12):
                    if node is None:
                        break
                    if node.automation_id == self.expected_container:
                        return
                    node = node.parent
                raise RuntimeError("Focus is not inside the expected QBM field; no key sent")

        def press(self, key_name):
            self.fence()
            if key_name.upper() not in {"TAB", "DELETE"}:
                raise RuntimeError("Recorder refused an unexpected key")
            return super().press(key_name)

        def hotkey(self, *keys):
            self.fence()
            if tuple(k.upper() for k in keys) not in {("CTRL", "A"), ("CTRL", "C"), ("CTRL", "V")}:
                raise RuntimeError("Recorder refused an unexpected shortcut")
            return super().hotkey(*keys)

        def _send_unicode(self, character):
            self.fence()
            if ord(character) < 32:
                raise RuntimeError("Control characters are forbidden")
            return super()._send_unicode(character)

        def invoke_button(self, root_hwnd, auto_id, expected_name=""):
            cancelled()
            if (auto_id, expected_name) not in {("buttonAddItem", "Add Item"), ("buttonCancel", "Cancel")}:
                raise RuntimeError("Only row Add Item and row Cancel are allowed")
            if self.foreground_window() != root_hwnd or uia_focus.row_scope(root_hwnd) is None:
                raise RuntimeError("QBM row cannot be verified")
            return super().invoke_button(root_hwnd, auto_id, expected_name)

    class Typer(GridTyper):
        def guard(self):
            driver.fence()
            return self.focused()

        def navigate_to(self, field):
            cancelled()
            if field not in {"item", "description", "qty", "unit"} or not self.jump_to(field):
                raise RuntimeError(f"Direct focus failed: {field}. No fallback navigation sent.")
            driver.expected_container = {"item": "flatComboBoxItems", "description": "editDescription2_EmbeddableTextBox",
                                         "qty": "editQuantity_EmbeddableTextBox", "unit": "unitsComboBoxUOM"}[field]

        def focus_field_directly(self, field):
            driver.expected_container = self.profile["field_containers"].get(field, "")
            return super().focus_field_directly(field)

        def handle_known_dialogs(self):
            raise RuntimeError("Handle the QBM dialog yourself, then resume")

        def abandon_row(self):
            problem = driver.invoke_button(self.qbm_hwnd, "buttonCancel", "Cancel")
            if problem:
                raise RuntimeError(problem)
            time.sleep(0.3)
            uia_focus.forget_cached_elements()
            if self.row_is_open("panelEnter"):
                raise RuntimeError("QBM row did not close after Cancel")

        def ensure_edit_row_open(self):
            if not self.row_is_open("panelEnter"):
                problem = driver.invoke_button(self.qbm_hwnd, "buttonAddItem", "Add Item")
                if problem:
                    raise RuntimeError(problem)
                time.sleep(0.4)
                uia_focus.forget_cached_elements()
            if not self.row_is_open("panelEnter"):
                raise RuntimeError("Open the blank document's Item row manually, then resume")

    # Force the safety settings; the existing app's optional recovery settings are not used.
    profile = {**load_config().qbm_keyboard_profile, "verify_focus": True,
               "focus_fields_directly": True, "abandon_row_escapes": 0}
    profile["field_containers"] = {"item": "flatComboBoxItems", "location": "flatComboBoxListLocation",
                                   "unit": "unitsComboBoxUOM"}
    driver = Driver()
    typer = Typer(driver, profile, log=emit, cancel_event=stop)
    for seconds in range(7, 0, -1):
        cancelled()
        emit(f"Focus the empty Item cell in QBM: {seconds}")
        time.sleep(1)
    info = uia_focus.focused_info()
    hwnd = driver.root_window(info.hwnd) or driver.foreground_window()
    if not info.pid or process_name(info.pid).casefold() != "qbm.exe":
        raise RuntimeError("The focused application is not QBM")
    typer.qbm_pid, typer.qbm_hwnd = info.pid, hwnd
    uia_focus.forget_cached_elements()
    if uia_focus.row_scope(hwnd) is None or not typer.row_is_open("panelEnter"):
        raise RuntimeError("QBM order edit row is not available")
    typer.navigate_to("item")
    if uia_focus.focused_info().value.strip():
        raise RuntimeError("Initial Item cell is not empty; recorder refused to replace it")

    for index, item in enumerate(items):
        if item["itemName"] in checkpoint["items"]:
            continue
        cancelled()
        emit(f"{index + 1}/{len(items)} — {item['itemName']}")
        typer.ensure_edit_row_open()
        typer.navigate_to("item")
        driver.clear_current_field()
        driver.type_text(item["itemName"])
        description = typer.read_description().strip()
        if description != item["description"].strip():
            raise RuntimeError(f"Description mismatch for {item['itemName']}; inspect QBM before resuming")
        typer.navigate_to("qty")
        driver.clear_current_field()
        driver.paste("1")
        typer.navigate_to("unit")
        combo = uia_focus._combo_in(hwnd, "unitsComboBoxUOM")
        if combo is None:
            raise RuntimeError("Unit combo not readable")
        labels = [child.name or "" for child in combo.children() if child.control_type == "ListItem"]
        record = capture(item, description, labels)
        # Checkpoint only after the temporary row has been cancelled successfully.
        typer.abandon_row()
        checkpoint["items"][item["itemName"]] = record
        save_checkpoint(output, checkpoint)
    emit(f"Finished: {len(checkpoint['items'])}/{len(items)}. Unit names captured; conversion factors not captured.")


def main():
    app = tk.Tk()
    app.title("BUZZ · QBM unit recorder")
    app.geometry("780x560")
    app.minsize(650, 480)
    events = queue.Queue()
    stop = threading.Event()
    running = False
    variables = [tk.StringVar(value=str(p)) for p in
                 (DEFAULT_ENGINE, DEFAULT_SOURCE, ROOT / "output" / "qbm" / "unit-capture.json")]
    frame = ttk.Frame(app, padding=20)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="BUZZ / QBM — Record exact available unit names", font=("Segoe UI", 16)).pack(anchor="w")
    ttk.Label(frame, text="ابتدا یک سند آزمایشیِ خالی در QBM باز کنید. این ابزار واحدها را ثبت می‌کند؛\n"
              "ضرایب تبدیل را نمی‌خواند و اطلاعات BUZZ را تغییر نمی‌دهد.", justify="right").pack(fill="x", pady=12)
    for index, label in enumerate(("Existing qbmm project", "QBM Items.json", "Output / resume checkpoint")):
        ttk.Label(frame, text=label).pack(anchor="w")
        row = ttk.Frame(frame)
        row.pack(fill="x", pady=(2, 8))
        ttk.Entry(row, textvariable=variables[index]).pack(side="left", fill="x", expand=True)
        def browse(i=index):
            selected = (filedialog.askdirectory() if i == 0 else filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
                        if i == 1 else filedialog.asksaveasfilename(defaultextension=".json"))
            if selected:
                variables[i].set(selected)
        ttk.Button(row, text="Browse", command=browse).pack(side="left", padx=(8, 0))
    acknowledged = tk.BooleanVar()
    ttk.Checkbutton(frame, text="سند آزمایشی خالی است و ردیف Item باز است؛ هنگام ثبت با QBM کار نمی‌کنم.",
                    variable=acknowledged).pack(anchor="e", pady=6)
    status = tk.StringVar(value="Ready. Capture starts only when you press Play.")
    ttk.Label(frame, textvariable=status, wraplength=700).pack(fill="x", pady=12)
    actions = ttk.Frame(frame)
    actions.pack(fill="x")

    def start():
        nonlocal running
        if running or not acknowledged.get():
            if not running:
                messagebox.showinfo("QBM", "ابتدا سند آزمایشی خالی را آماده و گزینهٔ بالا را فعال کنید.")
            return
        paths = [Path(value.get()) for value in variables]
        try:
            digest, _ = load_source(paths[1])
            load_checkpoint(paths[2], digest)
            if paths[2].resolve() == paths[1].resolve() or (paths[2].exists() and paths[2].samefile(paths[1])):
                raise ValueError("Output must differ from original source")
        except Exception as exc:
            messagebox.showerror("Source validation", str(exc))
            return
        stop.clear()
        running = True
        def worker():
            try:
                collect(*paths, stop, lambda text: events.put(("status", text)))
            except Exception as exc:
                events.put(("status", f"Stopped: {exc}"))
            finally:
                events.put(("done", ""))
        threading.Thread(target=worker, daemon=True).start()

    ttk.Button(actions, text="▶ Play / Resume", command=start).pack(side="left", padx=4)
    ttk.Button(actions, text="■ Stop", command=stop.set).pack(side="left", padx=4)
    ttk.Label(frame, text="اگر پنجره یا پیام جدیدی باز شود، ثبت متوقف می‌شود. ردیف نیمه‌کاره را در QBM با Cancel ببندید،\n"
              "ردیف خالی باز کنید و دوباره Play بزنید. موارد ثبت‌شده تکرار نمی‌شوند.", justify="right").pack(fill="x", pady=16)

    def poll():
        nonlocal running
        while not events.empty():
            kind, value = events.get_nowait()
            if kind == "done":
                running = False
            else:
                status.set(value)
        app.after(150, poll)
    def close():
        stop.set()
        if running:
            status.set("Stopping. Please wait for the current UI read to finish, then close again.")
        else:
            app.destroy()
    app.protocol("WM_DELETE_WINDOW", close)
    poll()
    app.mainloop()


if __name__ == "__main__":
    main()
