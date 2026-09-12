# SkyPlanner public catalog snapshots and population model

Prepared 2026-09-12. No private light curves are included.

- `rosette-deep.json`: 793 Flamingos-2 sources from Mužić et al. 2019, VizieR J/ApJ/881/79/table2; matched by published source ID to Almendros-Abad et al. 2023, J/A+A/677/A26 membership and characterized masses. Masses retain their original study ages.
- `rosette-wide.json`: 28,979 rows from Mužić et al. 2022, J/A+A/668/A19/catalog, queried within 35 arcmin of ICRS 97.940875, 4.866111. Fields GaiaEDR3, RA_ICRS, DE_ICRS, Ksmag, Jmag, Hmag, Pmemb. Gaia IDs retained as strings. Nearest deep-source matches within 1 arcsec are collapsed when both layers are active. Matching is positional, not proof of physical identity.
- `nircam-siaf.json`: NRCALL_FULL reference plus all ten full-frame SW/LW detector corners, pysiaf PRDOPSSOC-065. Exact attitude transformation checked against independent pysiaf sky vertices. Both modules; SW/LW intersection counted once. This is planning geometry, not an APT visibility/readout check.
- `bhac15-f250m.json`: mass and absolute Vega F250Mab magnitudes at 0.5, 1, 2, 3, 4, 5, 8 and 10 Myr from https://perso.ens-lyon.fr/isabelle.baraffe/BHAC15dir/BHAC15_iso.JWST . File header identifies November 2016 JWST passbands. Grid spans 0.01–1.4 solar masses. Interpolation in log mass; no extrapolation outside model masses.

## Counts

The K bright boundary is an editable proxy, not an F250M ETC limit. Unknown K is excluded only when this filter is enabled. Deep catalog extent warnings use a bounding rectangle, not a measured completeness mask. Wide-catalog counts are probabilistic. These catalogs are not a complete census of the NIRCam footprint.

## Optional IMF scenario

Continuous dN/dM, slopes alphaBD (default 0.3), 1.3, 2.3, with breaks at 0.08 and 0.5 solar masses (Kroupa 2001, https://doi.org/10.1046/j.1365-8711.2001.04022.x). Normalize each bin by Nanchor/completeness times its IMF integral divided by the anchor interval integral. All parameters are user scenarios, not fitted values. Model bright/faint window defaults (16–24 Vega) are illustrative, not ETC results. Extinction coefficient 0.09 is an adjustable approximation. Age 10 Myr is the initial scenario, with other Rosette ages selectable.

The catalog anchor button uses published members with masses inside the active detector footprint, before brightness filtering. Membership/mass completeness is unknown. Manually entered anchors must refer to the same sky area. Moving the footprint updates known counts but does not silently change the normalization. Click the anchor button again to renormalize. The estimated excess over known mass-characterized members can include objects already cataloged without masses; it is not a measured unseen population. Population models never increase the displayed catalog count. No satellite occurrence or transit yields are inferred.

## Verification

Geometry: independent pysiaf corners agree to 1e-8 degree; historical 9 versus optimized 17 published members with the same K filter; 461 geometric and 347 brightness-filtered deep sources at the saved optimized center. IMF integrals agree with independent analytic integrals to relative 1e-5 over all slope boundaries; interpolation reproduces model nodes and rejects out-of-grid masses. Browser checks covered Rosette presets, wide catalog loading, 17-member filtering, arbitrary coordinates, and inverse completeness scaling.
