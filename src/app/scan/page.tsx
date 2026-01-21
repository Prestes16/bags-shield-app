import { Suspense } from "react";
import { ScanScreen } from "@/components/screens/ScanScreen";

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <ScanScreen />
    </Suspense>
  );
}
