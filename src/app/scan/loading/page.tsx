import ScanLoadingClient from "./ScanLoadingClient";

type Props = {
  searchParams?: { mint?: string; pro?: string; signature?: string };
};

export default function Page({ searchParams }: Props) {
  const mint = typeof searchParams?.mint === "string" ? searchParams.mint : "";
  const pro = searchParams?.pro === "true";
  const signature = typeof searchParams?.signature === "string" ? searchParams.signature : undefined;
  return <ScanLoadingClient mint={mint} pro={pro} signature={signature} />;
}
