import { Helmet } from "react-helmet-async";
import { OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/site";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  noindex?: boolean;
  jsonLd?: object | object[];
}

/** Page-level head tags; rendered after RouteSeo, so these win. */
export function Seo({ title, description, path, type = "website", image = OG_IMAGE, noindex = false, jsonLd }: SeoProps) {
  const url = absoluteUrl(path);
  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const desc = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large"} />
      {!noindex && <link rel="canonical" href={url} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={image} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
