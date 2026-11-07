import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { openConsentSettings } from "@/lib/consent";
import { AD_FREE_DAYS_AFTER_PAYMENT } from "@/lib/ads";

/**
 * "Advertising" section of the Privacy Policy and the Cookie Policy, in
 * English and Canadian French (the rest of those pages has no French layer
 * yet: HANDOFF Left #26). Shown in the member's language, with a link to the
 * other one. What it says must match the code: src/lib/ads.ts (sources,
 * placements, pages without ads), src/components/AdSlot.tsx (consent),
 * 0016_ads.sql (who is ad-free) and docs/ADS.md.
 */

const GOOGLE_PARTNER_SITES = "https://policies.google.com/technologies/partner-sites";
const GOOGLE_ADS_SETTINGS = "https://adssettings.google.com";

type Lang = "en" | "fr";
type Variant = "privacy" | "cookies";

const ExtLink = ({ href }: { href: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
    {href.replace(/^https:\/\//, "")}
  </a>
);

function English({ variant, days }: { variant: Variant; days: number }) {
  return (
    <>
      <p className="text-muted-foreground mb-4">
        ISEXY is free to use. Free members, and visitors on a few public pages (FAQ, Safety Tips, Help, About, News,
        Community Stories), see small labelled ads. <strong>Members who pay for anything see no ads</strong>: an
        active Plus, Gold or Platinum plan, an active chat subscription, or any purchase in the last {days} days
        (one pack of Super Likes is enough). There are never ads in chats, calls, checkout and purchase pages,
        sign-in, onboarding and profile setup, staff pages or legal pages.
      </p>

      <h3 className="text-lg font-semibold mb-3 mt-6">Where ads come from</h3>
      <ol className="list-decimal pl-5 text-muted-foreground space-y-2 mb-4">
        <li>
          <strong>TAKATAK ads</strong>, the local ad network of TAKATAK, our operator (takatak.ca). Your browser asks
          takatak.ca for an ad and sends only the ad space, your language, your device type (phone, tablet or
          computer) and, only if you allow personalized ads, the city and country on your profile. Never your name,
          email, phone number, profile id, photos or messages. When an ad is shown or tapped, takatak.ca records the
          event with a one-time code; a tap goes through takatak.ca, which adds an attribution code to the
          advertiser's link. Ads are text and images from approved local advertisers.
        </li>
        <li>
          <strong>Google AdSense</strong>, when TAKATAK has no ad for that space. Google and its partners may use
          cookies and similar technologies to serve and measure ads, limit how often you see an ad, and prevent
          fraud. How Google uses information from sites that use its services: <ExtLink href={GOOGLE_PARTNER_SITES} />.
        </li>
        <li>Otherwise, our own "Go ad-free with ISEXY Plus" banner (no third party involved).</li>
      </ol>

      <h3 className="text-lg font-semibold mb-3 mt-6">Your choice: personalized or not</h3>
      <p className="text-muted-foreground mb-4">
        Ads are personalized <strong>only if you turn on the "Advertising" choice</strong> in our cookie settings
        (off by default). Without it, Google is asked for non-personalized ads only (Google may still use cookies for
        frequency capping, aggregated reporting and fraud prevention) and TAKATAK receives no city or country. You can
        change your choice at any time; it applies to the next ads. You can also manage how Google personalizes ads
        for you at <ExtLink href={GOOGLE_ADS_SETTINGS} />.
      </p>
      {variant === "cookies" && (
        <p className="text-muted-foreground mb-4">
          Advertising cookies are set by Google's domains (for example doubleclick.net and googlesyndication.com) only
          on pages that show a Google ad. Requests to TAKATAK ads are sent without cookies and TAKATAK ads set no advertising cookie. Blocking third-party cookies in your browser also
          blocks Google's advertising cookies; ads are then non-personalized.
        </p>
      )}
      {variant === "privacy" && (
        <p className="text-muted-foreground mb-4">
          Whether you see ads is decided by our server from your plan and purchase records; this information is never
          shared with advertisers, TAKATAK ads or Google.
        </p>
      )}
      <button
        type="button"
        onClick={openConsentSettings}
        className="mb-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
      >
        Manage my cookie choices
      </button>
    </>
  );
}

function French({ variant, days }: { variant: Variant; days: number }) {
  return (
    <>
      <p className="text-muted-foreground mb-4">
        ISEXY est gratuit. Les membres gratuits, et les visiteurs de quelques pages publiques (FAQ, Conseils de
        sécurité, Aide, À propos, Nouvelles, Histoires de la communauté), voient de petites publicités identifiées
        comme telles. <strong>Les membres qui paient quoi que ce soit ne voient aucune publicité</strong> : un forfait
        Plus, Gold ou Platinum actif, un abonnement au clavardage actif, ou tout achat au cours des {days} derniers
        jours (un seul paquet de Super J'aime suffit). Il n'y a jamais de publicité dans les conversations, les appels,
        les pages de paiement et d'achat, la connexion, l'inscription et la création du profil, les pages du personnel
        ni les pages juridiques.
      </p>

      <h3 className="text-lg font-semibold mb-3 mt-6">D'où viennent les publicités</h3>
      <ol className="list-decimal pl-5 text-muted-foreground space-y-2 mb-4">
        <li>
          <strong>Les publicités TAKATAK</strong>, le réseau publicitaire local de TAKATAK, notre exploitant
          (takatak.ca). Votre navigateur demande une publicité à takatak.ca en envoyant seulement l'espace
          publicitaire, votre langue, votre type d'appareil (téléphone, tablette ou ordinateur) et, seulement si vous
          acceptez les publicités personnalisées, la ville et le pays de votre profil. Jamais votre nom, votre courriel,
          votre numéro de téléphone, votre identifiant, vos photos ni vos messages. Quand une publicité est affichée ou
          touchée, takatak.ca enregistre l'événement avec un code à usage unique; un clic passe par takatak.ca, qui
          ajoute un code d'attribution au lien de l'annonceur. Les publicités sont des textes et des images
          d'annonceurs locaux approuvés.
        </li>
        <li>
          <strong>Google AdSense</strong>, quand TAKATAK n'a pas de publicité pour cet espace. Google et ses
          partenaires peuvent utiliser des témoins (cookies) et des technologies semblables pour diffuser et mesurer
          les publicités, limiter le nombre d'affichages d'une même publicité et prévenir la fraude. Comment Google
          utilise les données des sites qui utilisent ses services : <ExtLink href={GOOGLE_PARTNER_SITES} />.
        </li>
        <li>Sinon, notre propre bannière « Sans publicité avec ISEXY Plus » (aucun tiers).</li>
      </ol>

      <h3 className="text-lg font-semibold mb-3 mt-6">Votre choix : personnalisées ou non</h3>
      <p className="text-muted-foreground mb-4">
        Les publicités sont personnalisées <strong>seulement si vous activez le choix « Publicité »</strong> dans nos
        paramètres de témoins (désactivé par défaut). Sans ce choix, seules des publicités non personnalisées sont
        demandées à Google (Google peut quand même utiliser des témoins pour limiter la répétition, produire des
        statistiques globales et prévenir la fraude) et TAKATAK ne reçoit ni ville ni pays. Vous pouvez changer
        d'avis en tout temps; le changement s'applique aux publicités suivantes. Vous pouvez aussi gérer la
        personnalisation des publicités Google à <ExtLink href={GOOGLE_ADS_SETTINGS} />.
      </p>
      {variant === "cookies" && (
        <p className="text-muted-foreground mb-4">
          Les témoins publicitaires sont déposés par les domaines de Google (par exemple doubleclick.net et
          googlesyndication.com) seulement sur les pages qui affichent une publicité Google. Les demandes à TAKATAK ads
          sont envoyées sans témoins et les publicités TAKATAK ne déposent aucun témoin publicitaire. Bloquer les témoins tiers dans votre navigateur bloque aussi les témoins publicitaires
          de Google; les publicités sont alors non personnalisées.
        </p>
      )}
      {variant === "privacy" && (
        <p className="text-muted-foreground mb-4">
          Notre serveur décide si vous voyez des publicités à partir de votre forfait et de vos achats; ces
          renseignements ne sont jamais communiqués aux annonceurs, à TAKATAK ads ni à Google.
        </p>
      )}
      <button
        type="button"
        onClick={openConsentSettings}
        className="mb-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
      >
        Gérer mes choix de témoins
      </button>
    </>
  );
}

/** The section body (the page supplies the heading number). */
export function AdvertisingPolicy({ variant, heading }: { variant: Variant; heading: { en: string; fr: string } }) {
  const { language } = useLanguage();
  const [override, setOverride] = useState<Lang | null>(null);
  const lang: Lang = override ?? (language.code === "fr" ? "fr" : "en");
  const other: Lang = lang === "fr" ? "en" : "fr";
  const days = AD_FREE_DAYS_AFTER_PAYMENT;
  return (
    <section className="mb-8" id="advertising" lang={lang === "fr" ? "fr-CA" : "en-CA"} data-advertising-policy={lang}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold m-0">{heading[lang]}</h2>
        <button
          type="button"
          onClick={() => setOverride(other)}
          className="shrink-0 text-sm text-primary underline"
          lang={other === "fr" ? "fr-CA" : "en-CA"}
        >
          {other === "fr" ? "Français" : "English"}
        </button>
      </div>
      {lang === "fr" ? <French variant={variant} days={days} /> : <English variant={variant} days={days} />}
    </section>
  );
}
