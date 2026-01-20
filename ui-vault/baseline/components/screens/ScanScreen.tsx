import { AppShell } from "@/components/shared/AppShell";
import { ScanInput } from "@/components/scan/ScanInput";

export function ScanScreen() {
  return (
    <AppShell title="Search" subtitle="Cole o mint e execute o scan">
      <ScanInput />
    </AppShell>
  );
}
