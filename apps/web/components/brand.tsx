import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-mark">MK</span>
      <span>MKN Site</span>
    </Link>
  );
}
