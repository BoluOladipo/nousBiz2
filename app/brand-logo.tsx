import Image from "next/image";

export default function BrandLogo({
  className = "h-9 w-auto",
}: {
  className?: string;
}) {
  return (
    <Image
      src="/nous-technology-logo.png"
      alt="Nous Technology Limited"
      width={47}
      height={35}
      className={className}
      priority
    />
  );
}
