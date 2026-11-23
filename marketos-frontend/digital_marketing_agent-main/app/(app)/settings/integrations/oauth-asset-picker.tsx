"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

type OAuthAsset = {
  id: string;
  label: string;
  type: string;
};

type AssetResponse = {
  success: boolean;
  data?: {
    provider: string;
    assets: OAuthAsset[];
    selectedAssetIds: string[];
  };
};

type SaveResponse = {
  success: boolean;
  data?: {
    provider: string;
    selectedAssetIds: string[];
  };
};

const SUPPORTED = new Set([
  "ga4",
  "google_ads",
  "meta_ads",
  "linkedin",
]);

export default function OAuthAssetPicker({
  connectionId,
  provider,
  status,
}: {
  connectionId: string;
  provider: string;
  status?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [assets, setAssets] = useState<OAuthAsset[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const endpoint =
    `/settings/oauth/connections/${encodeURIComponent(connectionId)}/assets`;

  async function loadAssets() {
    setLoading(true);
    setLoaded(false);
    setSaved(false);
    setError(null);

    try {
      const result = await apiRequest<AssetResponse>(endpoint);

      if (
        result?.success !== true ||
        result.data?.provider !== provider ||
        !Array.isArray(result.data.assets) ||
        !Array.isArray(result.data.selectedAssetIds)
      ) {
        throw new Error("Invalid asset response");
      }

      const available = result.data.assets;

      if (
        !available.every(
          (asset) =>
            asset &&
            typeof asset.id === "string" &&
            typeof asset.label === "string" &&
            typeof asset.type === "string"
        )
      ) {
        throw new Error("Invalid asset list");
      }

      const allowed = new Set(available.map((asset) => asset.id));

      setAssets(available);
      setSelected(
        result.data.selectedAssetIds.filter(
          (id) => typeof id === "string" && allowed.has(id)
        )
      );
      setLoaded(true);
    } catch {
      setAssets([]);
      setSelected([]);
      setError("Unable to load accessible assets. Check the OAuth connection.");
    } finally {
      setLoading(false);
    }
  }

  function toggleAsset(id: string) {
    setSaved(false);

    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 50
          ? [...current, id]
          : current
    );
  }

  async function saveAssets() {
    if (!loaded || saving) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const result = await apiRequest<SaveResponse>(endpoint, {
        method: "PUT",
        body: JSON.stringify({ assetIds: selected }),
      });

      if (
        result?.success !== true ||
        result.data?.provider !== provider ||
        !Array.isArray(result.data.selectedAssetIds)
      ) {
        throw new Error("Invalid save response");
      }

      setSelected(result.data.selectedAssetIds);
      setSaved(true);
    } catch {
      setError(
        "Unable to save asset selection. Your access may have changed; reload and retry."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!SUPPORTED.has(provider) || (status && status !== "ACTIVE")) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-2 border-2 border-black bg-white px-3 py-2 text-xs font-bold"
        onClick={() => {
          setOpen(true);
          void loadAssets();
        }}
      >
        Manage Assets
      </button>
    );
  }

  return (
    <div className="mt-3 w-full border-2 border-black bg-white p-3 text-black">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase">
          Authorized Accounts / Properties
        </p>

        <button
          type="button"
          className="border border-black px-2 py-1 text-xs"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      {loading ? (
        <p className="text-xs">Loading accessible assets...</p>
      ) : null}

      {error ? (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {loaded ? (
        <>
          {assets.length === 0 ? (
            <p className="text-xs">
              No accessible assets were returned by this provider.
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {assets.map((asset) => (
                <label
                  key={asset.id}
                  className="flex cursor-pointer items-start gap-2 border-b border-black/10 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(asset.id)}
                    onChange={() => toggleAsset(asset.id)}
                    disabled={saving}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {asset.label}
                    </span>
                    <span className="block break-all text-black/60">
                      {asset.id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="border-2 border-black bg-[#FFDE00] px-3 py-2 text-xs font-bold disabled:opacity-50"
              disabled={saving || loading}
              onClick={() => void saveAssets()}
            >
              {saving ? "Saving..." : "Save Selection"}
            </button>

            <button
              type="button"
              className="border border-black px-3 py-2 text-xs"
              disabled={saving || loading}
              onClick={() => void loadAssets()}
            >
              Reload
            </button>
          </div>

          {saved ? (
            <p role="status" className="mt-2 text-xs text-green-700">
              Asset selection saved.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}