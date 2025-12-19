// ============================================================
// Maldonado et al. 2010 EW Li Lookup Integration
// Add this code to your ChronoStar index.html
// ============================================================

// 1. Add this URL constant near the top of your script section
// (Replace with your actual GitHub raw URL after uploading)
const MALDONADO2010_URL = 'https://raw.githubusercontent.com/msoaresfurtado/chronostar/main/data/maldonado2010_ewli.json';

// 2. Add this function to search the Maldonado 2010 catalog by HIP number
async function searchMaldonado2010(hipNumber) {
    try {
        const response = await fetch(MALDONADO2010_URL);
        if (!response.ok) {
            console.log('Could not fetch Maldonado 2010 catalog');
            return null;
        }
        
        const catalog = await response.json();
        
        // Search for matching HIP number
        const match = catalog.data.find(entry => entry.hip === hipNumber);
        
        if (match && match.ewli !== null) {
            return {
                value: match.ewli,
                error: match.e_ewli,
                source: 'Maldonado+2010',
                group: match.group,
                membership: match.membership,
                bibcode: catalog.bibcode
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error searching Maldonado 2010:', error);
        return null;
    }
}

// 3. Modify your queryVizierYouthIndicators function to also check Maldonado 2010
// Add this near the beginning of the function, after you have the target's HIP number:

/*
    // Check Maldonado 2010 local catalog (if HIP number available)
    if (hipNumber) {
        const maldonadoResult = await searchMaldonado2010(parseInt(hipNumber));
        if (maldonadoResult) {
            results.ewli.push(maldonadoResult);
            console.log(`✓ EW Li from Maldonado+2010: ${maldonadoResult.value} ± ${maldonadoResult.error} mÅ (${maldonadoResult.group})`);
        }
    }
*/

// 4. Alternative: If you want to resolve HIP number from SIMBAD first,
//    add this helper function:

async function getHIPfromSimbad(identifier) {
    // Query SIMBAD to get HIP number for any identifier
    const url = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
    
    const query = `
        SELECT id 
        FROM ident 
        WHERE oidref = (SELECT oidref FROM ident WHERE id = '${identifier.replace(/'/g, "''")}')
        AND id LIKE 'HIP %'
    `;
    
    const params = new URLSearchParams({
        REQUEST: 'doQuery',
        LANG: 'ADQL',
        FORMAT: 'json',
        QUERY: query
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Extract HIP number from "HIP 12345" format
            const hipMatch = data.data[0][0].match(/HIP\s*(\d+)/);
            if (hipMatch) {
                return parseInt(hipMatch[1]);
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting HIP from SIMBAD:', error);
        return null;
    }
}

// ============================================================
// FULL INTEGRATION EXAMPLE
// ============================================================
// Here's how to integrate into your existing youth indicator search:

async function queryYouthIndicatorsWithMaldonado(ra, dec, identifier) {
    const results = {
        ewli: [],
        prot: [],
        rhk: [],
        lx: []
    };
    
    // First, try to get HIP number for Maldonado 2010 lookup
    let hipNumber = null;
    
    // Check if identifier is already a HIP number
    if (identifier) {
        const hipMatch = identifier.match(/HIP\s*(\d+)/i);
        if (hipMatch) {
            hipNumber = parseInt(hipMatch[1]);
        } else {
            // Try to resolve via SIMBAD
            hipNumber = await getHIPfromSimbad(identifier);
        }
    }
    
    // Search Maldonado 2010 catalog
    if (hipNumber) {
        console.log(`Checking Maldonado+2010 for HIP ${hipNumber}...`);
        const maldonadoResult = await searchMaldonado2010(hipNumber);
        if (maldonadoResult) {
            results.ewli.push(maldonadoResult);
            console.log(`✓ Found EW Li: ${maldonadoResult.value} ± ${maldonadoResult.error} mÅ`);
        }
    }
    
    // Continue with VizieR queries...
    // (your existing VizieR query code here)
    
    return results;
}
