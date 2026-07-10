import { SettingsSidebar } from "@/components/layout/SettingsSidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex min-h-[70vh] border-[3px] border-black bg-neo-surface shadow-[6px_6px_0_0_#000]">
        <SettingsSidebar />
        <section className="flex-1 p-6">{children}</section>
      </div>
    </div>
  );
}
