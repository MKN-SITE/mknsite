import Image from "next/image";
import Link from "next/link";
import mknLogo from "@/public/assets/mkn-logo.webp";

export function Brand() {
  return (
    <Link className="brand" href="/">
      <div className="brand-logo-wrap">
        <Image
          src={mknLogo}
          alt="PT Multi Kontrol Nusantara"
          className="brand-logo-img"
          priority
        />
      </div>
      <div className="brand-text-col">
        <span className="brand-title">MKN Site</span>
        <span className="brand-company">PT Multi Kontrol Nusantara</span>
      </div>
    </Link>
  );
}
