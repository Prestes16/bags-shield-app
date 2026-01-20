import ScanLoadingClient from "./ScanLoadingClient";

type Props = {
  searchParams?: { mint?: string };
};

export default function Page({ searchParams }: Props) {
  const mint = typeof searchParams?.mint === "string" ? searchParams.mint : "";
  return <ScanLoadingClient mint={mint} />;
}
