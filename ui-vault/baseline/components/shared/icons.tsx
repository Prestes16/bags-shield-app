import * as React from "react";
type IconProps = React.SVGProps<SVGSVGElement>;

export function IconSearch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
export function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
    </svg>
  );
}
export function IconClock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
export function IconBell(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m8-2V11a5 5 0 10-10 0v4l-2 2h14l-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19a2 2 0 004 0" />
    </svg>
  );
}
export function IconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a7.7 7.7 0 00.1-1l2-1.5-2-3.5-2.4.6a7.6 7.6 0 00-1.7-1L13 4h-4l-.4 2.6a7.6 7.6 0 00-1.7 1L4.5 7 2.5 10.5 4.5 12a7.7 7.7 0 00.1 1l-2 1.5 2 3.5 2.4-.6a7.6 7.6 0 001.7 1L9 20h4l.4-2.6a7.6 7.6 0 001.7-1l2.4.6 2-3.5-2.1-1.5z" />
    </svg>
  );
}
