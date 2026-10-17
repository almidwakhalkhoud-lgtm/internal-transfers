"""Offline, lossless QBM source and resumable capture files. No UI or DB access."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def load_source(path: Path):
    raw = path.read_bytes()
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError("QBM source exceeds 25 MB")
    data = json.loads(raw.decode("utf-8-sig"))
    if data.get("schemaVersion") != 1 or data.get("documentType") != "itemList":
        raise ValueError("Expected QBM itemList JSON")
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("Source contains no items")
    codes = set()
    for item in items:
        code = item.get("itemName")
        if not isinstance(code, str) or not code or code != code.strip():
            raise ValueError("Item codes must be nonempty strings without surrounding spaces")
        if code in codes or any(ord(char) < 32 for char in code):
            raise ValueError("Duplicate or unsafe item code")
        codes.add(code)
        if not isinstance(item.get("description"), str) or not item["description"].strip():
            raise ValueError(f"Missing description: {code}")
        if item.get("unitName") is not None and not isinstance(item["unitName"], str):
            raise ValueError(f"Invalid default unit: {code}")
    return hashlib.sha256(raw).hexdigest(), items


def load_checkpoint(path: Path, source_hash: str):
    if not path.exists():
        return {"schemaVersion": 1, "sourceSha256": source_hash,
                "coverage": "unit-names-only", "conversionFactors": None,
                "databaseChanges": 0, "items": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if (data.get("schemaVersion") != 1 or data.get("sourceSha256") != source_hash
            or data.get("coverage") != "unit-names-only" or not isinstance(data.get("items"), dict)):
        raise ValueError("Checkpoint belongs to a different source or format; choose a new output file")
    for code, record in data["items"].items():
        if (record.get("code") != code or not isinstance(record.get("units"), list)
                or any(not isinstance(unit, str) or not unit for unit in record["units"])):
            raise ValueError("Invalid checkpoint record")
    return data


def capture(item: dict, description: str, labels: list[str]):
    # A mismatching lookup is never evidence for the requested product.
    if description.strip() != item["description"].strip():
        raise ValueError(f"QBM description does not match source: {item['itemName']}")
    if not isinstance(labels, list) or not labels or any(not isinstance(s, str) for s in labels):
        raise ValueError("Unit list could not be proved readable; empty data is not 'no units'")
    units = list(dict.fromkeys(s.strip() for s in labels if s.strip()))
    default = item.get("unitName")
    if default and default not in units:
        raise ValueError(f"Default unit {default!r} missing from QBM menu; review required")
    return {"code": item["itemName"], "productGuid": item.get("productGuid"),
            "description": description.strip(), "defaultUnit": default,
            "units": units, "blankOptionObserved": any(not s.strip() for s in labels),
            "conversionFactors": None, "source": "QBM unit combo / Windows UI Automation",
            "capturedAt": datetime.now(timezone.utc).isoformat()}


def save_checkpoint(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)
