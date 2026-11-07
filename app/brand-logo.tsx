import Image from "next/image";

export default function BrandLogo({
  className = "h-9 w-auto",
}: {
  className?: string;
}) {
  return (
    <Image
      src="/nousbiz-logo.jpg"
      alt="NousBiz"
      width={115}
      height={79}
      className={className}
      priority
    />
  );
}
