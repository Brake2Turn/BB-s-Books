# ShelfRow

A row of three covers standing on a ledge. The library is built from these, stacked 14px apart.

**Specs.** 3-column grid, 12px gap, covers 2:3. Ledge 6px below the covers (`ledge-gap`), 12px tall, radius 6.
- **Glass ledge (on the washes):** `glass-ledge` (white 0.45), 1px `glass-ledge-border`, backdrop blur 20px, `shadow-ledge`.
- **Solid ledge (on pure white):** `ledge-solid` fill with a 1px `ledge-solid-border` top edge, no shadow.

**States.** Full row, partial row (one or two covers, left-aligned, ledge stays full width), and empty shelf (ledge alone with a caption like "Scan a book to start this shelf").

**Do:** keep the ledge full width even when the row isn't.
**Don't:** change the column count, or drop the ledge.
