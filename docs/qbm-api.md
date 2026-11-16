# Transfers API for the QBM entry app

Create a key in **Settings → API keys** (it is shown once) and send it on
every request:

```
Authorization: Bearer buzz_…
```

A key can only read confirmed transfers and mark them as entered in QBM.
A key that an administrator marked **Can approve** (when creating it, or
with **Allow approving** in the list) may also approve a transfer after it
has been entered. Revoking a key in Settings stops it at once.

| Call                                                     | Does                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/transfers?entered=no`                       | Transfers not yet entered in QBM, oldest first, 50 a page (`&page=1`…). `entered=yes` or `all` for the others, `entered=outdated` for those an administrator edited after they were entered; `approval=APPROVED`, `since=2026-10-01` and `editedSince=2026-11-10T00:00:00Z` filter further. |
| `GET /api/v1/transfers/MA-0012`                          | One transfer, by number or id.                                                                                                                                                                                                                                                              |
| `POST /api/v1/transfers/MA-0012/qbm` `{"reference":"…"}` | Records the QBM document number. Repeating it is harmless; a different number answers 409. For an edited transfer (`qbm.outdated`), it records that the edited version is entered, under the same or a new QBM number.                                                                      |
| `DELETE /api/v1/transfers/MA-0012/qbm`                   | Removes that record, e.g. after a mistaken entry.                                                                                                                                                                                                                                           |
| `POST /api/v1/transfers/MA-0012/approve`                 | Approves a `PENDING` transfer that has been recorded as entered in QBM. Repeating it is harmless. 403 if the key may not approve; 409 if the QBM entry is not recorded yet (or not for the edited version), or the transfer is rejected or received.                                        |

The usual order for the entry app: list `entered=no`, type each transfer
into QBM, `POST …/qbm` with the QBM number, then `POST …/approve`.

## Edited transfers

An administrator may edit a confirmed transfer — quantities, units, items,
the date and the remarks; never its number or locations. Each edit raises
`revision` by one and sets `editedAt`, `editedBy` and `editReason`. The
signatures of the replaced version are removed, so `signatures` lists only
those made after the edit.

An administrator may also remove a single signature so that side is signed
again. That changes only `signatures` (and the signed PDF), not `items` or
`revision`, so it does not make a QBM entry outdated.

To keep QBM in step, the entry app also polls `entered=outdated`. Each
transfer there has `qbm.outdated: true` and `qbm.revision` lower than
`revision`: correct the QBM document from `items` (or make a new one), then
`POST …/qbm` with its number. That records the current revision, and the
transfer leaves the `outdated` list.

Each transfer:

```json
{
  "id": "…",
  "number": "MA-0012",
  "date": "2026-10-18",
  "confirmedAt": "2026-10-18T09:12:00.000Z",
  "from": "Main",
  "to": "Al Azaiba",
  "createdBy": "AmirAli Jafari",
  "approval": "PENDING",
  "totalQuantity": "7",
  "revision": 1,
  "editedAt": null,
  "editedBy": null,
  "editReason": null,
  "qbm": null,
  "items": [
    {
      "code": "1066",
      "description": "STICK LIGHTER",
      "quantity": "5",
      "unit": "PCS"
    },
    {
      "code": "SS",
      "description": "midwakh service",
      "quantity": "2",
      "unit": ""
    }
  ]
}
```

`items` is the confirmed snapshot — the same lines as the PDF. An empty
`unit` means none was chosen. `note` is the line's note ("" when none).
