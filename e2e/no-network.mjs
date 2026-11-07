// Local verification only: the SEO step must not reach production Supabase.
globalThis.fetch = async (url) => { throw new Error(`network disabled for local build (${String(url).slice(0, 40)}...)`); };
