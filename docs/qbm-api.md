# Transfers API for the QBM entry app

Create a key in **Settings → API keys** (it is shown once) and send it on
every request:

```
Authorization: Bearer buzz_…
```

A key can only read confirmed transfers and mark them as entered in QBM.
Revoking it in Settings stops it at once.

| Call | Does |
|---|---|
| `GET /api/v1/transfers?entered=no` | Transfers not yet entered in QBM, oldest first, 50 a page (`&page=1`…). `entered=yes` or `all` for the others; `approval=APPROVED` and `since=2026-10-01` filter further. |
| `GET /api/v1/transfers/MA-0012` | One transfer, by number or id. |
| `POST /api/v1/transfers/MA-0012/qbm` `{"reference":"…"}` | Records the QBM document number. Repeating it is harmless; a different number answers 409. |
| `DELETE /api/v1/transfers/MA-0012/qbm` | Removes that record, e.g. after a mistaken entry. |

Each transfer:

```json
{
  "id": "…", "number": "MA-0012", "date": "2026-10-18",
  "confirmedAt": "2026-10-18T09:12:00.000Z",
  "from": "Main", "to": "Al Azaiba", "createdBy": "AmirAli Jafari",
  "approval": "PENDING", "totalQuantity": "7",
  "qbm": null,
  "items": [
    { "code": "1066", "description": "STICK LIGHTER", "quantity": "5", "unit": "PCS" },
    { "code": "SS", "description": "midwakh service", "quantity": "2", "unit": "" }
  ]
}
```

`items` is the confirmed snapshot — the same lines as the PDF. An empty
`unit` means none was chosen. Item notes are not sent.
