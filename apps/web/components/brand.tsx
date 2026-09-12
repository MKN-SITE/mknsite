import Image from "next/image";
import Link from "next/link";
import mknLogoImg from "@/public/assets/Logo MKN.png";

export function Brand() {
  return (
    <Link className="brand" href="/">
      <div className="brand-logo-wrap">
        <Image
          src={mknLogoImg}
          alt="PT Multi Kontrol Nusantara"
          width={51}
          height={38}
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
