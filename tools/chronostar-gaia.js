/* Gaia DR3 service failover for Chronostar. No third-party proxy is used. */
(function (root) {
  'use strict';
  const providers = [
    { id: 'vizier', label: 'VizieR Gaia DR3', url: 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', timeout: 8000 },
    { id: 'gavo', label: 'GAVO Gaia DR3 lite', url: 'https://dc.zah.uni-heidelberg.de/tap/sync', timeout: 25000 }
  ];
  const mapping = {
    source_id: 'Source', ra: 'RA_ICRS', dec: 'DE_ICRS', parallax: 'Plx', parallax_error: 'e_Plx',
    pmra: 'pmRA', pmdec: 'pmDE', radial_velocity: 'RV', radial_velocity_error: 'e_RV',
    phot_g_mean_mag: 'Gmag', phot_bp_mean_mag: 'BPmag', phot_rp_mean_mag: 'RPmag',
    bp_rp: '"BP-RP"', ruwe: 'RUWE', teff_gspphot: 'Teff', logg_gspphot: 'logg'
  };
  const unavailableUntil = new Map();
  function translate(query, provider) {
    if (provider === 'gavo') {
      return query
        .replace(/LEFT\s+JOIN\s+gaiadr3\.astrophysical_parameters\s+AS\s+p\s+ON\s+g\.source_id\s*=\s*p\.source_id/gi, '')
        .replace(/,\s*(?:p\.)?(?:teff_gspphot|logg_gspphot)\b/gi, '')
        .replace(/\b(g\.)?bp_rp\b/gi, (_, prefix = '') => `(${prefix}phot_bp_mean_mag - ${prefix}phot_rp_mean_mag) AS bp_rp`)
        .replace(/gaiadr3\.gaia_source/gi, 'gaia.dr3lite');
    }
    let translated = query.replace(/gaiadr3\.gaia_source/gi, '"I/355/gaiadr3"')
      .replace(/gaiadr3\.astrophysical_parameters/gi, '"I/355/paramp"');
    for (const [esa, viz] of Object.entries(mapping)) {
      translated = translated.replace(new RegExp(`\\b${esa}\\b`, 'gi'), viz);
    }
    return translated.replace(/Source\s*=\s*(\d+)/gi, "Source = '$1'");
  }
  function parse(text, provider) {
    // Gaia identifiers exceed Number.MAX_SAFE_INTEGER; quote before JSON.parse.
    const value = JSON.parse(text.replace(/([:\[,]\s*)(\d{16,})(\s*[,\}\]])/g, '$1"$2"$3'));
    const columns = value.metadata || value.columns;
    if (!Array.isArray(columns) || !Array.isArray(value.data)) throw new Error('Invalid Gaia table response');
    const reverse = Object.fromEntries(Object.entries(mapping).map(([k, v]) => [v.replace(/"/g, '').toLowerCase(), k]));
    const metadata = columns.map(c => ({ ...c, name: provider === 'vizier' ? (reverse[c.name.toLowerCase()] || c.name.toLowerCase()) : c.name.toLowerCase() }));
    const data = value.data.map(row => {
      const result = Array.isArray(row) ? row.slice() : columns.map(c => row[c.name]);
      if (result.length !== metadata.length) throw new Error('Invalid Gaia row length');
      return result;
    });
    if (provider === 'gavo') {
      for (const name of ['teff_gspphot', 'logg_gspphot']) {
        if (!metadata.some(c => c.name === name)) {
          metadata.push({ name });
          data.forEach(row => row.push(null));
        }
      }
    }
    return { metadata, data, provider };
  }
  async function query(queryText) {
    const failures = [];
    // During an outage, avoid making every follow-up query wait for VizieR again.
    const available = providers.filter(p => (unavailableUntil.get(p.id) || 0) <= Date.now());
    const order = available.length ? available : providers;
    for (const provider of order) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeout);
      try {
        const response = await fetch(provider.url, {
          method: 'POST', credentials: 'omit',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', MAXREC: '50000', QUERY: translate(queryText, provider.id) }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = parse(await response.text(), provider.id);
        if (result.data.length >= 50000) throw new Error('Result limit reached; reduce the search radius');
        unavailableUntil.delete(provider.id);
        return result;
      } catch (error) {
        failures.push(`${provider.label}: ${error.message}`);
        unavailableUntil.set(provider.id, Date.now() + 90000);
      } finally {
        clearTimeout(timeout);
      }
    }
    console.warn('Chronostar Gaia services:', failures.join('; '));
    throw new Error('Gaia searches are temporarily unavailable from both VizieR and GAVO. Please try again shortly or reduce the search radius.');
  }
  const api = { query, translate, parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChronostarGaia = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
