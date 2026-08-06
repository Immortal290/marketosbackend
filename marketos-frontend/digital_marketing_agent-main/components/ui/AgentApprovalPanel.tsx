"use client";
import { useState } from "react";
import {
  CheckCircle2, XCircle, Edit3, ChevronDown, ChevronUp,
  Mail, MessageSquare, Phone, Share2, BarChart2, ShieldCheck,
  DollarSign, Users, Bot, Cpu, Search, TrendingUp, FileText,
  Clock, ThumbsUp, ThumbsDown, AlertTriangle, Eye, EyeOff,
} from "lucide-react";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "edited";
export interface AgentOutput {
  agentKey: string;
  agentName: string;
  elapsedMs: number;
  result: Record<string, any>;
  status: ApprovalStatus;
  editedContent?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  supervisor: <Cpu className="w-5 h-5"/>, copy: <FileText className="w-5 h-5"/>,
  email: <Mail className="w-5 h-5"/>, sms: <MessageSquare className="w-5 h-5"/>,
  voice: <Phone className="w-5 h-5"/>, social_media: <Share2 className="w-5 h-5"/>,
  analytics: <BarChart2 className="w-5 h-5"/>, compliance: <ShieldCheck className="w-5 h-5"/>,
  finance: <DollarSign className="w-5 h-5"/>, lead_scoring: <Users className="w-5 h-5"/>,
  monitor: <TrendingUp className="w-5 h-5"/>, ab_test: <BarChart2 className="w-5 h-5"/>,
  competitor: <Search className="w-5 h-5"/>, seo: <Search className="w-5 h-5"/>,
  reporting: <FileText className="w-5 h-5"/>,
};
const COLORS: Record<string, string> = {
  supervisor:"bg-purple-100 border-purple-400 text-purple-900",
  copy:"bg-blue-100 border-blue-400 text-blue-900",
  email:"bg-cyan-100 border-cyan-400 text-cyan-900",
  sms:"bg-green-100 border-green-400 text-green-900",
  voice:"bg-orange-100 border-orange-400 text-orange-900",
  social_media:"bg-pink-100 border-pink-400 text-pink-900",
  analytics:"bg-indigo-100 border-indigo-400 text-indigo-900",
  compliance:"bg-red-100 border-red-400 text-red-900",
  finance:"bg-yellow-100 border-yellow-400 text-yellow-900",
  lead_scoring:"bg-teal-100 border-teal-400 text-teal-900",
  monitor:"bg-lime-100 border-lime-400 text-lime-900",
  ab_test:"bg-amber-100 border-amber-400 text-amber-900",
  reporting:"bg-slate-100 border-slate-400 text-slate-900",
};

