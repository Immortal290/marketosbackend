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
  const preview = result?.asset_preview || result?.asset_url || result?.asset_preview_url;
  const concept = result?.campaign_concept || result?.creative_concept;
  const style = result?.creative_direction || result?.style;
  const specs = result?.ad_banner_specs || {};
  const palette = result?.color_palette || [];

  return (
    <div className="flex flex-col gap-4">
      {concept && (
        <div className="bg-pink-50 border border-pink-200 p-3 rounded-lg">
          <p className="text-xs font-bold uppercase text-pink-700">Creative Concept</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{concept}</p>
          {style && <p className="text-xs text-gray-600 mt-1 italic">Style: {style}</p>}
        </div>
      )}

      {/* Visual Image Preview */}
      {preview && (
        <div className="border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0_0_#000] relative bg-gray-900">
          <img src={preview} alt="Creative Asset Preview" className="w-full h-48 object-cover" />
          {specs.headline_overlay && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 text-center">
              <span className="font-display font-black text-xl text-yellow-300 uppercase drop-shadow-[2px_2px_0_#000]">
                {specs.headline_overlay}
              </span>
            </div>
          )}
        </div>
      )}

      {specs.dimensions && (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Banner Dimensions" value={specs.dimensions} />
          <Metric label="Visual Variants" value={`${result?.total_variants_generated || 4} generated`} />
        </div>
      )}

      {palette.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Color Palette</p>
          <div className="flex gap-2 flex-wrap">
            {palette.map((c: string, i: number) => (
              <span key={i} className="text-xs font-mono px-2 py-1 bg-gray-100 border border-gray-300 rounded font-bold">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SMS Bubble ────────────────────────────────────────────────────────────── */
function SmsBubble({ result }: { result: any }) {
  const formats: string[] = result?.sms_marketing_formats || [];
  const v = result?.variants?.[0] || {};
  const msg = formats[0] || v.message || result?.selected_variant?.message || "SMS content generated";

  return (
    <div className="flex flex-col gap-4">
      {/* Phone mockup */}
      <div className="flex justify-center">
        <div className="w-72 bg-gray-900 rounded-3xl border-4 border-black p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
            <span className="text-xs font-bold text-white">Messages</span>
            <span className="text-[10px] text-lime-400">Live Preview</span>
          </div>
          <div className="flex gap-2 items-end">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">M</div>
            <div className="bg-white rounded-2xl rounded-bl-none px-3 py-2.5 shadow text-xs font-mono text-gray-900 leading-relaxed">
              {msg}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-right">TCPA Opt-out Included</p>
        </div>
      </div>

      {formats.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase text-green-700">Alternative SMS Formats</p>
          {formats.slice(1).map((f, i) => (
            <div key={i} className="bg-green-50 border border-green-200 p-2.5 rounded text-xs font-mono text-gray-800">
              {f}
            </div>
          ))}
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
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${PLATFORM_COLORS[active] || "bg-gray-200 text-gray-800"}`}>{active}</div>
            {post.best_time && <span className="text-xs text-gray-400">Best time: {post.best_time}</span>}
          </div>
          {post.text && <p className="text-sm text-gray-900 leading-relaxed">{post.text}</p>}
          {post.cta && <p className="mt-2 text-sm font-bold text-blue-700">👉 {post.cta}</p>}
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
function ComplianceView({ result }: { result: any }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-3 p-3 rounded-lg border-2 ${result?.approved || result?.compliance_status === "APPROVED" ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"}`}>
        {result?.approved || result?.compliance_status === "APPROVED" ? <CheckCircle2 className="w-6 h-6 text-green-600"/> : <AlertTriangle className="w-6 h-6 text-red-600"/>}
        <div className="flex-1">
          <p className="font-bold">{result?.approved || result?.compliance_status === "APPROVED" ? "✅ Content Approved" : "❌ Issues Found"}</p>
          {result?.policy_notes && <p className="text-xs text-gray-600 mt-0.5">{result.policy_notes}</p>}
        </div>
        {result?.compliance_score != null && <span className="font-mono font-black text-2xl">{result.compliance_score}%</span>}
      </div>
      {result?.checks?.map((c: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
          {c.passed ? <CheckCircle2 className="w-4 h-4 text-green-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}
          <span className="font-medium">{c.rule}</span>
        </div>
      ))}
      {result?.suggestions?.map((s: string, i: number) => (
        <p key={i} className="text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded">💡 {s}</p>
      ))}
    </div>
  );
}

function FinanceView({ result }: { result: any }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`p-3 rounded-lg border-2 ${result?.approved ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"}`}>
        <p className="font-bold text-lg">{result?.approved ? "✅ Budget Approved" : "❌ Budget Rejected"}</p>
        {result?.block_reason && <p className="text-sm text-red-700 mt-1">{result.block_reason}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {result?.roas != null && <Metric label="ROAS" value={`${result.roas}x`} color="text-green-700"/>}
        {result?.cpa != null && <Metric label="CPA" value={`$${result.cpa}`}/>}
        {result?.projected_cost_this_send != null && <Metric label="Projected Cost" value={`$${result.projected_cost_this_send}`}/>}
        {result?.attributed_revenue != null && <Metric label="Revenue" value={`$${result.attributed_revenue}`} color="text-green-700"/>}
      </div>
      {result?.scale_recommendation && <p className="text-sm text-gray-700 border-l-4 border-yellow-400 pl-3 italic">{result.scale_recommendation}</p>}
    </div>
  );
}

function SupervisorView({ result }: { result: any }) {
  return (
    <div className="flex flex-col gap-3">
      {result?.campaign_name && <h3 className="font-black text-xl text-gray-900">{result.campaign_name}</h3>}
      <div className="grid grid-cols-2 gap-2">
        {result?.goal && <Metric label="Goal" value={result.goal}/>}
        {result?.budget != null && <Metric label="Budget" value={typeof result.budget === 'number' ? `$${result.budget}` : result.budget}/>}
        {result?.timeline && <Metric label="Timeline" value={result.timeline}/>}
        {result?.tone && <Metric label="Tone" value={result.tone}/>}
        {result?.target_audience && <div className="col-span-2"><Metric label="Target Audience" value={result.target_audience}/></div>}
      </div>
      {result?.key_messages?.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs font-bold uppercase text-purple-700 mb-2">Key Messages</p>
          {result.key_messages.map((m: string, i: number) => <p key={i} className="text-xs text-gray-800">• {m}</p>)}
        </div>
      )}
    </div>
  );
}

function EmailSendView({ result }: { result: any }) {
  const draft = result?.email_draft_1 || result?.selected_variant || {};
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 p-3 bg-cyan-50 border border-cyan-300 rounded-lg">
        <Mail className="w-5 h-5 text-cyan-600"/>
        <div>
          <p className="font-bold text-sm">{result?.status || "CONFIGURED & READY"}</p>
          <p className="text-xs text-gray-500">Sequence: {result?.email_campaign_name || "Enterprise Nurture"}</p>
        </div>
      </div>
      
      {(draft.subject_line || draft.body) && (
        <div className="border-2 border-cyan-300 rounded-lg p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <div className="w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs font-bold">M</div>
            <div>
              <p className="text-xs font-bold text-gray-800">MarketOS AI &lt;noreply@marketos.ai&gt;</p>
              <p className="text-xs text-gray-400">To: Target Audience Segment</p>
            </div>
          </div>
          {draft.subject_line && <p className="font-bold text-gray-900 text-sm mb-1">Subject: {draft.subject_line}</p>}
          {draft.preview_text && <p className="text-xs text-gray-500 italic mb-3">Preview: {draft.preview_text}</p>}
          {draft.body && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-sans">
              {draft.body}
            </div>
          )}
          {draft.call_to_action && (
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-block bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded">
                {draft.call_to_action}
              </span>
              {draft.cta_url && <span className="text-xs text-gray-400 font-mono">{draft.cta_url}</span>}
            </div>
          )}
        </div>
      )}

      {result?.sequence_schedule && (
        <p className="text-xs text-gray-600 font-mono bg-cyan-50 p-2 rounded">📅 Schedule: {result.sequence_schedule}</p>
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
