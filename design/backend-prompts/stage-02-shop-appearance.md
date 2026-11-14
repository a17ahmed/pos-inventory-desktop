# Backend prompt — Stage 2: shop appearance (accent colour + sidebar style)

Send everything inside the box to the backend session.

```
Feature: let each shop choose its app appearance (accent colour and sidebar style).
The desktop app has a new design; the shop admin picks these in Settings → Appearance.
Light/dark mode and table density stay on each device, so they are NOT part of this.

1. Model (models/business.mjs), inside the existing `settings` sub-document:
     appearance: {
       accent:  { type: String, enum: ["steel", "teal", "green", "violet", "gold", "rose"], default: "steel" },
       sidebar: { type: String, enum: ["navy", "light"], default: "navy" }
     }
   No migration: shops without the field get the defaults.

2. Saving goes through the route the desktop already uses for shop settings:
   PUT /admin/business/settings  with  { settings: { appearance: { accent: "teal", sidebar: "navy" } } }
   - updateBusinessSettingsSchema (middleware/validationSchemas.mjs): add
       appearance: Joi.object({ accent: Joi.string().valid(...6 values), sidebar: Joi.string().valid("navy","light") })
     inside `settings`. Anything else stays rejected (allowUnknown stays off).
   - controllers/admin.mjs updateBusinessSettings merges each settings key with dot notation. For
     `appearance`, merge one level deeper (settings.appearance.accent / settings.appearance.sidebar)
     so sending only { appearance: { accent } } keeps the saved sidebar. All other settings keys
     (autoPrint, allowBillAmend, …) must be untouched by an appearance save.
   - Same permission as the other shop settings (admin). Employees → 403.

3. Reading: no new route needed. `settings.appearance` must come back in
   - the admin login response and the employee login response (they return `business`), and
   - GET /business/:id and GET /admin/business/settings.
   Check SHOP_HIDDEN_BUSINESS_FIELDS doesn't hide it.

4. Tests: old shop → defaults in the login payload; admin saves accent → 200, persists, response
   contains settings.appearance; invalid accent → 400; saving only accent keeps sidebar and
   keeps autoPrint/allowBillAmend; employee PUT → 403; employee login payload includes appearance.

Rules: don't commit, tag or push without my permission. Tell me the changed files, paste the
exact `settings.appearance` JSON from a login response, and show the test output.
```

## What the desktop does with it (already built in Stage 2)

- Reads `business.settings.appearance` from the stored business (login payload); missing → steel / navy.
- Admin saves with `updateBusinessSettings({ appearance: { accent, sidebar } })`.
- Until the backend has the field, that save returns **400 "Validation failed"**; the app then keeps
  the choice on this computer only and says so ("Saved on this computer only — the server doesn't
  support shop colours yet").