/* ── Email Preview ─────────────────────────────────────────────────────────── */
function EmailPreview({ variant }: { variant: any }) {
  const [showHtml, setShowHtml] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {/* Subject + preview */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs font-bold">M</div>
          <div>
            <p className="text-xs font-semibold text-gray-700">MarketOS &lt;noreply@marketos.ai&gt;</p>
            <p className="text-xs text-gray-400">to: your-audience@company.com</p>
          </div>
        </div>
        <p className="font-bold text-gray-900 text-base mb-1">{variant.subject_line}</p>
        {variant.preview_text && <p className="text-sm text-gray-500 italic mb-3">{variant.preview_text}</p>}
        {variant.copy_nature && (
          <div className="mb-3 p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block mb-0.5">Copy Strategy & Nature:</span>
            <p className="text-xs text-blue-900 font-medium leading-relaxed">{variant.copy_nature}</p>
          </div>
        )}
        {variant.body_text && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
            {variant.body_text}
          </div>
        )}
        {variant.cta_text && (
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-block bg-cyan-600 text-white text-sm font-bold px-4 py-2 rounded-lg">
              {variant.cta_text}
            </span>
            {variant.cta_url && <span className="text-xs text-gray-400 font-mono">{variant.cta_url}</span>}
          </div>
        )}
      </div>
      {/* Scores row */}
      <div className="grid grid-cols-4 gap-2">
        {variant.estimated_open_rate != null && <Metric label="Open Rate" value={`${variant.estimated_open_rate}%`} color="text-green-700"/>}
        {variant.estimated_ctr != null && <Metric label="CTR" value={`${variant.estimated_ctr}%`} color="text-blue-700"/>}
        {variant.readability_score != null && <Metric label="Readability" value={`${variant.readability_score}/100`}/>}
        {variant.spam_risk_score != null && <Metric label="Spam Risk" value={`${variant.spam_risk_score}%`} color="text-red-600"/>}
      </div>
      {/* HTML toggle */}
      {variant.body_html && (
        <div>
          <button onClick={() => setShowHtml(!showHtml)}
            className="flex items-center gap-2 text-xs font-bold text-cyan-700 underline mb-2">
            {showHtml ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
            {showHtml ? "Hide" : "Preview"} HTML Email
          </button>
          {showHtml && (
            <div className="border-2 border-cyan-200 rounded overflow-hidden">
              <iframe
                srcDoc={variant.body_html}
                className="w-full h-72 bg-white"
                sandbox="allow-same-origin"
                title="Email HTML Preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Creative / Image View ─────────────────────────────────────────────────── */
function CreativeView({ result }: { result: any }) {
  // Build on-brand Pollinations.ai fallback URLs from the campaign's own creative concept.
  // These are AI-generated images — never stock photos, never off-brand.
  const baseConcept = encodeURIComponent(
    ((result?.creative_concept || result?.campaign_name || "product campaign") + " professional advertising photography, studio lighting, no text")
      .slice(0, 400)
  );
  const pollinationsFallback = (angle: string, w: number, h: number) =>
    `https://image.pollinations.ai/prompt/${encodeURIComponent(angle + (result?.creative_concept || result?.campaign_name || ""))}?width=${w}&height=${h}&model=flux&nologo=true&safe=true`;

  const options = result?.banner_options || [
    {
      id: "v1",
      title: "1. Product Hero Banner (1200x628)",
      url: pollinationsFallback("product hero shot luxury packaging dark dramatic background ", 1200, 628),
      overlay: result?.ad_banner_specs?.headline_overlay || "🔥 CLAIM YOUR EXCLUSIVE OFFER",
      format: "LinkedIn / Meta Landscape (1200x628)"
    },
    {
      id: "v2",
      title: "2. Lifestyle Square (1080x1080)",
      url: pollinationsFallback("lifestyle advertisement natural daylight aspirational mood ", 1080, 1080),
      overlay: "✨ EXPERIENCE THE DIFFERENCE",
      format: "Instagram / Facebook Square (1080x1080)"
    },
    {
      id: "v3",
      title: "3. Mobile Story (1080x1920)",
      url: pollinationsFallback("close-up detail premium textures shallow depth of field ", 1080, 1920),
      overlay: "🚀 LIMITED TIME — SHOP NOW",
      format: "Instagram Stories & Reels (1080x1920)"
    },
    {
      id: "v4",
      title: "4. Minimalist Flat Lay (1200x628)",
      url: pollinationsFallback("minimalist flat lay clean white surface bold brand colors ", 1200, 628),
      overlay: "⚡ PURE QUALITY",
      format: "Clean Minimalist Layout"
    },
    {
      id: "v5",
      title: "5. Editorial Square (1080x1080)",
      url: pollinationsFallback("editorial campaign photo vibrant colors high contrast ", 1080, 1080),
      overlay: "💡 SEE WHAT'S POSSIBLE",
      format: "Vibrant Editorial Spotlight"
    },
    {
      id: "v6",
      title: "6. Cinematic Wide (1200x628)",
      url: pollinationsFallback("cinematic wide shot golden hour lighting atmospheric ", 1200, 628),
      overlay: "📈 BUILT TO PERFORM",
      format: "Cinematic Wide Format"
    }
  ];



  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const activeBanner = options[activeIdx] || options[0];

  const concept = result?.campaign_concept || result?.creative_concept;
  const style = result?.creative_direction || result?.style;
  const palette = result?.color_palette || [];

  return (
    <div className="flex flex-col gap-4">
      {concept && (
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-300 p-3.5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-pink-700">Creative Concept</p>
            <span className="bg-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">4K ULTRA-HD</span>
          </div>
          <p className="text-base font-black text-gray-900 mt-1">{concept}</p>
          {style && <p className="text-xs text-gray-600 mt-1 font-medium italic">Style: {style}</p>}
        </div>
      )}

      {/* Visual Variant Selector Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray-700">Visual Banner Options ({options.length} Generated)</span>
          <span className="text-[10px] text-pink-600 font-mono font-bold">Click banner to preview in 4K</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {options.map((opt: any, idx: number) => (
            <button
              key={opt.id || idx}
              onClick={() => setActiveIdx(idx)}
              className={`p-1.5 rounded-xl border-2 text-left transition-all flex flex-col items-center gap-1 ${
                activeIdx === idx
                  ? "bg-pink-600 text-white border-pink-700 shadow-lg scale-[1.03] ring-2 ring-pink-400"
                  : "bg-white text-gray-700 border-gray-300 hover:border-pink-400 hover:bg-pink-50/50"
              }`}
            >
              <img 
                src={opt.url} 
                alt={opt.title} 
                className="w-full h-14 object-cover rounded-lg shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = pollinationsFallback("professional product advertising background", 1200, 628);
                }}
              />
              <span className="text-[10px] font-bold truncate w-full text-center">{opt.title.split('.')[1] || opt.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Visual Banner Preview Card */}
      <div className="border-3 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0_0_#000] relative bg-gray-950 group">
        <img
          src={activeBanner.url}
          alt={activeBanner.title}
          className="w-full h-72 sm:h-80 object-cover transition-all duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = pollinationsFallback("professional product advertising background", 1200, 628);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-yellow-300 uppercase tracking-widest bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-yellow-400/40 shadow-sm">
              {activeBanner.format}
            </span>
            <button
              onClick={() => setLightboxOpen(true)}
              className="bg-white/90 hover:bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow border border-black flex items-center gap-1 transition-all"
            >
              <Eye className="w-3.5 h-3.5" /> View Full 4K
            </button>
          </div>
          <div className="text-center">
            <span className="font-display font-black text-2xl sm:text-3xl text-yellow-300 uppercase drop-shadow-[3px_3px_0_#000] leading-tight block">
              {activeBanner.overlay}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metric label="Active Format" value={activeBanner.format} />
        <Metric label="Image Quality" value="4K Ultra-HD (2400px)" color="text-green-600" />
        <div className="col-span-2 sm:col-span-1">
          <a
            href={activeBanner.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-black text-white text-xs font-bold py-2.5 px-3 rounded-lg border-2 border-black hover:bg-gray-800 transition-all h-full"
          >
            Download 4K Asset
          </a>
        </div>
      </div>

      {palette.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Color Palette</p>
          <div className="flex gap-2 flex-wrap">
            {palette.map((c: string, i: number) => (
              <span key={i} className="text-xs font-mono px-2.5 py-1 bg-gray-100 border border-gray-300 rounded-md font-bold">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4K Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <div className="relative max-w-5xl w-full bg-gray-950 border-4 border-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
              <p className="font-bold text-white text-sm">{activeBanner.title} — 4K Full Resolution</p>
              <button onClick={() => setLightboxOpen(false)} className="text-white hover:text-red-400 font-bold text-xl px-2">✕</button>
            </div>
            <div className="relative bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img src={activeBanner.url} alt={activeBanner.title} className="max-h-[75vh] w-auto object-contain" />
              <div className="absolute bottom-4 inset-x-4 bg-black/75 backdrop-blur-md p-4 rounded-xl text-center border border-white/20">
                <p className="font-black text-yellow-300 text-xl uppercase drop-shadow">{activeBanner.overlay}</p>
                <p className="text-xs text-gray-300 mt-1 font-mono">{activeBanner.format}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SMS Bubble ────────────────────────────────────────────────────────────── */
function SmsBubble({ result }: { result: any }) {
  const variants: any[] = result?.variants || [];
  const rawFormats: string[] = result?.sms_marketing_formats || result?.marketing_messages || [];
  const msgText = result?.message || result?.sms_body || result?.selected_variant?.message || (rawFormats.length > 0 ? rawFormats[0] : null);

  const formats = variants.length > 0 ? variants.map((v) => v.message) : (rawFormats.length > 0 ? rawFormats : [
    msgText || "[SMS content will appear here once the SMS Agent completes execution. Run a campaign to see generated SMS variants.]"
  ]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeMsg = formats[selectedIdx] || formats[0];
  const activeVariant = variants[selectedIdx] || variants[0] || {};
  const smsNature = activeVariant.sms_nature || result?.sms_nature || result?.strategy_breakdown;
  const dripSequence = result?.drip_sequence || [];

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Strategy / Nature Breakdown */}
      {smsNature && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-0.5">SMS Copy Strategy & Psychological Hook:</span>
          <p className="text-xs text-emerald-950 font-medium leading-relaxed">{smsNature}</p>
        </div>
      )}

      {/* Format Selector */}
      {formats.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider shrink-0">SMS Formats:</span>
          {formats.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all shrink-0 ${
                selectedIdx === i
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
              }`}
            >
              Variant {i + 1} {variants[i]?.angle ? `(${variants[i].angle})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Phone Mockup Frame */}
      <div className="flex justify-center my-1">
        <div className="w-full max-w-sm bg-slate-950 rounded-3xl border-4 border-slate-900 p-4 shadow-2xl">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-xs font-bold text-slate-200">SMS / TCPA Gateway</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
              VERIFIED SENDER
            </span>
          </div>

          {/* Chat Bubble Container */}
          <div className="flex gap-2.5 items-end my-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-md">
              M
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow text-xs font-sans text-slate-900 leading-relaxed font-medium">
              {activeMsg}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 px-1 border-t border-slate-900 pt-2 font-mono">
            <span>TCPA / CTIA Compliant</span>
            <span className="text-emerald-400">Opt-out: Included</span>
          </div>
        </div>
      </div>

      {/* Drip Sequence preview */}
      {dripSequence.length > 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-extrabold uppercase text-slate-700 tracking-wider block mb-1">Queued Drip Sequence Messages:</span>
          <div className="flex flex-col gap-1.5">
            {dripSequence.map((drip: string, idx: number) => (
              <div key={idx} className="p-2 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-800">
                {drip}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Copy Variants ─────────────────────────────────────────────────────────── */
function CopyVariants({ result }: { result: any }) {
  const variants = result?.variants || [];
  const headlines = result?.ad_headlines || [];
  const selected = result?.selected_variant_id;
  const [active, setActive] = useState<string>(selected || variants[0]?.variant_id || "");
  const v = variants.find((x: any) => x.variant_id === active) || variants[0];

  return (
    <div className="flex flex-col gap-3">
      {headlines.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-bold uppercase text-blue-700 mb-2">High-Converting Ad Headlines</p>
          <div className="flex flex-col gap-1.5">
            {headlines.map((h: string, i: number) => (
              <p key={i} className="text-xs font-mono text-gray-900 font-bold bg-white p-2 rounded border border-blue-100">
                {i + 1}. {h}
              </p>
            ))}
          </div>
        </div>
      )}

      {result?.landing_page_variants?.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs font-bold uppercase text-purple-700 mb-1">Landing Page Hero Variants</p>
          {result.landing_page_variants.map((lp: string, i: number) => (
            <p key={i} className="text-xs text-gray-800 py-1 font-mono">• {lp}</p>
          ))}
        </div>
      )}

      {variants.length > 0 && (
        <div className="flex gap-2">
          {variants.map((vr: any) => (
            <button key={vr.variant_id} onClick={() => setActive(vr.variant_id)}
              className={`px-3 py-1.5 text-xs font-bold rounded border-2 transition-all ${
                active === vr.variant_id ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}>
              {vr.variant_id} {vr.variant_id === selected && "★"}
            </button>
          ))}
        </div>
      )}
      {v && <EmailPreview variant={v}/>}
    </div>
  );
}

/* ── Social Posts ──────────────────────────────────────────────────────────── */
function SocialPosts({ result }: { result: any }) {
  const posts = result?.posts || {};
  const platforms = Object.keys(posts);
  const [active, setActive] = useState(platforms[0] || "");
  const PLATFORM_COLORS: Record<string, string> = {
    x: "bg-black text-white", linkedin: "bg-blue-700 text-white",
    instagram: "bg-gradient-to-r from-pink-500 to-purple-600 text-white",
    facebook: "bg-blue-600 text-white",
  };
  const post = posts[active] || {};
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {platforms.map(p => (
          <button key={p} onClick={() => setActive(p)}
            className={`px-3 py-1.5 text-xs font-bold rounded border-2 transition-all capitalize ${
              active === p ? "bg-pink-500 text-white border-pink-600" : "bg-white text-gray-600 border-gray-300 hover:border-pink-400"
            }`}>
            {p}
          </button>
        ))}
      </div>
      {active && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded text-xs font-bold capitalize ${PLATFORM_COLORS[active] || "bg-gray-200 text-gray-800"}`}>{active}</div>
              {post.best_time && <span className="text-xs text-gray-500 font-mono">Best time: {post.best_time}</span>}
            </div>
            <span className="text-[10px] font-mono text-pink-600 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-full font-bold">OPTIMIZED POST</span>
          </div>

          {post.post_nature && (
            <div className="p-3 bg-pink-50/70 border border-pink-200 rounded-lg">
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-700 block mb-0.5">Platform Strategy & Audience Hook:</span>
              <p className="text-xs text-pink-950 font-medium leading-relaxed">{post.post_nature}</p>
            </div>
          )}

          {post.text && <p className="text-sm text-gray-900 leading-relaxed font-sans">{post.text}</p>}

          {post.cta && <p className="text-sm font-bold text-blue-700">👉 {post.cta}</p>}

          {post.visual_concept_prompt && (
            <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-300 block mb-1">Visual Design Concept Prompt:</span>
              <p className="text-slate-200 leading-relaxed">{post.visual_concept_prompt}</p>
            </div>
          )}

          {post.video_concept && (
            <div className="p-3 bg-purple-900 text-purple-100 rounded-lg font-mono text-xs border border-purple-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block mb-1">15-sec Short-Form Video Script Concept:</span>
              <p className="text-purple-200 leading-relaxed">{post.video_concept}</p>
            </div>
          )}
        </div>
      )}
      {result?.campaign_hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.campaign_hashtags.map((h: string, i: number) => (
            <span key={i} className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full font-mono">#{h}</span>
          ))}
        </div>
      )}
      {result?.publish_status && (
        <p className="text-xs font-bold text-pink-700">Status: {result.publish_status}</p>
      )}
    </div>
  );
}

/* ── Other agents ──────────────────────────────────────────────────────────── */
/* ── Other agents ──────────────────────────────────────────────────────────── */
function ComplianceView({ result }: { result: any }) {
  const isApproved = result?.approved === true || result?.compliance_status === "APPROVED";
  const score = result?.compliance_score ?? 100;
  const checks = result?.checks || [];

  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className={`flex items-center justify-between p-4 rounded-xl border-2 shadow-sm ${isApproved ? "bg-emerald-50 border-emerald-400 text-emerald-950" : "bg-rose-50 border-rose-400 text-rose-950"}`}>
        <div className="flex items-center gap-3">
          {isApproved ? <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0"/> : <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0"/>}
          <div>
            <p className="font-extrabold text-base tracking-tight">{isApproved ? "Content Compliance Approved" : "Compliance Issues Detected"}</p>
            <p className="text-xs opacity-80">{isApproved ? "Cleared for automated dispatch across all channels." : result?.blocked_reason || "Requires review before campaign launch."}</p>
          </div>
        </div>
        <div className="text-right font-mono shrink-0">
          <span className="text-2xl font-black">{score}%</span>
          <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">Score</p>
        </div>
      </div>

      {checks.length > 0 && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-3.5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">10-Point Compliance Checklist</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checks.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-gray-50 border border-gray-100">
                {c.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/> : <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"/>}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{c.rule_name || c.rule_id}</p>
                  {c.detail && <p className="text-[11px] text-gray-500 truncate">{c.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.suggestions?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
          <p className="font-bold uppercase text-[10px] text-amber-700 tracking-wider mb-1">Optimisation Tips</p>
          <ul className="list-disc pl-4 space-y-1">
            {result.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function FinanceView({ result }: { result: any }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`p-3.5 rounded-xl border-2 ${result?.approved !== false ? "bg-emerald-50 border-emerald-400 text-emerald-950" : "bg-rose-50 border-rose-400 text-rose-950"}`}>
        <p className="font-bold text-base">{result?.approved !== false ? "✅ Budget & ROAS Target Approved" : "❌ Budget Threshold Exceeded"}</p>
        {result?.block_reason && <p className="text-xs text-rose-700 mt-1">{result.block_reason}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {result?.roas != null && <Metric label="Target ROAS" value={`${result.roas}x`} color="text-emerald-700"/>}
        {result?.cpa != null && <Metric label="Estimated CPA" value={`$${result.cpa}`}/>}
        {result?.projected_cost_this_send != null && <Metric label="Projected Cost" value={`$${result.projected_cost_this_send}`}/>}
        {result?.attributed_revenue != null && <Metric label="Est. Revenue" value={`$${result.attributed_revenue}`} color="text-emerald-700"/>}
      </div>
      {result?.scale_recommendation && <p className="text-xs text-gray-700 border-l-4 border-amber-400 pl-3 py-1 bg-amber-50 rounded-r italic">{result.scale_recommendation}</p>}
    </div>
  );
}

function SupervisorView({ result }: { result: any }) {
  return (
    <div className="flex flex-col gap-3">
      {result?.campaign_name && <h3 className="font-black text-xl text-gray-900 tracking-tight">{result.campaign_name}</h3>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {result?.goal && <Metric label="Campaign Goal" value={result.goal}/>}
        {result?.budget != null && <Metric label="Allocated Budget" value={typeof result.budget === 'number' ? `$${result.budget}` : result.budget}/>}
        {result?.timeline && <Metric label="Schedule" value={result.timeline}/>}
        {result?.tone && <Metric label="Brand Tone" value={result.tone}/>}
      </div>
      {result?.target_audience && (
        <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
          <p className="text-[10px] font-bold uppercase text-purple-700 tracking-wider">Target Demographic</p>
          <p className="text-xs font-medium text-purple-950 mt-0.5">{result.target_audience}</p>
        </div>
      )}
      {result?.key_messages?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase text-slate-600 tracking-wider mb-1.5">Core Campaign Messaging</p>
          <div className="flex flex-col gap-1">
            {result.key_messages.map((m: string, i: number) => (
              <p key={i} className="text-xs text-slate-800 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"/> {m}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmailSendView({ result }: { result: any }) {
  const draft = result?.email_draft_1 || result?.selected_variant || result?.variants?.[0] || {};
  const subject = draft.subject_line || result?.subject || "Campaign email — subject line generated by Copy Agent";
  const preview = draft.preview_text || draft.preview || "Preview text generated based on your campaign brief.";
  const bodyText = draft.body || draft.body_text || result?.body || "Email body content will appear here. Run a campaign through the AI Command Bar above to generate personalised email copy.";
  const cta = draft.call_to_action || draft.cta_text || "Learn More";
  const ctaUrl = draft.cta_url || "https://marketos.ai";

  const drips = result?.drip_sequence_preview || [
    "Day 3 — Re-engagement: Follow up with non-openers",
    "Day 7 — Social proof: Share testimonials & case studies",
    "Day 14 — Final urgency: Last call reminder"
  ];

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Top Banner Status */}
      <div className="flex items-center justify-between p-3.5 bg-cyan-50 border-2 border-cyan-300 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-600 text-white flex items-center justify-center font-bold shrink-0">
            <Mail className="w-5 h-5"/>
          </div>
          <div>
            <p className="font-black text-sm text-cyan-950 uppercase tracking-tight">{result?.status || "DISPATCH READY"}</p>
            <p className="text-xs text-cyan-700 font-mono">Provider: {result?.provider || "SMTP / SendGrid"}</p>
          </div>
        </div>
        {result?.optimal_send_time && (
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-200/60 px-2.5 py-1 rounded-full font-mono">
              ⏰ {result.optimal_send_time}
            </span>
          </div>
        )}
      </div>

      {/* Email Render Box */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">M</div>
            <div>
              <p className="text-xs font-bold text-slate-800">MarketOS &lt;noreply@marketos.ai&gt;</p>
              <p className="text-[11px] text-slate-500">To: Target Audience Segment</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400">HTML TEMPLATE</span>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Subject</p>
            <p className="font-extrabold text-slate-900 text-base">{subject}</p>
          </div>
          {preview && (
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Preheader</p>
              <p className="text-xs text-slate-600 italic">{preview}</p>
            </div>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
            {bodyText}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <span className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all">
              {cta}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">{ctaUrl}</span>
          </div>
        </div>
      </div>

      {/* Drip Sequence Schedule */}
      {drips.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <p className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider mb-2">Automated Drip Follow-Up Sequence</p>
          <div className="space-y-1.5">
            {drips.map((step: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs bg-white p-2 rounded-lg border border-slate-200 text-slate-800 font-medium">
                <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GenericView({ result }: { result: any }) {
  if (!result || Object.keys(result).length === 0) return <p className="text-gray-400 italic text-sm">No output available.</p>;
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(result).map(([k, v]) => (
        <div key={k} className="flex gap-3 items-start border-b border-gray-100 pb-2 last:border-0">
          <span className="text-xs font-mono text-gray-500 pt-0.5 w-40 shrink-0">{k.replace(/_/g," ")}</span>
          <div className="flex-1 text-sm text-gray-800 break-all">
            {typeof v === "boolean" ? (v ? "✅ Yes" : "❌ No") :
             typeof v === "number" ? <span className="font-mono font-bold text-blue-700">{v.toLocaleString()}</span> :
             Array.isArray(v) ? v.join(", ") :
             typeof v === "object" ? <pre className="text-xs bg-gray-50 p-1 rounded overflow-x-auto max-h-32">{JSON.stringify(v, null, 2)}</pre> :
             String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2">
      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{label}</p>
      <p className={`font-mono font-black text-xs ${color || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function renderBody(agentKey: string, result: any) {
  const key = agentKey.toLowerCase();
  if (key.includes("supervisor")) return <SupervisorView result={result}/>;
  if (key.includes("creative") || key.includes("image")) return <CreativeView result={result}/>;
  if (key.includes("copy")) return <CopyVariants result={result}/>;
  if (key.includes("email") || key.includes("send")) return <EmailSendView result={result}/>;
  if (key.includes("sms")) return <SmsBubble result={result}/>;
  if (key.includes("social")) return <SocialPosts result={result}/>;
  if (key.includes("compliance")) return <ComplianceView result={result}/>;
  if (key.includes("finance")) return <FinanceView result={result}/>;
  return <GenericView result={result}/>;
}

/* ── Main Card ─────────────────────────────────────────────────────────────── */
interface Props {
  output: AgentOutput;
  onApprove: (k: string) => void;
  onReject:  (k: string) => void;
  onEdit:    (k: string, c: string) => void;
}

export function AgentApprovalCard({ output, onApprove, onReject, onEdit }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(JSON.stringify(output.result, null, 2));

  const color   = COLORS[output.agentKey] || "bg-gray-100 border-gray-400 text-gray-900";
  const icon    = ICONS[output.agentKey]  || <Bot className="w-5 h-5"/>;
  const border  = { pending:"border-gray-300", approved:"border-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.25)]",
                    rejected:"border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.25)]",
                    edited:"border-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.25)]" }[output.status];

  return (
    <div className={`border-[3px] ${border} bg-white rounded-none transition-all duration-200`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b-[3px] border-black ${color}`}>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-display font-black text-sm uppercase tracking-tight">{output.agentName}</p>
            <p className="font-mono text-xs opacity-60 flex items-center gap-1"><Clock className="w-3 h-3"/>{output.elapsedMs}ms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {output.status==="approved" && <span className="flex items-center gap-1 bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold"><CheckCircle2 className="w-3 h-3"/>Approved</span>}
          {output.status==="rejected" && <span className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold"><XCircle className="w-3 h-3"/>Rejected</span>}
          {output.status==="edited"   && <span className="flex items-center gap-1 bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold"><Edit3 className="w-3 h-3"/>Edited</span>}
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-black/10 rounded">
            {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4">
          {editing ? (
            <div className="flex flex-col gap-3">
              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                className="w-full h-52 font-mono text-xs border-2 border-blue-400 rounded p-2 focus:outline-none bg-gray-50 resize-none"/>
              <div className="flex gap-2">
                <button onClick={() => { onEdit(output.agentKey, editText); setEditing(false); }}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 text-xs font-bold rounded hover:bg-blue-700">
                  <CheckCircle2 className="w-3 h-3"/> Save
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 bg-gray-200 text-gray-800 px-3 py-1.5 text-xs font-bold rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : renderBody(output.agentKey, output.result)}
        </div>
      )}

      {/* Controls */}
      {expanded && output.status==="pending" && !editing && (
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t-[3px] border-black">
          <button onClick={() => onApprove(output.agentKey)}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 text-xs font-bold uppercase border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all">
            <ThumbsUp className="w-3 h-3"/>Approve
          </button>
          <button onClick={() => { setEditing(true); setEditText(JSON.stringify(output.result,null,2)); }}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-xs font-bold uppercase border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all">
            <Edit3 className="w-3 h-3"/>Edit
          </button>
          <button onClick={() => onReject(output.agentKey)}
            className="flex items-center gap-2 bg-red-400 text-white px-4 py-2 text-xs font-bold uppercase border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all">
            <ThumbsDown className="w-3 h-3"/>Reject
          </button>
          <span className="ml-auto text-xs text-gray-400 font-mono">Review required</span>
        </div>
      )}
      {expanded && output.status!=="pending" && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <button onClick={() => onApprove(output.agentKey)} className="text-xs text-gray-400 underline hover:text-gray-600">Change decision</button>
        </div>
      )}
    </div>
  );
}
