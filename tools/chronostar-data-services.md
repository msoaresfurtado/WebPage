# Chronostar Gaia service availability

Chronostar runs as a static web page. `chronostar-gaia.js` first queries the CDS VizieR Gaia DR3 tables and falls back to the GAVO Gaia DR3 lite table when a request fails, times out, or returns malformed data. Both requests go directly to the astronomical archive using browser CORS; no proxy or credentials are involved.

The primary request times out after 8 seconds, the fallback after 25 seconds. A failed service is skipped for 90 seconds in that browser session; both are retried when every service is marked unavailable. No previous target results are substituted for a failed lookup. Empty valid responses remain empty.

GAVO provides DR3 positions, proper motions, parallaxes, radial velocities, and magnitudes. BP−RP is calculated from its BP and RP magnitudes. Its reduced table does not contain GSP-Phot temperature or surface gravity, which are returned as null rather than estimated. GAVO RUWE was independently calculated and can differ slightly from the official values. The displayed provenance note identifies target and neighbor providers; neighbor CSV files include a `gaia_provider` column.

This fallback covers Gaia identifier lookup, Gaia coordinate cone lookup, and comoving searches. SIMBAD name resolution and optional VizieR youth-indicator catalogs are separate services, and may remain unavailable during a wider CDS outage. Users can bypass SIMBAD by entering an exact Gaia DR3 source ID. A backup archive does not guarantee that every external service remains available.

Both providers are limited to 50,000 rows per query; reaching that ceiling raises an error rather than silently using a truncated candidate sample. Source IDs remain strings before JSON conversion to avoid rounding 64-bit identifiers. Existing physical selection cuts and velocity calculations are unchanged.

Reference: https://dc.zah.uni-heidelberg.de/tableinfo/gaia.dr3lite

Validation: `node --test tools/tests/chronostar-gaia.test.cjs`. Browser checks on 2026-10-16 used the live VizieR outage and real GAVO results, including Gaia DR3 4833654227548585856.
