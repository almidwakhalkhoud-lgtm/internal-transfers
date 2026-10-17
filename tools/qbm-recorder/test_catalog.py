import json
import tempfile
import unittest
from pathlib import Path

from catalog import capture, load_checkpoint, load_source, save_checkpoint


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.item = {"itemName": "001597", "description": "Camping stove (1x12)", "unitName": "ctn"}

    def test_preserves_exact_choices_and_does_not_infer_factor(self):
        result = capture(self.item, self.item["description"], ["", "ctn", "pcs", "pcs"])
        self.assertEqual(result["units"], ["ctn", "pcs"])
        self.assertEqual(result["code"], "001597")
        self.assertIsNone(result["conversionFactors"])

    def test_empty_read_is_not_no_units(self):
        with self.assertRaises(ValueError):
            capture(self.item, self.item["description"], [])

    def test_observed_blank_option_can_prove_no_units(self):
        item = {**self.item, "unitName": None}
        result = capture(item, item["description"], [""])
        self.assertEqual(result["units"], [])
        self.assertTrue(result["blankOptionObserved"])

    def test_wrong_description_or_missing_default_refused(self):
        with self.assertRaises(ValueError):
            capture(self.item, "Another product", ["ctn"])
        with self.assertRaises(ValueError):
            capture(self.item, self.item["description"], ["pcs"])

    def test_resume_and_source_binding(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "capture.json"
            data = load_checkpoint(path, "source-one")
            data["items"]["001597"] = capture(self.item, self.item["description"], ["ctn", "pcs"])
            save_checkpoint(path, data)
            self.assertEqual(load_checkpoint(path, "source-one"), data)
            with self.assertRaises(ValueError):
                load_checkpoint(path, "source-two")
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_numeric_and_duplicate_codes_refused_original_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "Items.json"
            for items in [[self.item], [{**self.item, "itemName": 1597}], [self.item, self.item]]:
                raw = json.dumps({"schemaVersion": 1, "documentType": "itemList", "items": items}).encode()
                path.write_bytes(raw)
                if len(items) == 1 and isinstance(items[0]["itemName"], str):
                    _, rows = load_source(path)
                    self.assertEqual(rows[0]["itemName"], "001597")
                else:
                    with self.assertRaises(ValueError):
                        load_source(path)
                self.assertEqual(path.read_bytes(), raw)


if __name__ == "__main__":
    unittest.main()
